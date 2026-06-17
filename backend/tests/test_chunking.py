"""Unit tests for the document chunker."""
from __future__ import annotations

from app.rag.chunking import Chunk, chunk_document, chunk_text, split_sentences


def _words(s: str) -> int:
    return len(s.split())


def test_empty_input_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []
    assert chunk_document("") == []


def test_short_text_is_a_single_chunk():
    chunks = chunk_text("One short sentence.", max_words=60, overlap_words=15)
    assert chunks == ["One short sentence."]


def test_split_sentences():
    assert split_sentences("A b. C d! E f? G") == ["A b.", "C d!", "E f?", "G"]


def test_long_text_splits_into_multiple_windows():
    text = " ".join(f"Sentence number {i} here." for i in range(20))
    chunks = chunk_text(text, max_words=12, overlap_words=4)
    assert len(chunks) > 1
    # No window grossly exceeds the budget (allow one sentence's slack).
    assert all(_words(c) <= 12 + 6 for c in chunks)


def test_consecutive_chunks_overlap():
    text = " ".join(f"word{i} token{i} here{i}." for i in range(15))
    chunks = chunk_text(text, max_words=9, overlap_words=4)
    assert len(chunks) >= 2
    # The tail words of one chunk should reappear at the head of the next.
    for prev, nxt in zip(chunks, chunks[1:]):
        prev_tail = set(prev.split()[-4:])
        nxt_head = set(nxt.split()[:4])
        assert prev_tail & nxt_head, f"no overlap between {prev!r} and {nxt!r}"


def test_overlap_larger_than_max_is_clamped_and_terminates():
    text = " ".join(f"s{i}." for i in range(40))
    # overlap >= max_words would loop forever if not guarded.
    chunks = chunk_text(text, max_words=5, overlap_words=10)
    assert len(chunks) >= 1


def test_oversized_single_sentence_is_not_dropped():
    sentence = "alpha beta gamma delta epsilon zeta eta theta iota kappa."
    chunks = chunk_text(sentence, max_words=3, overlap_words=1)
    assert "".join(chunks).replace(" ", "")  # content preserved, not empty
    assert any("alpha" in c for c in chunks)


def test_chunk_document_returns_positioned_objects():
    text = " ".join(f"Sentence {i} body text." for i in range(10))
    chunks = chunk_document(text, max_words=10, overlap_words=3)
    assert all(isinstance(c, Chunk) for c in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))
    assert chunks[0].to_dict() == {"text": chunks[0].text, "index": 0}
