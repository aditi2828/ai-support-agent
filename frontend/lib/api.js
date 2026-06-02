const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sessionId", id);
  }
  return id;
}

export async function fetchHistory(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to load history");
  const data = await res.json();
  return data.messages || [];
}

export async function sendMessage(sessionId, message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data; // { answer, sources }
}

export async function streamMessage(
  sessionId,
  message,
  { onSources, onToken, onDone, onError }
) {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  if (!res.ok || !res.body) {
    onError?.(new Error("Stream failed"));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const evt of events) {
      const typeMatch = evt.match(/event: (\w+)/);
      const dataMatch = evt.match(/data: (.*)/s);
      if (!typeMatch || !dataMatch) continue;
      const payload = JSON.parse(dataMatch[1]);
      if (typeMatch[1] === "sources") onSources?.(payload);
      if (typeMatch[1] === "token") onToken?.(payload);
      if (typeMatch[1] === "done") onDone?.();
      if (typeMatch[1] === "error") onError?.(new Error(payload));
    }
  }
  onDone?.();
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}
