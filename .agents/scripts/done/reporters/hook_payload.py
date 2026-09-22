import json
from typing import Any, Dict, List

def format_hook_response(
    passed: bool,
    circuit_tripped: bool,
    circuit_reason: str,
    results: List[Dict[str, Any]],
    attempt: int
) -> str:
    if passed:
        return json.dumps({"decision": "allow"})

    if circuit_tripped:
        return json.dumps({
            "decision": "allow",
            "reason": f"Circuit breaker opened: {circuit_reason}. Handing off to human review (NEEDS_HUMAN)."
        })

    # Build clear, actionable continue message
    failed = [r for r in results if not r["passed"]]
    lines = [f"Deterministic checks failed (Attempt {attempt}):"]
    for f in failed:
        lines.append(f"\n[FAIL] Claim {f[claim_id]} ({f[kind]}):")
        lines.append(f"  {f[message]}")

    lines.append("\nYou MUST fix the failing claims above before finishing the task.")
    return json.dumps({
        "decision": "continue",
        "reason": "\n".join(lines)
    })
