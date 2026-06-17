"""End-to-end API tests via FastAPI's TestClient (mongomock-backed, no LLM)."""
from __future__ import annotations


def test_root_and_health(client):
    assert client.get("/").status_code == 200

    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["collegeCount"] == 3
    assert body["embeddingBackend"] == "hashing"
    assert body["vectorCount"] > 0  # chunk-level vectors


def test_readiness_ok(client):
    res = client.get("/api/readiness")
    assert res.status_code == 200
    assert res.json()["ready"] is True


def test_meta(client):
    body = client.get("/api/meta").json()
    assert body["year"] == 2025
    assert body["collegeCount"] == 3
    assert any(c["value"] == "OC" for c in body["categories"])
    assert any(b["code"] == "CSE" for b in body["branches"])


def test_list_colleges_hides_internal_fields(client):
    items = client.get("/api/colleges").json()
    assert len(items) == 3
    for it in items:
        assert "embedding" not in it
        assert "chunks" not in it
        assert "document" not in it
        assert it["code"]


def test_get_college_and_404(client):
    assert client.get("/api/colleges/CBIT").json()["name"].startswith("CHAITANYA")
    assert client.get("/api/colleges/NOPE").status_code == 404


def test_cutoffs_sorted_by_closing_rank(client):
    rows = client.get("/api/cutoffs", params={"branch": "CSE"}).json()
    assert [r["collegeCode"] for r in rows] == ["CBIT", "VASA", "MGIT"]
    assert rows[0]["closingRank"] == 2053


def test_recommendations(client):
    res = client.post("/api/recommendations",
                      json={"rank": 5000, "category": "OC", "gender": "Boys", "branch": "CSE"})
    body = res.json()
    assert {i["college"]["code"] for i in body["dream"]} == {"CBIT", "VASA"}
    assert {i["college"]["code"] for i in body["moderate"]} == {"MGIT"}


def test_predict(client):
    res = client.post("/api/predict",
                      json={"rank": 1000, "category": "OC", "gender": "Boys",
                            "branch": "CSE", "collegeCode": "CBIT"})
    body = res.json()
    assert body["cutoffRank"] == 2053
    assert body["classification"] in {"HIGH", "MEDIUM", "LOW"}
    assert any(a["code"] == "MGIT" for a in body["safeAlternatives"])


def test_compare_uses_template_without_llm(client):
    res = client.post("/api/compare", json={"codes": ["CBIT", "VASA"]})
    body = res.json()
    assert len(body["colleges"]) == 2
    assert body["aiSummary"]  # deterministic template summary


def test_counselor_chat_template_fallback(client):
    res = client.post("/api/counselor/chat",
                      json={"message": "Which CSE colleges can I get with 5000 rank?"})
    body = res.json()
    assert body["usedLlm"] is False
    assert body["answer"]
    assert body["sources"]
    assert body["parsed"]["branch"] == "CSE"
    assert body["parsed"]["rank"] == 5000


def test_auth_register_login_me(client):
    reg = client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@example.com", "password": "secret123",
        "rank": 5000, "category": "OC", "gender": "Boys",
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    assert token

    # Duplicate registration is rejected.
    dup = client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@example.com", "password": "secret123",
        "rank": 5000, "category": "OC", "gender": "Boys",
    })
    assert dup.status_code == 409

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "test@example.com"

    assert client.get("/api/auth/me").status_code == 401  # no token
