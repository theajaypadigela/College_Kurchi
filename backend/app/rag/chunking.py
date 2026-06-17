"""Document chunking for the RAG pipeline.

Long source text is split into smaller, overlapping windows *before* embedding,
so that semantic retrieval can match a query against the most relevant passage of
a document rather than against one averaged vector for the whole thing. This is
the standard RAG pre-processing step ("chunking strategy").

Why chunk at all for College Kurchi? A single college document packs several
distinct facts — location, the full per-category branch cutoff table, fees, and
placements. Embedding the whole blob into one vector blurs those facts together;
a query like "lowest fee CSE college" matches a fee chunk far more sharply than a
160-fact average. Chunking + per-chunk embeddings + aggregating chunk hits back to
the parent document is exactly the multi-vector retrieval pattern used at scale.

The chunker is deliberately dependency-free (pure Python): it is sentence-aware,
budgets each window by word count, and carries a configurable overlap between
adjacent windows so a fact that straddles a boundary still appears whole in one
chunk.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

# Defaults tuned for these short, fact-dense documents. For a corpus of long prose
# you would raise max_words (e.g. 200–400) to match the embedding model's context.
DEFAULT_MAX_WORDS = 60
DEFAULT_OVERLAP_WORDS = 15

# Split on sentence-ending punctuation followed by whitespace. Kept simple on
# purpose — the documents are machine-generated, so we don't need a full NLP
# sentence tokenizer.
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"\S+")


@dataclass
class Chunk:
    """One retrievable passage and its position in the parent document."""

    text: str
    index: int  # 0-based order within the document

    def to_dict(self) -> dict:
        return {"text": self.text, "index": self.index}


def split_sentences(text: str) -> List[str]:
    """Break text into sentences, dropping empties and stray whitespace."""
    return [s.strip() for s in _SENTENCE_RE.split(text.strip()) if s.strip()]


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text))


def _last_n_words(text: str, n: int) -> str:
    """Tail of `text` containing at most `n` words — used to seed the overlap of
    the next window so context that straddles a boundary isn't lost."""
    if n <= 0:
        return ""
    words = _WORD_RE.findall(text)
    return " ".join(words[-n:]) if words else ""


def chunk_text(
    text: str,
    max_words: int = DEFAULT_MAX_WORDS,
    overlap_words: int = DEFAULT_OVERLAP_WORDS,
) -> List[str]:
    """Split `text` into overlapping, sentence-aware windows.

    Sentences are greedily packed into a window until adding the next one would
    exceed `max_words`; the window is flushed and the next one is seeded with the
    last `overlap_words` words of the previous window. A single sentence longer
    than `max_words` is emitted on its own (never silently truncated).

    Returns a list of chunk strings (empty list for blank input).
    """
    text = (text or "").strip()
    if not text:
        return []
    if overlap_words >= max_words:  # guard against a non-terminating overlap
        overlap_words = max_words // 2

    sentences = split_sentences(text) or [text]
    chunks: List[str] = []
    current: List[str] = []
    current_words = 0

    def flush() -> str:
        return " ".join(current).strip()

    for sentence in sentences:
        sw = _word_count(sentence)
        if current and current_words + sw > max_words:
            chunk = flush()
            chunks.append(chunk)
            carry = _last_n_words(chunk, overlap_words)
            current = [carry] if carry else []
            current_words = _word_count(carry)
        current.append(sentence)
        current_words += sw

    tail = flush()
    if tail:
        chunks.append(tail)

    # De-duplicate consecutive identical chunks that can occur when a document is
    # a single long sentence shorter than the overlap window.
    deduped: List[str] = []
    for c in chunks:
        if not deduped or deduped[-1] != c:
            deduped.append(c)
    return deduped


def chunk_document(
    text: str,
    max_words: int = DEFAULT_MAX_WORDS,
    overlap_words: int = DEFAULT_OVERLAP_WORDS,
) -> List[Chunk]:
    """Like `chunk_text` but returns positioned `Chunk` objects."""
    return [Chunk(text=c, index=i) for i, c in enumerate(chunk_text(text, max_words, overlap_words))]
