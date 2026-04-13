import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";

type ChatRole = "user" | "assistant";

type BookBatch = {
  offset: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type ChatMessage = {
  role: ChatRole;
  content: string;
  books?: Array<{ id: string; title: string; blurb: string }>;
  bookBatch?: BookBatch;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function extractAssistantPayload(data: unknown): {
  text: string;
  books?: ChatMessage["books"];
  bookBatch?: BookBatch;
} | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    error?: string;
    detail?: string;
    message?: { content?: string };
    books?: ChatMessage["books"];
    bookBatch?: BookBatch;
  };
  if (typeof d.error === "string") {
    return { text: d.detail ? `${d.error}: ${d.detail}` : d.error };
  }
  const c = d.message?.content;
  if (typeof c !== "string") return null;
  return {
    text: c,
    books: Array.isArray(d.books) ? d.books : undefined,
    bookBatch:
      d.bookBatch &&
      typeof d.bookBatch.offset === "number" &&
      typeof d.bookBatch.pageSize === "number" &&
      typeof d.bookBatch.total === "number" &&
      typeof d.bookBatch.hasMore === "boolean"
        ? d.bookBatch
        : undefined,
  };
}

async function formatEdgeFunctionFailure(
  message: string,
  response: Response | null | undefined,
): Promise<string> {
  if (!response) {
    return `${message}. Please confirm ai-chat is deployed and secrets are synced.`;
  }
  let body = "";
  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        body =
          typeof parsed === "object" && parsed !== null
            ? JSON.stringify(parsed)
            : String(parsed);
      } catch {
        body = raw;
      }
    }
  } catch {
    body = "(failed to read details)";
  }
  const tail = body.length > 480 ? `${body.slice(0, 480)}...` : body;
  return `${message} (HTTP ${response.status})${tail ? `: ${tail}` : ""}`;
}

function buildInvokeBody(
  history: ChatMessage[],
  locale: string,
  bookBatchOffset?: number,
): { messages: Array<{ role: string; content: string }>; bookBatchOffset?: number; locale: string } {
  const messages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  if (bookBatchOffset != null && bookBatchOffset > 0) {
    return { messages, bookBatchOffset, locale };
  }
  return { messages, locale };
}

