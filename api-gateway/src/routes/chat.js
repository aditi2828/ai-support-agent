const express = require("express");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const Session = require("../models/Session");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const upload = multer({ storage: multer.memoryStorage() });

async function getOrCreateSession(sessionId) {
  let session = await Session.findOne({ sessionId });
  if (!session) session = await Session.create({ sessionId, messages: [] });
  return session;
}


router.get("/sessions/:sessionId", async (req, res, next) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    res.json({ messages: session ? session.messages : [] });
  } catch (err) {
    next(err);
  }
});


router.post("/chat", async (req, res, next) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message || !message.trim()) {
    return res.status(400).json({ error: "sessionId and message are required" });
  }

  try {
    const session = await getOrCreateSession(sessionId);
    session.messages.push({ role: "user", content: message });

    const { data } = await axios.post(
      `${AI_SERVICE_URL}/query`,
      { query: message },
      { timeout: 60000 }
    );

    session.messages.push({
      role: "assistant",
      content: data.answer,
      sources: data.sources || [],
    });
    session.updatedAt = new Date();
    await session.save();

    res.json({ answer: data.answer, sources: data.sources || [] });
  } catch (err) {
    if (err.response) {
      return res
        .status(502)
        .json({ error: `AI service error: ${err.response.data?.detail || err.message}` });
    }
    if (err.code === "ECONNABORTED") {
      return res.status(504).json({ error: "AI service timed out" });
    }
    next(err);
  }
});

router.post("/chat/stream", async (req, res, next) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message || !message.trim()) {
    return res.status(400).json({ error: "sessionId and message are required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const session = await getOrCreateSession(sessionId);
    session.messages.push({ role: "user", content: message });

    const upstream = await axios.post(
      `${AI_SERVICE_URL}/query/stream`,
      { query: message },
      { responseType: "stream", timeout: 120000 }
    );

    let fullAnswer = "";
    let sources = [];
    let buffer = "";

    upstream.data.on("data", (chunk) => {
      res.write(chunk); // forward raw SSE to the browser
      buffer += chunk.toString();
      const events = buffer.split("\n\n");
      buffer = events.pop();
      for (const evt of events) {
        const typeMatch = evt.match(/event: (\w+)/);
        const dataMatch = evt.match(/data: (.*)/s);
        if (!typeMatch || !dataMatch) continue;
        const payload = JSON.parse(dataMatch[1]);
        if (typeMatch[1] === "token") fullAnswer += payload;
        if (typeMatch[1] === "sources") sources = payload;
      }
    });

    upstream.data.on("end", async () => {
      try {
        if (fullAnswer.trim()) {
          session.messages.push({ role: "assistant", content: fullAnswer, sources });
          session.updatedAt = new Date();
          await session.save();
        }
      } catch (e) {
        console.error("Failed to persist streamed message:", e.message);
      }
      res.end();
    });

    upstream.data.on("error", () => res.end());
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`);
    res.end();
  }
});


router.post("/upload", upload.single("file"), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  try {
    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);
    const { data } = await axios.post(`${AI_SERVICE_URL}/ingest`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
    });
    res.json(data);
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: err.response.data?.detail || err.message });
    }
    next(err);
  }
});

module.exports = router;
