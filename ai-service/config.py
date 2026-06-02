import os
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient
from openai import OpenAI

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "support_agent")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "doc_chunks")
VECTOR_INDEX_NAME = os.getenv("VECTOR_INDEX_NAME", "vector_index")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMS = int(os.getenv("EMBEDDING_DIMS", "1536"))
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")


TOP_K = int(os.getenv("TOP_K", "3"))


@lru_cache(maxsize=1)
def get_openai() -> OpenAI:
    base_url = os.getenv("OPENAI_BASE_URL")  # optional: point to a local LLM
    if base_url:
        return OpenAI(api_key=OPENAI_API_KEY or "not-needed", base_url=base_url)
    return OpenAI(api_key=OPENAI_API_KEY)


@lru_cache(maxsize=1)
def get_collection():
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not set")
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME][COLLECTION_NAME]
