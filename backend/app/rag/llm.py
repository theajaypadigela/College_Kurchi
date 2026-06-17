"""Groq LLM client wrapper (OpenAI-compatible Llama inference).

Gracefully degrades: if no API key is configured the client reports
`available = False` and callers use a deterministic template instead. Transient
errors are retried with exponential backoff; the request carries a timeout so a
hung call can't block the API thread indefinitely.
"""
from __future__ import annotations

import time
from functools import lru_cache
from typing import List, Optional

from ..config import settings
from ..logging_config import get_logger

logger = get_logger("rag.llm")


class LLMClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_s: float = 30.0,
        max_retries: int = 2,
    ) -> None:
        self.model = model
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self._client = None
        self._error: Optional[str] = None
        if api_key:
            try:
                from groq import Groq

                # max_retries=0: we implement our own backoff below so we can log
                # each attempt and apply a per-request timeout.
                self._client = Groq(api_key=api_key, timeout=timeout_s, max_retries=0)
            except Exception as exc:  # pragma: no cover
                self._error = str(exc)
                logger.error("Groq client init failed: %s", exc)

    @property
    def available(self) -> bool:
        return self._client is not None

    def chat(
        self,
        system: str,
        messages: List[dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        if self._client is None:
            raise RuntimeError("LLM client not available")
        temperature = settings.llm_temperature if temperature is None else temperature
        max_tokens = settings.llm_max_tokens if max_tokens is None else max_tokens

        payload = [{"role": "system", "content": system}, *messages]
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                resp = self._client.chat.completions.create(
                    model=self.model,
                    messages=payload,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return (resp.choices[0].message.content or "").strip()
            except Exception as exc:  # noqa: BLE001 — surfaced to caller after retries
                last_exc = exc
                if attempt < self.max_retries:
                    backoff = 0.5 * (2 ** attempt)
                    logger.warning(
                        "LLM call failed (attempt %d/%d): %s — retrying in %.1fs",
                        attempt + 1, self.max_retries + 1, exc, backoff,
                    )
                    time.sleep(backoff)
        logger.error("LLM call failed after %d attempts: %s", self.max_retries + 1, last_exc)
        raise last_exc  # type: ignore[misc]


@lru_cache
def get_llm() -> LLMClient:
    return LLMClient(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        timeout_s=settings.llm_timeout_s,
        max_retries=settings.llm_max_retries,
    )
