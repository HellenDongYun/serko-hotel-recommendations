from pathlib import Path
from time import monotonic

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from backend.main import app


CONTRACT = yaml.safe_load((Path(__file__).resolve().parents[2] / "openapi.yaml").read_text())
RESPONSES = CONTRACT["paths"]["/recommendations"]["post"]["responses"]
client = TestClient(app)


def assert_contract(response, status):
    assert response.status_code == status
    schema = RESPONSES[str(status)]["content"]["application/json"]["schema"]
    Draft202012Validator({**schema, "components": CONTRACT["components"]}).validate(response.json())


@pytest.mark.parametrize("message", [
    "Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.",
    "I would like somewhere to stay, please.",
])
def test_success_exact_fixtures_and_delay(message):
    start = monotonic()
    response = client.post("/recommendations", json={"message": message, "scenario": "success"})
    elapsed = monotonic() - start
    assert_contract(response, 200)
    assert response.json() == RESPONSES["200"]["content"]["application/json"]["examples"]["success"]["value"]
    assert elapsed >= 0.65


def test_empty():
    response = client.post("/recommendations", json={"message": "Hotel please", "scenario": "empty"})
    assert_contract(response, 200)
    assert response.json() == RESPONSES["200"]["content"]["application/json"]["examples"]["empty"]["value"]


def test_error_remains_error():
    for _ in range(2):
        response = client.post("/recommendations", json={"message": "Hotel please", "scenario": "error"})
        assert_contract(response, 503)
        assert response.json() == RESPONSES["503"]["content"]["application/json"]["example"]


@pytest.mark.parametrize("payload", [
    {}, {"scenario": "success"}, {"message": "Hotel please"},
    {"message": "", "scenario": "success"},
    {"message": " \t\n", "scenario": "success"},
    {"message": "\u2003", "scenario": "success"},
    {"message": "Hotel please", "scenario": "unknown"},
    {"message": "Hotel please", "scenario": "Success"},
    {"message": 123, "scenario": "success"},
    {"message": None, "scenario": "success"},
    {"message": "Hotel please", "scenario": 1},
])
def test_invalid_request(payload):
    response = client.post("/recommendations", json=payload)
    assert_contract(response, 422)
    assert response.json()["detail"]


def test_malformed_json():
    response = client.post("/recommendations", content="{", headers={"Content-Type": "application/json"})
    assert_contract(response, 422)


def test_local_frontend_cors():
    response = client.options("/recommendations", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    response = client.post("/recommendations", json={"message": "Hotel please", "scenario": "error"},
                           headers={"Origin": "http://localhost:3000"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_other_origin_not_allowed():
    response = client.options("/recommendations", headers={
        "Origin": "http://example.com", "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
