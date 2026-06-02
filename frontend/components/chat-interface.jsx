"use client";

import { useEffect, useRef, useState } from "react";
import { Send, FileText, Upload, Bot, AlertCircle } from "lucide-react";
import {
  getSessionId,
  fetchHistory,
  sendMessage,
  streamMessage,
  uploadDocument,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const REFUSAL = "I cannot find the answer in the provided documentation.";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useStreaming, setUseStreaming] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [sessionId, setSessionId] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetchHistory(sessionId).then(setMessages).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || !sessionId) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      if (useStreaming) {
        setMessages((m) => [...m, { role: "assistant", content: "", sources: [] }]);
        await streamMessage(sessionId, text, {
          onSources: (sources) =>
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1].sources = sources;
              return copy;
            }),
            onToken: (tok) =>
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + tok };
              return copy;
            }),
          // onToken: (tok) =>
          //   setMessages((m) => {
          //     const copy = [...m];
          //     copy[copy.length - 1].content += tok;
          //     return copy;
          //   }),
          onDone: () => setLoading(false),
          onError: () => {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1].content =
                "Something went wrong. Please try again.";
              return copy;
            });
            setLoading(false);
          },
        });
      } else {
        const { answer, sources } = await sendMessage(sessionId, text);
        setMessages((m) => [...m, { role: "assistant", content: answer, sources }]);
        setLoading(false);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e.message}`, sources: [] },
      ]);
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus(`Indexing ${file.name}...`);
    try {
      const res = await uploadDocument(file);
      setUploadStatus(`Indexed ${res.source} (${res.chunks} chunks)`);
    } catch (err) {
      setUploadStatus(`Upload failed: ${err.message}`);
    }
    e.target.value = "";
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-4">
      {/* Header */}
      <header className="flex items-center justify-between border-b py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot size={18} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Support Knowledge Agent
            </h1>
            <p className="text-xs text-muted-foreground">
              Answers grounded in your documentation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="accent-primary"
            />
            Stream
          </label>
          <Button asChild variant="outline" size="sm">
            <label className="cursor-pointer">
              <Upload size={14} />
              Upload
              <input
                type="file"
                accept=".md,.txt"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          </Button>
        </div>
      </header>

      {uploadStatus && (
        <div className="border-b bg-muted/50 px-1 py-2 text-xs text-muted-foreground">
          {uploadStatus}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-5 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="mt-24 text-center text-sm text-muted-foreground">
            <Bot className="mx-auto mb-3 opacity-30" size={32} />
            Ask a question about your documentation to get started.
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {loading && !useStreaming && <TypingIndicator />}
      </div>

      {/* Composer */}
      <div className="border-t py-4">
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about billing, password reset, API limits..."
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const isRefusal = message.content.trim() === REFUSAL;

  return (
    <div className={`flex animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : isRefusal
              ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-900"
              : "rounded-bl-sm bg-muted text-foreground"
          }`}
        >
          {isRefusal && (
            <span className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertCircle size={14} /> Not in the docs
            </span>
          )}
          {message.content || <span className="opacity-40">…</span>}
        </div>

        {!isUser && message.sources?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.sources.map((s, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-muted-foreground"
                title={s.score ? `Similarity: ${s.score}` : undefined}
              >
                <FileText size={11} />
                Source: {s.source}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <Card className="flex gap-1 rounded-2xl rounded-bl-sm border-0 bg-muted px-4 py-3 shadow-none">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </Card>
    </div>
  );
}
