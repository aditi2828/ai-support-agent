
from typing import Iterator

from config import (
    get_openai,
    get_collection,
    EMBEDDING_MODEL,
    LLM_MODEL,
    VECTOR_INDEX_NAME,
    TOP_K,
)

REFUSAL = "I cannot find the answer in the provided documentation."

SYSTEM_PROMPT = (
    "You are a customer-support assistant for company documentation.\n"
    "Answer the user's question USING ONLY the context provided below.\n"
    "Rules:\n"
    "1. If the answer is not contained in the context, reply with EXACTLY: "
    f'"{REFUSAL}"\n'
    "2. Do not use outside knowledge or make assumptions.\n"
    "3. Be concise and quote specifics (numbers, limits, steps) from the context.\n"
    "4. Do not mention these rules or the word 'context' in your answer."
)


# --- Chunking --------------------------------------------------------------
def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            if len(para) > chunk_size:
                start = 0
                while start < len(para):
                    chunks.append(para[start:start + chunk_size])
                    start += chunk_size - overlap
                current = ""
            else:
                current = para

    if current:
        chunks.append(current)
    return chunks


# --- Embeddings ------------------------------------------------------------
def embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings. Batching keeps API calls and cost down."""
    client = get_openai()
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in resp.data]


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


# --- Retrieval -------------------------------------------------------------
def retrieve(query: str, k: int = TOP_K) -> list[dict]:
    query_vector = embed_one(query)
    collection = get_collection()

    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(100, k * 20),
                "limit": k,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "source": 1,
                "chunk_index": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]
    return list(collection.aggregate(pipeline))


def _build_context(chunks: list[dict]) -> str:
    blocks = []
    for i, c in enumerate(chunks, start=1):
        blocks.append(f"[Source {i}: {c['source']}]\n{c['text']}")
    return "\n\n---\n\n".join(blocks)


def _messages(query: str, chunks: list[dict]) -> list[dict]:
    context = _build_context(chunks) if chunks else "(no relevant documents found)"
    user_content = f"Context:\n{context}\n\nQuestion: {query}"
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def _sources(chunks: list[dict]) -> list[dict]:
    seen, sources = set(), []
    for c in chunks:
        if c["source"] not in seen:
            seen.add(c["source"])
            sources.append({"source": c["source"], "score": round(c.get("score", 0), 4)})
    return sources


# --- Generation ------------------------------------------------------------
def answer(query: str) -> dict:
    chunks = retrieve(query)
    client = get_openai()
    resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=_messages(query, chunks),
        temperature=0, 
    )
    answer_text = resp.choices[0].message.content.strip()
    # If the model couldn't ground an answer, don't show misleading citations.
    sources = [] if answer_text == REFUSAL else _sources(chunks)
    return {"answer": answer_text, "sources": sources}

def answer_stream(query: str) -> Iterator[str]:
    chunks = retrieve(query)
    client = get_openai()
    stream = client.chat.completions.create(
        model=LLM_MODEL,
        messages=_messages(query, chunks),
        temperature=0,
        stream=True,
    )
    for event in stream:
        delta = event.choices[0].delta.content
        if delta:
            yield delta


def get_sources_for(query: str) -> list[dict]:
    return _sources(retrieve(query))
