import json
import subprocess
from pathlib import Path
from typing import Any
from scripts.done.config import REPO_ROOT

def load_yaml(file_path_or_text: Any) -> Any:
    """Universal YAML loader with multiple fallbacks (PyYAML -> js-yaml via node -> json)."""
    # 1. Try pyyaml
    try:
        import yaml
        if isinstance(file_path_or_text, (str, Path)) and Path(file_path_or_text).exists():
            with open(file_path_or_text, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        else:
            return yaml.safe_load(str(file_path_or_text))
    except ImportError:
        pass

    # 2. Try js-yaml via Node (present in project modules/)
    content = ""
    if isinstance(file_path_or_text, (str, Path)) and Path(file_path_or_text).exists():
        content = Path(file_path_or_text).read_text(encoding="utf-8")
    else:
        content = str(file_path_or_text)

    try:
        candidate_paths = [
            str(REPO_ROOT / "modules"),
            str(REPO_ROOT),
            str(REPO_ROOT.parent / "vidya" / "modules"),
            str(REPO_ROOT.parent / "vidya"),
        ]
        candidate_paths_json = json.dumps(candidate_paths)
        node_script = f"""
const fs = require("fs");
const candidatePaths = {candidate_paths_json};
let yaml;
for (const p of candidatePaths) {{
    try {{
        const yamlPath = require.resolve("js-yaml", {{ paths: [p] }});
        yaml = require(yamlPath);
        break;
    }} catch (e) {{}}
}}
if (!yaml) {{
    yaml = require("js-yaml");
}}

let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {{
    try {{
        const obj = yaml.load(input);
        process.stdout.write(JSON.stringify(obj));
    }} catch(e) {{
        process.stderr.write(e.message);
        process.exit(1);
    }}
}});
"""
        res = subprocess.run(
            ["node", "-e", node_script],
            input=content,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=10
        )
        if res.returncode == 0 and res.stdout:
            return json.loads(res.stdout)
    except Exception:
        pass

    # 3. Fallback: try json parsing directly (valid YAML subset)
    try:
        return json.loads(content)
    except Exception:
        raise ValueError("Could not parse YAML. Please install PyYAML or ensure Node.js with js-yaml is available.")
