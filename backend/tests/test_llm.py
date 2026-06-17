"""Tests for the Groq LLM client wrapper — graceful degradation and retry/backoff.

No network: a fake completions object stands in for the Groq SDK client.
"""
from __future__ import annotations

import types

import pytest

from app.rag import llm as llm_mod
from app.rag.llm import LLMClient


def test_unavailable_without_api_key():
    client = LLMClient(api_key="", model="x")
    assert client.available is False
    with pytest.raises(RuntimeError):
        client.chat("system", [{"role": "user", "content": "hi"}])


def _fake_response(text: str):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=text))]
    )


class _FakeCompletions:
    def __init__(self, fail_times: int):
        self.fail_times = fail_times
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise RuntimeError("transient")
        return _fake_response("hello")


def _client_with(fake: _FakeCompletions, max_retries: int) -> LLMClient:
    client = LLMClient(api_key="", model="m", max_retries=max_retries)
    client._client = types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=fake)
    )
    return client


def test_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(llm_mod.time, "sleep", lambda _s: None)
    fake = _FakeCompletions(fail_times=1)
    client = _client_with(fake, max_retries=2)
    assert client.chat("sys", [{"role": "user", "content": "q"}]) == "hello"
    assert fake.calls == 2  # one failure + one success


def test_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr(llm_mod.time, "sleep", lambda _s: None)
    fake = _FakeCompletions(fail_times=99)
    client = _client_with(fake, max_retries=2)
    with pytest.raises(RuntimeError):
        client.chat("sys", [{"role": "user", "content": "q"}])
    assert fake.calls == 3  # initial attempt + 2 retries
