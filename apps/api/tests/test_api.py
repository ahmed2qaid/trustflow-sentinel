from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_demo_seed_and_list():
    client.post("/api/demo/reset")
    response = client.get("/api/requests")
    assert response.status_code == 200
    assert len(response.json()) == 3
