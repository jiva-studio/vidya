import time
import urllib.request
import urllib.error
from typing import Any, Dict, List
from scripts.done.ports.claim_tool import ClaimTool, ClaimResult

class HttpClaimTool(ClaimTool):
    @property
    def kind(self) -> str:
        return "http"

    def validate(self, claim: Dict[str, Any]) -> List[str]:
        errors = []
        if "url" not in claim and "path" not in claim:
            errors.append("http claim requires \"url\" or \"path\"")
        if "expect_status" in claim and not isinstance(claim["expect_status"], int):
            errors.append("http claim \"expect_status\" must be an integer (e.g. 200)")
        return errors

    def execute(self, claim: Dict[str, Any], context: Dict[str, Any]) -> ClaimResult:
        start_time = time.time()
        claim_id = claim.get("id", "http-probe")
        url = claim.get("url")
        if not url:
            base = claim.get("base_url", "http://127.0.0.1:3000")
            path = claim.get("path", "/")
            url = f"{base.rstrip('/')}/{path.lstrip('/')}"

        expect_status = claim.get("expect_status", 200)
        method = claim.get("method", "GET").upper()
        timeout = claim.get("timeout", 10)

        req = urllib.request.Request(url, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                passed = (status == expect_status)
                duration_ms = (time.time() - start_time) * 1000
                msg = "" if passed else f"Expected status {expect_status}, got {status}"
                return ClaimResult(
                    claim_id=claim_id,
                    kind=self.kind,
                    passed=passed,
                    message=msg,
                    details={"url": url, "status": status},
                    duration_ms=duration_ms
                )
        except urllib.error.HTTPError as e:
            duration_ms = (time.time() - start_time) * 1000
            passed = (e.code == expect_status)
            msg = "" if passed else f"Expected status {expect_status}, got {e.code}"
            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=passed,
                message=msg,
                details={"url": url, "status": e.code},
                duration_ms=duration_ms
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ClaimResult(
                claim_id=claim_id,
                kind=self.kind,
                passed=False,
                message=f"HTTP probe failed to reach {url}: {str(e)}",
                details={"url": url},
                duration_ms=duration_ms
            )
