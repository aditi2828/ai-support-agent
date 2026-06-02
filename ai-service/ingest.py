import sys
import os
from pathlib import Path

from config import get_collection, EMBEDDING_DIMS
from rag import chunk_text, embed

DEFAULT_FILES = [str(Path(__file__).parent / "data" / "user-manual.md")]


def ingest_file(path: str) -> int:
    source = os.path.basename(path)
    text = Path(path).read_text(encoding="utf-8")
    chunks = chunk_text(text)
    if not chunks:
        print(f"  ! {source}: no content, skipped")
        return 0

    vectors = embed(chunks)
    docs = [
        {
            "source": source,
            "chunk_index": i,
            "text": chunk,
            "embedding": vector,
        }
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]

    collection = get_collection()
    collection.delete_many({"source": source})
    collection.insert_many(docs)
    print(f"  . {source}: {len(docs)} chunks ingested ({EMBEDDING_DIMS} dims each)")
    return len(docs)


def main():
    files = sys.argv[1:] or DEFAULT_FILES
    print(f"Ingesting {len(files)} file(s)...")
    total = sum(ingest_file(f) for f in files)
    print(f"Done. {total} chunks total.")
    print(
        "\nReminder: ensure the Atlas Vector Search index exists on "
        "`embedding` with the matching dimension count (see README)."
    )


if __name__ == "__main__":
    main()
