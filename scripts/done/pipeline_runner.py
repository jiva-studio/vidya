import json
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from scripts.done.config import REPO_ROOT, TASKS_DIR
from scripts.done.yaml_loader import load_yaml
from scripts.done.pipeline_loader import load_pipeline_config
from scripts.done.engine import DoneEngine

class PipelineRunner:
    """Deterministic State-Machine Runner and Hook Driver for Pipelines."""

    def __init__(self, spec_path: Path):
        self.spec_path = spec_path
        self.task_dir = spec_path.parent
        self.state_file = self.task_dir / "artifacts" / "state.json"

    def read_state(self) -> Dict[str, Any]:
        if not self.state_file.exists():
            return {}
        try:
            return json.loads(self.state_file.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def write_state(self, state: Dict[str, Any]) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")

    def init_pipeline(self) -> Dict[str, Any]:
        if not self.spec_path.exists():
            raise FileNotFoundError(f"Specification {self.spec_path} does not exist.")

        manifest = load_yaml(self.spec_path)
        slug = manifest.get("slug", self.task_dir.name)
        pipeline_name = manifest.get("pipeline", "standard")
        pipeline_cfg = load_pipeline_config(pipeline_name)
        stages = pipeline_cfg.get("stages", [])

        state = {
            "slug": slug,
            "pipeline": pipeline_name,
            "pipeline_description": pipeline_cfg.get("description", ""),
            "status": "in_progress",
            "current_stage_idx": 0,
            "current_stage_id": stages[0].get("id") if stages and isinstance(stages[0], dict) else (stages[0] if stages else "gatekeeper"),
            "stages_completed": [],
            "stage_outputs": {},
            "claims": {},
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        self.write_state(state)
        return state

    def get_current_stage(self, state: Dict[str, Any], pipeline_cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        stages = pipeline_cfg.get("stages", [])
        idx = state.get("current_stage_idx", 0)
        if 0 <= idx < len(stages):
            stage = stages[idx]
            if isinstance(stage, str):
                return {"id": stage, "role": stage}
            return stage
        return None

    def evaluate_and_advance(self, is_hook: bool = True) -> Dict[str, Any]:
        """Evaluates current stage condition, runs required tools, and advances FSM."""
        if not self.spec_path.exists():
            return {"decision": "allow", "message": "No active spec found"}

        manifest = load_yaml(self.spec_path)
        pipeline_name = manifest.get("pipeline", "standard")
        pipeline_cfg = load_pipeline_config(pipeline_name)
        stages = pipeline_cfg.get("stages", [])

        state = self.read_state()
        if not state:
            state = self.init_pipeline()

        if state.get("status") == "completed":
            return {"decision": "allow", "message": "Pipeline completed"}

        current_stage = self.get_current_stage(state, pipeline_cfg)
        if not current_stage:
            # Reached end of stages -> Run Gatekeeper
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            if gate_res.get("passed"):
                state["status"] = "completed"
                state["updated_at"] = time.time()
                self.write_state(state)
                return {
                    "decision": "allow",
                    "reason": f"🎉 Pipeline [{pipeline_name}] for task [{state.get('slug')}] PASSED all quality gates."
                }
            else:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Gatekeeper verification failed: {gate_res.get('error', 'Claims not satisfied')}"
                }

        stage_id = current_stage.get("id", "stage")
        stage_role = current_stage.get("role", stage_id)
        stage_type = current_stage.get("type", "agent")

        # Stage Execution / Verification Logic
        if stage_id in ["red-phase", "red"]:
            # Check if test files were authored
            diff_res = subprocess.run(["git", "-C", str(REPO_ROOT), "status", "--porcelain"], capture_output=True, text=True)
            status_out = diff_res.stdout
            has_tests = any(kw in status_out for kw in [".spec.", ".test.", "/tests/", "/specs/"])
            if not has_tests:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}]: Test Author must author new/updated test suites before advancing."
                }

            # Advance to next stage
            state["stages_completed"].append(stage_id)
            state["current_stage_idx"] += 1
            next_stage = self.get_current_stage(state, pipeline_cfg)
            state["current_stage_id"] = next_stage.get("id") if next_stage else "gatekeeper"
            state["updated_at"] = time.time()
            self.write_state(state)

            next_role = next_stage.get("role", "Implementer") if next_stage else "Gatekeeper"
            return {
                "decision": "continue",
                "reason": (
                    f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Red test baseline confirmed.\n"
                    f"DIRECTIVE FOR {next_role}: Implement the minimal clean production code to turn tests GREEN without modifying test files."
                )
            }

        elif stage_id in ["green-phase", "green", "implementation"]:
            # Verify claims / tests
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            if not gate_res.get("passed"):
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}]: Implementation tests not yet green:\n{gate_res.get('error', '')}"
                }

            state["stages_completed"].append(stage_id)
            state["current_stage_idx"] += 1
            next_stage = self.get_current_stage(state, pipeline_cfg)
            state["current_stage_id"] = next_stage.get("id") if next_stage else "gatekeeper"
            state["updated_at"] = time.time()
            self.write_state(state)

            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Tests passing (Green)."
            }

        elif stage_id in ["mutation-gate", "mutation-analysis"]:
            # Run mutation tool claim
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            mut_res = next((r for r in gate_res.get("results", []) if r.get("kind") == "mutation"), None)
            
            state["stages_completed"].append(stage_id)
            state["current_stage_idx"] += 1
            next_stage = self.get_current_stage(state, pipeline_cfg)
            state["current_stage_id"] = next_stage.get("id") if next_stage else "gatekeeper"
            state["updated_at"] = time.time()
            self.write_state(state)

            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Mutation analysis recorded."
            }

        elif stage_id in ["adversarial-review", "review"]:
            state["stages_completed"].append(stage_id)
            state["current_stage_idx"] += 1
            next_stage = self.get_current_stage(state, pipeline_cfg)
            state["current_stage_id"] = next_stage.get("id") if next_stage else "gatekeeper"
            state["updated_at"] = time.time()
            self.write_state(state)

            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Review complete. Running final quality gatekeeper."
            }

        else:
            # Default gatekeeper stage
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            if gate_res.get("passed"):
                state["status"] = "completed"
                state["updated_at"] = time.time()
                self.write_state(state)
                return {
                    "decision": "allow",
                    "reason": f"🎉 Pipeline [{pipeline_name}] for task [{state.get('slug')}] PASSED all quality gates."
                }
            else:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Gatekeeper verification failed: {gate_res.get('error', 'Quality gates not met')}"
                }
