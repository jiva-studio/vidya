import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional
from scripts.done.yaml_loader import load_yaml
from scripts.done.config import TASKS_DIR, REPO_ROOT
from scripts.done.validator import validate_done_manifest
from scripts.done.pipeline_loader import validate_pipeline_manifest
from scripts.done.engine import DoneEngine

def find_active_task_spec() -> Optional[Path]:
    # 1. Check if git branch matches a task folder in .agents/tasks/
    try:
        import subprocess
        res = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True
        )
        branch = res.stdout.strip().replace("/", "-")
        if branch and (TASKS_DIR / branch / "done.yaml").exists():
            return TASKS_DIR / branch / "done.yaml"
    except Exception:
        pass

    # 2. Check most recently modified done.yaml in .agents/tasks/
    if TASKS_DIR.exists():
        candidates = list(TASKS_DIR.glob("*/done.yaml"))
        if candidates:
            candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            return candidates[0]

    return None

def main():
    parser = argparse.ArgumentParser(description="Deterministic task completion harness and validator.")
    parser.add_argument("--validate", type=str, help="Validate a done.yaml manifest against schema.")
    parser.add_argument("--validate-pipeline", type=str, help="Validate a pipeline.yaml file against schema.")
    parser.add_argument("--spec", type=str, help="Run verification against specific done.yaml path.")
    parser.add_argument("--task", type=str, help="Run verification for specific task slug in .agents/tasks/<slug>.")
    parser.add_argument("--hook", action="store_true", help="Run in Stop-hook mode with JSON stdin/stdout.")

    args = parser.parse_args()

    # 1. Validate pipeline mode
    if args.validate_pipeline:
        p = Path(args.validate_pipeline).resolve()
        if not p.exists():
            print(f"Error: Pipeline file not found at {p}", file=sys.stderr)
            sys.exit(1)
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = load_yaml(p)
        except Exception as e:
            print(f"YAML Syntax Error: {str(e)}", file=sys.stderr)
            sys.exit(1)

        is_valid, errors = validate_pipeline_manifest(data)
        if is_valid:
            print(f"✅ pipeline.yaml at {p.name} is VALID.")
            sys.exit(0)
        else:
            print(f"❌ pipeline.yaml schema validation failed with {len(errors)} error(s):", file=sys.stderr)
            for err in errors:
                print(f"  - {err}", file=sys.stderr)
            sys.exit(1)

    # 2. Validate done manifest mode
    if args.validate:
        p = Path(args.validate).resolve()
        if not p.exists():
            print(f"Error: File not found at {p}", file=sys.stderr)
            sys.exit(1)
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = load_yaml(p)
        except Exception as e:
            print(f"YAML Syntax Error: {str(e)}", file=sys.stderr)
            sys.exit(1)

        is_valid, errors = validate_done_manifest(data)
        if is_valid:
            print(f"✅ done.yaml at {p.name} is VALID.")
            sys.exit(0)
        else:
            print(f"❌ done.yaml schema validation failed with {len(errors)} error(s):", file=sys.stderr)
            for err in errors:
                print(f"  - {err}", file=sys.stderr)
            sys.exit(1)

    # 3. Hook mode
    if args.hook:
        if os.environ.get("VIDYA_DONE") == "0" or os.environ.get("FORCE_STOP") == "1":
            print(json.dumps({"decision": "allow"}))
            sys.exit(0)

        spec_file = find_active_task_spec()
        if not spec_file:
            print(json.dumps({"decision": "allow"}))
            sys.exit(0)

        engine = DoneEngine(spec_file)
        result = engine.run(is_hook_mode=True)
        print(result.get("hook_payload", json.dumps({"decision": "allow"})))
        sys.exit(0)

    # 4. Direct execution mode
    target_spec = None
    if args.spec:
        target_spec = Path(args.spec).resolve()
    elif args.task:
        target_spec = TASKS_DIR / args.task / "done.yaml"
    else:
        target_spec = find_active_task_spec()

    if not target_spec or not target_spec.exists():
        print("No active done.yaml found. Provide --spec <path> or --task <slug>.", file=sys.stderr)
        sys.exit(1)

    print(f"Running verification against: {target_spec}")
    engine = DoneEngine(target_spec)
    result = engine.run(is_hook_mode=False)

    print("")
    print("=" * 60)
    if result["passed"]:
        print(f"🎉 TASK [{result['slug']}] VERIFIED COMPLETED (Total: {result['total_duration_ms']:.1f}ms)")
        sys.exit(0)
    else:
        print(f"❌ TASK [{result['slug']}] VERIFICATION FAILED")
        for res in result["results"]:
            status = "✅ PASS" if res["passed"] else "❌ FAIL"
            cached_str = " [CACHED]" if res.get("cached") else ""
            print(f"  {status}{cached_str} {res['claim_id']} ({res['kind']}) - {res['message']}")
        sys.exit(1)

if __name__ == "__main__":
    main()
