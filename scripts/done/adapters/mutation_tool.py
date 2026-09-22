import re
import subprocess
import time
from typing import Any, Dict, List
from scripts.done.ports.claim_tool import ClaimTool, ClaimResult
from scripts.done.config import REPO_ROOT

class MutationClaimTool(ClaimTool):
    @property
    def kind(self) -> str:
        return "mutation"

    def validate(self, claim: Dict[str, Any]) -> List[str]:
        errors = []
        target = claim.get("package") or claim.get("target")
        if not target or not isinstance(target, str):
            errors.append("mutation claim requires \"package\" or \"target\" string (e.g. \"@vidya/domain\" or \"all\")")
        mode = claim.get("mode", "diff")
        if mode not in ("diff", "full"):
            errors.append(f"mutation claim \"mode\" must be \"diff\" or \"full\", got \"{mode}\"")
        return errors

    def execute(self, claim: Dict[str, Any], context: Dict[str, Any]) -> ClaimResult:
        start_time = time.time()
        claim_id = claim.get("id", "mutation-check")
        target = claim.get("package") or claim.get("target")
        mode = claim.get("mode", "diff")
        timeout = claim.get("timeout", 600)

        script_path = REPO_ROOT / "scripts" / "vidya-mutation-suite-run"
        if not script_path.exists():
            duration_ms = (time.time() - start_time) * 1000
            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=False,
                message=f"Mutation runner not found at {script_path}",
                duration_ms=duration_ms
            )

        cmd = ["./scripts/vidya-mutation-suite-run", mode, target]

        try:
            res = subprocess.run(
                cmd,
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=False
            )
            duration_ms = (time.time() - start_time) * 1000
            output = res.stdout + "\n" + res.stderr

            survived_mutants = []
            for line in output.splitlines():
                if "Survived" in line or "Mutant survived" in line or "[Survived]" in line:
                    survived_mutants.append(line.strip())

            passed = (res.returncode == 0 and len(survived_mutants) == 0)

            if not passed:
                if survived_mutants:
                    msg = "Survived mutants detected:\n" + "\n".join(survived_mutants[:10])
                else:
                    msg = res.stderr.strip() or res.stdout.strip() or f"Mutation run exited with code {res.returncode}"
            else:
                msg = ""

            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=passed,
                message=msg,
                details={
                    "cmd": " ".join(cmd),
                    "survived_mutants": survived_mutants,
                    "returncode": res.returncode
                },
                duration_ms=duration_ms
            )
        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start_time) * 1000
            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=False,
                message=f"Mutation test timed out after {timeout}s",
                duration_ms=duration_ms
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=False,
                message=str(e),
                duration_ms=duration_ms
            )
