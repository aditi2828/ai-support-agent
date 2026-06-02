import json
import os
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import rag
from ingest import ingest_file

app = FastAPI(title="Support Agent — Intelligence Service")


class QueryIn(BaseModel):
    query: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query")
def query(body: QueryIn):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    try:
        return rag.answer(body.query)
    except Exception as exc:  # surface a clean error to the gateway
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")


@app.post("/query/stream")
def query_stream(body: QueryIn):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    def event_generator():
        try:
            sources = rag.get_sources_for(body.query)
            yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
            for token in rag.answer_stream(body.query):
                yield f"event: token\ndata: {json.dumps(token)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps(str(exc))}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    if not file.filename.endswith((".md", ".txt")):
        raise HTTPException(status_code=400, detail="only .md or .txt files are supported")

    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        target = os.path.join(tempfile.gettempdir(), file.filename)
        os.replace(tmp_path, target)
        count = ingest_file(target)
        return {"source": file.filename, "chunks": count}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ingest failed: {exc}")
