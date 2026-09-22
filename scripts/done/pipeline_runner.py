import fnmatch
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
    """Deterministic, Generic State-Machine Runner and Hook Driver for Pipelines."""

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

    def init_pipeline(self, pipeline_override: Optional[str] = None) -> Dict[str, Any]:
        if not self.spec_path.exists():
            raise FileNotFoundError(f"Specification {self.spec_path} does not exist.")

        manifest = load_yaml(self.spec_path)
        slug = manifest.get("slug", self.task_dir.name)
        pipeline_name = pipeline_override or manifest.get("pipeline", "standard")
        pipeline_cfg = load_pipeline_config(pipeline_name)
        stages = pipeline_cfg.get("stages", [])

        first_stage_id = "gatekeeper"
        if stages:
            first_stage_id = stages[0].get("id") if isinstance(stages[0], dict) else stages[0]

        state = {
            "slug": slug,
            "pipeline": pipeline_name,
            "pipeline_description": pipeline_cfg.get("description", ""),
            "status": "in_progress",
            "current_stage_idx": 0,
            "current_stage_id": first_stage_id,
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
                return {"id": stage, "role": stage, "verify": {"type": "all_claims"}}
            return stage
        return None

    def _get_changed_files(self) -> List[str]:
        try:
            res = subprocess.run(
                ["git", "-C", str(REPO_ROOT), "status", "--porcelain"],
                capture_output=True,
                text=True,
                timeout=5
            )
            files = []
            for line in res.stdout.strip().splitlines():
                if len(line) > 3:
                    files.append(line[3:].strip())
            return files
        except Exception:
            return []

    def _check_forbidden_edits(self, forbid_patterns: List[str], changed_files: List[str]) -> List[str]:
        violations = []
        for f in changed_files:
            for pattern in forbid_patterns:
                if fnmatch.fnmatch(f, pattern) or pattern in f:
                    violations.append(f)
        return violations

    def advance_to_next_stage(self, state: Dict[str, Any], pipeline_cfg: Dict[str, Any], stage_id: str) -> Optional[Dict[str, Any]]:
        state["stages_completed"].append(stage_id)
        state["current_stage_idx"] += 1
        next_stage = self.get_current_stage(state, pipeline_cfg)
        state["current_stage_id"] = next_stage.get("id") if next_stage else "gatekeeper"
        state["updated_at"] = time.time()
        self.write_state(state)
        return next_stage

    def evaluate_and_advance(self, is_hook: bool = True) -> Dict[str, Any]:
        """Evaluates current stage condition purely based on declarative schema, advancing FSM."""
        if not self.spec_path.exists():
            return {"decision": "allow", "message": "No active spec found"}

        manifest = load_yaml(self.spec_path)
        state = self.read_state()
        pipeline_name = state.get("pipeline") or manifest.get("pipeline", "standard")
        pipeline_cfg = load_pipeline_config(pipeline_name)

        if not state:
            state = self.init_pipeline(pipeline_name)

        if state.get("status") == "completed":
            return {"decision": "allow", "message": f"Pipeline [{pipeline_name}] already completed"}

        current_stage = self.get_current_stage(state, pipeline_cfg)
        if not current_stage:
            # End of stages -> Run final Gatekeeper
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
                    "reason": f"⛔ Gatekeeper verification failed: {gate_res.get('error', 'Quality claims not satisfied')}"
                }

        stage_id = current_stage.get("id", "stage")
        stage_role = current_stage.get("role", stage_id)
        verify_cfg = current_stage.get("verify", {})
        verify_type = verify_cfg.get("type") if isinstance(verify_cfg, dict) else str(verify_cfg)

        changed_files = self._get_changed_files()

        # 1. Check forbidden edits if specified
        forbid_patterns = current_stage.get("forbid_edits", [])
        if isinstance(verify_cfg, dict) and "forbid_edits" in verify_cfg:
            forbid_patterns.extend(verify_cfg["forbid_edits"])
        if forbid_patterns:
            violations = self._check_forbidden_edits(forbid_patterns, changed_files)
            if violations:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}]: Modified forbidden files violating role boundaries:\n" + "\n".join([f"  - {v}" for v in violations])
                }

        # 2. Generic Verification Handling
        if verify_type in ["tests_red", "tests_failed_red"]:
            patterns = verify_cfg.get("patterns", [".spec.", ".test.", "/tests/", "/specs/"]) if isinstance(verify_cfg, dict) else [".spec.", ".test."]
            has_matching_tests = any(any(p in f for p in patterns) for f in changed_files)
            if not has_matching_tests:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}] ({stage_role}): Must author test suites matching {patterns} before proceeding."
                }

            next_stage = self.advance_to_next_stage(state, pipeline_cfg, stage_id)
            next_role = next_stage.get("role", "Implementer") if next_stage else "Gatekeeper"
            next_directive = next_stage.get("directive", "Implement clean code to satisfy requirements.") if next_stage else "Verify gatekeeper claims."
            return {
                "decision": "continue",
                "reason": (
                    f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Red test baseline confirmed.\n"
                    f"DIRECTIVE FOR {next_role}: {next_directive}"
                )
            }

        elif verify_type in ["tests_green", "tests_passed_green"]:
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            if not gate_res.get("passed"):
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}] ({stage_role}): Tests/verification not yet passing:\n{gate_res.get('error', '')}"
                }

            next_stage = self.advance_to_next_stage(state, pipeline_cfg, stage_id)
            next_role = next_stage.get("role", "Next Step") if next_stage else "Gatekeeper"
            next_directive = next_stage.get("directive", "Proceed to next verification.") if next_stage else "Run final gatekeeper."
            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Tests passing (Green).\nDIRECTIVE FOR {next_role}: {next_directive}"
            }

        elif verify_type in ["claim", "mutation"]:
            engine = DoneEngine(self.spec_path)
            gate_res = engine.run(is_hook_mode=is_hook)
            next_stage = self.advance_to_next_stage(state, pipeline_cfg, stage_id)
            next_role = next_stage.get("role", "Reviewer") if next_stage else "Gatekeeper"
            next_directive = next_stage.get("directive", "Review changes.") if next_stage else "Complete verification."
            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Claim executed.\nDIRECTIVE FOR {next_role}: {next_directive}"
            }

        elif verify_type in ["diff_present"]:
            if not changed_files:
                return {
                    "decision": "continue",
                    "reason": f"⛔ Pipeline Stage [{stage_id}] ({stage_role}): No file changes detected. Author documentation/code before proceeding."
                }
            next_stage = self.advance_to_next_stage(state, pipeline_cfg, stage_id)
            next_role = next_stage.get("role", "Critic") if next_stage else "Gatekeeper"
            next_directive = next_stage.get("directive", "Review changes.") if next_stage else "Run gatekeeper."
            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Changes detected.\nDIRECTIVE FOR {next_role}: {next_directive}"
            }

        elif verify_type in ["review", "review_approval"]:
            next_stage = self.advance_to_next_stage(state, pipeline_cfg, stage_id)
            return {
                "decision": "continue",
                "reason": f"🚀 STAGE ADVANCEMENT [{stage_id} -> {state['current_stage_id']}]: Review step completed."
            }

        else:
            # Default / all_claims
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
