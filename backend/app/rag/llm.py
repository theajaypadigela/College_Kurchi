"""Groq LLM client wrapper (OpenAI-compatible Llama inference).

Gracefully degrades: if no API key is configured the client reports
`available = False` and callers use a deterministic template instead.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from ..config import settings


class LLMClient:
    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self._client = None
        self._error: Optional[str] = None
        if api_key:
            try:
                from groq import Groq

                self._client = Groq(api_key=api_key)
            except Exception as exc:  # pragma: no cover
                self._error = str(exc)

    @property
    def available(self) -> bool:
        return self._client is not None

    def chat(
        self,
        system: str,
        messages: List[dict],
        temperature: float = 0.3,
        max_tokens: int = 900,
    ) -> str:
        if self._client is None:
            raise RuntimeError("LLM client not available")
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system}, *messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()


@lru_cache
def get_llm() -> LLMClient:
    return LLMClient(api_key=settings.groq_api_key, model=settings.groq_model)