export const ChatAssistant = () => {
  const { language, speechLocale } = useLanguage();
  const textMap = {
    zh: {
      ready: "图书馆助手已就绪，请告诉我你想找什么书。",
      collapse: "收起 AI 助手",
      open: "打开 AI 助手",
      dialog: "AI 助手对话框",
      title: "AI 助手",
      close: "关闭",
      requestFailed: "请求失败",
      invalidPayload: "返回数据格式无效",
      edgeFunctionFailed: "云函数调用失败",
      total: "总数",
      shown: "已展示",
      nextBatch: "下一批",
      thinking: "思考中...",
      askPlaceholder: "输入你的问题...",
      send: "发送",
      speechNotSupported: "当前浏览器不支持语音识别",
      speechStartError: "语音识别启动失败",
      speechError: "语音识别失败",
      speechInput: "语音输入",
      stopSpeechInput: "停止语音输入",
      readAloud: "朗读",
      stopReadAloud: "停止朗读",
    },
    en: {
      ready: "Library assistant is ready. Tell me what to find.",
      collapse: "Collapse AI assistant",
      open: "Open AI assistant",
      dialog: "AI assistant dialog",
      title: "AI Assistant",
      close: "Close",
      requestFailed: "Request failed",
      invalidPayload: "Invalid payload",
      edgeFunctionFailed: "Edge function invocation failed",
      total: "Total",
      shown: "Shown",
      nextBatch: "Next batch",
      thinking: "Thinking...",
      askPlaceholder: "Type a question...",
      send: "Send",
      speechNotSupported: "Speech recognition is not supported in this browser",
      speechStartError: "Failed to start speech recognition",
      speechError: "Speech recognition failed",
      speechInput: "Voice input",
      stopSpeechInput: "Stop voice input",
      readAloud: "Read",
      stopReadAloud: "Stop",
    },
    ja: {
      ready: "図書館アシスタントの準備ができました。探したい本を教えてください。",
      collapse: "AI アシスタントを閉じる",
      open: "AI アシスタントを開く",
      dialog: "AI アシスタントダイアログ",
      title: "AI アシスタント",
      close: "閉じる",
      requestFailed: "リクエストに失敗しました",
      invalidPayload: "レスポンス形式が不正です",
      edgeFunctionFailed: "Edge Function の呼び出しに失敗しました",
      total: "合計",
      shown: "表示済み",
      nextBatch: "次の一括",
      thinking: "考え中...",
      askPlaceholder: "質問を入力...",
      send: "送信",
      speechNotSupported: "このブラウザは音声認識に対応していません",
      speechStartError: "音声認識の開始に失敗しました",
      speechError: "音声認識でエラーが発生しました",
      speechInput: "音声入力",
      stopSpeechInput: "音声入力を停止",
      readAloud: "読み上げ",
      stopReadAloud: "停止",
    },
  } as const;
  const t = textMap[language];

  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: t.ready },
  ]);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechCtor = (
    typeof window !== "undefined"
      ? ((window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor })
          .webkitSpeechRecognition ??
          (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor })
            .SpeechRecognition)
      : undefined
  ) as SpeechRecognitionCtor | undefined;
  const speechRecognitionSupported = Boolean(speechCtor);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== "assistant") return prev;
      return [{ role: "assistant", content: t.ready }];
    });
  }, [t.ready]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!speechRecognitionSupported || !speechCtor) return;
    const recognition = new speechCtor();
    recognition.lang = speechLocale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      const err = event.error ? `: ${event.error}` : "";
      setMessages((prev) => [...prev, { role: "assistant", content: `${t.speechError}${err}` }]);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
      setListening(false);
    };
  }, [speechCtor, speechLocale, speechRecognitionSupported, t.speechError]);

  const invokeChat = useCallback(
    async (history: ChatMessage[], bookBatchOffset?: number) => {
      const { data, error, response } = await supabase.functions.invoke("ai-chat", {
        body: buildInvokeBody(history, speechLocale, bookBatchOffset),
      });
      if (error) {
        const hint = await formatEdgeFunctionFailure(
          error.message || t.edgeFunctionFailed,
          response,
        );
        return { ok: false as const, hint };
      }

      const payload = extractAssistantPayload(data);
      if (!payload) {
        return {
          ok: false as const,
          hint: typeof data === "object" && data !== null ? JSON.stringify(data) : t.invalidPayload,
        };
      }
      return {
        ok: true as const,
        message: {
          role: "assistant" as const,
          content: payload.text,
          books: payload.books,
          bookBatch: payload.bookBatch,
        },
      };
    },
    [speechLocale, t.edgeFunctionFailed, t.invalidPayload],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextUser: ChatMessage = { role: "user", content: text };
    const history = [...messages, nextUser];
    setMessages(history);
    setInput("");
    setSending(true);
    try {
      const result = await invokeChat(history);
      if (!result.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.hint }]);
        return;
      }
      setMessages((prev) => [...prev, result.message]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [...prev, { role: "assistant", content: `${t.requestFailed}: ${msg}` }]);
    } finally {
      setSending(false);
    }
  }, [input, invokeChat, messages, sending, t.requestFailed]);

  const loadMoreBooks = useCallback(
    async (batch: BookBatch) => {
      if (!batch.hasMore || sending || batch.pageSize <= 0) return;
      const nextOffset = batch.offset + batch.pageSize;
      setSending(true);
      try {
        const result = await invokeChat(messagesRef.current, nextOffset);
        if (!result.ok) {
          setMessages((prev) => [...prev, { role: "assistant", content: result.hint }]);
          return;
        }
        setMessages((prev) => [...prev, result.message]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => [...prev, { role: "assistant", content: `${t.requestFailed}: ${msg}` }]);
      } finally {
        setSending(false);
      }
    },
    [invokeChat, sending, t.requestFailed],
  );

  const toggleListening = useCallback(() => {
    if (!speechRecognitionSupported || !recognitionRef.current) {
      setMessages((prev) => [...prev, { role: "assistant", content: t.speechNotSupported }]);
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [...prev, { role: "assistant", content: `${t.speechStartError}: ${msg}` }]);
      setListening(false);
    }
  }, [listening, speechRecognitionSupported, t.speechNotSupported, t.speechStartError]);

  const speakText = useCallback(
    (content: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = speechLocale;
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(speechLocale.toLowerCase().split("-")[0]));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      synth.speak(utterance);
    },
    [speechLocale],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={open ? t.collapse : t.open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-white/20 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <span className="text-xl font-semibold" aria-hidden>
          AI
        </span>
      </button>

      {open ? (
        <div
          className="fixed bottom-24 right-5 z-40 flex w-[min(100vw-2.5rem,20rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#354f72]/92 shadow-2xl shadow-black/40 backdrop-blur-xl"
          role="dialog"
          aria-label={t.dialog}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-cyan-200">{t.title}</span>
              <button
                type="button"
                onClick={toggleListening}
                className={`rounded-lg px-2 py-1 text-xs ${listening ? "bg-red-500/70 text-white" : "bg-white/10 text-white/85 hover:bg-white/20"}`}
              >
                {listening ? t.stopSpeechInput : t.speechInput}
              </button>
              <button
                type="button"
                onClick={stopSpeaking}
                disabled={!speaking}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/20 disabled:opacity-40"
              >
                {t.stopReadAloud}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              {t.close}
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(55vh,22rem)] space-y-3 overflow-y-auto px-3 py-3 text-sm"
          >
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={`${i}-user`}
                  className="ml-3 rounded-xl rounded-br-sm bg-cyan-600/25 px-3 py-2 text-cyan-50"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={`${i}-assistant`}
                  className="mr-2 rounded-xl rounded-bl-sm bg-white/5 px-3 py-2.5 text-gray-200"
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-100">
                    {m.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => speakText(m.content)}
                    className="mt-2 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    {t.readAloud}
                  </button>
                  {m.books && m.books.length > 0 ? (
                    <ul className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                      {m.books.map((b) => (
                        <li
                          key={b.id}
                          className="rounded-lg border border-cyan-500/20 bg-[#2a3f5c]/95 px-2.5 py-2"
                        >
                          <Link
                            to={`/user/books/${b.id}`}
                            className="text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
                          >
                            {b.title}
                          </Link>
                          <p className="mt-1 text-xs leading-snug text-white/60 line-clamp-3">
                            {b.blurb}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.bookBatch?.hasMore && m.bookBatch.pageSize > 0 ? (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                      <span className="text-[11px] text-white/40">
                        {t.total} {m.bookBatch.total}, {t.shown} {m.bookBatch.offset + (m.books?.length ?? 0)}
                      </span>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => m.bookBatch && void loadMoreBooks(m.bookBatch)}
                        className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                      >
                        {t.nextBatch}
                      </button>
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {sending ? <div className="mr-4 text-xs text-white/40">{t.thinking}</div> : null}
          </div>

          <form
            className="flex gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.askPlaceholder}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#2a3f5c] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-500/50 focus:outline-none"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {t.send}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
};
