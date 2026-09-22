import json
import unittest
from pathlib import Path
from scripts.done.validator import validate_done_manifest
from scripts.done.circuit_breaker import CircuitBreaker
from scripts.done.adapters.make_tool import MakeClaimTool
from scripts.done.adapters.http_tool import HttpClaimTool
from scripts.done.adapters.hygiene_tool import HygieneClaimTool
from scripts.done.yaml_loader import load_yaml

class TestDoneHarness(unittest.TestCase):
    def test_validator_valid_manifest(self):
        valid = {
            "slug": "test-task",
            "target": "modules/libs/domain",
            "claims": [
                {"id": "c1", "kind": "make", "target": "check-package", "params": {"PKG": "@vidya/domain"}},
                {"id": "c2", "kind": "mutation", "target": "@vidya/domain", "mode": "diff"},
                {"id": "c3", "kind": "http", "url": "http://127.0.0.1:3000/health", "expect_status": 200},
                {"id": "c4", "kind": "critic", "runner": "auto", "checks": ["Intent check"]}
            ]
        }
        is_valid, errors = validate_done_manifest(valid)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_validator_missing_slug(self):
        invalid = {"claims": [{"id": "c1", "kind": "make", "target": "check"}]}
        is_valid, errors = validate_done_manifest(invalid)
        self.assertFalse(is_valid)
        self.assertTrue(any("slug" in e for e in errors))

    def test_validator_duplicate_claim_id(self):
        invalid = {
            "slug": "task",
            "claims": [
                {"id": "dup", "kind": "make", "target": "check"},
                {"id": "dup", "kind": "make", "target": "test"}
            ]
        }
        is_valid, errors = validate_done_manifest(invalid)
        self.assertFalse(is_valid)
        self.assertTrue(any("Duplicate claim id" in e for e in errors))

    def test_validator_unknown_kind(self):
        invalid = {
            "slug": "task",
            "claims": [{"id": "c1", "kind": "random_unknown"}]
        }
        is_valid, errors = validate_done_manifest(invalid)
        self.assertFalse(is_valid)
        self.assertTrue(any("unknown tool" in e or "unknown kind" in e for e in errors))

    def test_circuit_breaker_max_retries(self):
        import tempfile, shutil
        tmp_dir = Path(tempfile.mkdtemp())
        try:
            cb = CircuitBreaker(tmp_dir, max_retries=2)
            # Attempt 1
            res1 = cb.check_and_update([{"id": "c1", "message": "err1"}])
            self.assertFalse(res1["is_tripped"])
            self.assertEqual(res1["attempt"], 1)

            # Attempt 2 with different error
            res2 = cb.check_and_update([{"id": "c1", "message": "err2"}])
            self.assertFalse(res2["is_tripped"])
            self.assertEqual(res2["attempt"], 2)

            # Attempt 3 -> trips max_retries
            res3 = cb.check_and_update([{"id": "c1", "message": "err3"}])
            self.assertTrue(res3["is_tripped"])
            self.assertTrue("maximum automated retry budget" in res3["reason"])
        finally:
            shutil.rmtree(tmp_dir)

    def test_circuit_breaker_stagnation(self):
        import tempfile, shutil
        tmp_dir = Path(tempfile.mkdtemp())
        try:
            cb = CircuitBreaker(tmp_dir, max_retries=5)
            # Attempt 1
            cb.check_and_update([{"id": "c1", "message": "exact same error"}])
            # Attempt 2 with exact same failure
            res2 = cb.check_and_update([{"id": "c1", "message": "exact same error"}])
            self.assertTrue(res2["is_tripped"])
            self.assertTrue("Stagnation detected" in res2["reason"])
        finally:
            shutil.rmtree(tmp_dir)

    def test_yaml_loader(self):
        raw = "slug: my-slug\ncount: 42"
        data = load_yaml(raw)
        self.assertEqual(data["slug"], "my-slug")
        self.assertEqual(data["count"], 42)

if __name__ == "__main__":
    unittest.main()
