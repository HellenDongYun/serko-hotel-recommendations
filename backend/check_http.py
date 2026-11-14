"""Check the running local server against the handwritten contract."""
from pathlib import Path
from time import monotonic

import httpx
import yaml
from jsonschema import Draft202012Validator


def main():
    contract = yaml.safe_load((Path(__file__).resolve().parents[1] / "openapi.yaml").read_text())
    responses = contract["paths"]["/recommendations"]["post"]["responses"]
    cases = [
        ("success", {"message": "Wellington hotel please", "scenario": "success"}, 200),
        ("invalid", {"message": " \t", "scenario": "success"}, 422),
        ("error", {"message": "Wellington hotel please", "scenario": "error"}, 503),
    ]
    with httpx.Client(base_url="http://127.0.0.1:8000", trust_env=False) as client:
        for name, payload, status in cases:
            start = monotonic()
            response = client.post("/recommendations", json=payload)
            elapsed = monotonic() - start
            assert response.status_code == status, response.text
            media = responses[str(status)]["content"]["application/json"]
            Draft202012Validator({**media["schema"], "components": contract["components"]}).validate(response.json())
            if name == "success":
                assert response.json() == media["examples"]["success"]["value"]
                assert elapsed >= 0.65
            elif name == "error":
                assert response.json() == media["example"]
            else:
                assert response.json()["detail"][0]["loc"] == ["body", "message"]
            print(f"PASS {name}: HTTP {status}, {elapsed:.3f}s, JSON={response.text}")


if __name__ == "__main__":
    main()
