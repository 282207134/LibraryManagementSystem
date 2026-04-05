import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

type ChatRole = 'user' | 'assistant';

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

function extractAssistantPayload(data: unknown): {
  text: string;
  books?: ChatMessage['books'];
  bookBatch?: BookBatch;
} | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as {
    error?: string;
    detail?: string;
    message?: { content?: string };
    books?: ChatMessage['books'];
    bookBatch?: BookBatch;
  };
  if (typeof d.error === 'string') {
    return {
      text: d.detail ? `${d.error}: ${d.detail}` : d.error,
    };
  }
  const c = d.message?.content;
  if (typeof c !== 'string') return null;
  return {
    text: c,
    books: Array.isArray(d.books) ? d.books : undefined,
    bookBatch:
      d.bookBatch &&
      typeof d.bookBatch.offset === 'number' &&
      typeof d.bookBatch.pageSize === 'number' &&
      typeof d.bookBatch.total === 'number' &&
      typeof d.bookBatch.hasMore === 'boolean'
        ? d.bookBatch
        : undefined,
  };
}

async function formatEdgeFunctionFailure(
  message: string,
  response: Response | null | undefined,
): Promise<string> {
  if (!response) {
    return `${message}。请确认已部署 ollama-chat，已配置模型与密钥，并已执行 npm run supabase:cloud:secrets。`;
  }
  let body = '';
  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        body =
          typeof parsed === 'object' && parsed !== null
            ? JSON.stringify(parsed)
            : String(parsed);
      } catch {
        body = raw;
      }
    }
  } catch {
    body = '(无法读取错误详情)';
  }
  const tail = body.length > 480 ? `${body.slice(0, 480)}…` : body;
  return `${message}（HTTP ${response.status}）${tail ? `：${tail}` : ''}`;
}

function buildInvokeBody(
  history: ChatMessage[],
  bookBatchOffset?: number,
): { messages: Array<{ role: string; content: string }>; bookBatchOffset?: number } {
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
  if (bookBatchOffset != null && bookBatchOffset > 0) {
    return { messages, bookBatchOffset };
  }
  return { messages };
}

export const ChatAssistant = () => {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '我是图书馆助手：您想找什么类型的书籍呢？',
    },
  ]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const invokeChat = useCallback(
    async (history: ChatMessage[], bookBatchOffset?: number) => {
      const { data, error, response } = await supabase.functions.invoke('ollama-chat', {
        body: buildInvokeBody(history, bookBatchOffset),
      });

      if (error) {
        const hint = await formatEdgeFunctionFailure(
          error.message || 'Edge Function 调用失败',
          response,
        );
        return { ok: false as const, hint };
      }

      const payload = extractAssistantPayload(data);
      if (!payload) {
        return {
          ok: false as const,
          hint:
            typeof data === 'object' && data !== null
              ? JSON.stringify(data)
              : '未收到有效回复',
        };
      }

      return {
        ok: true as const,
        message: {
          role: 'assistant' as const,
          content: payload.text,
          books: payload.books,
          bookBatch: payload.bookBatch,
        },
      };
    },
    [],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const nextUser: ChatMessage = { role: 'user', content: text };
    const history = [...messages, nextUser];
    setMessages(history);
    setInput('');
    setSending(true);

    try {
      const result = await invokeChat(history);
      if (!result.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.hint }]);
        return;
      }
      setMessages((prev) => [...prev, result.message]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [...prev, { role: 'assistant', content: `请求异常：${msg}` }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, invokeChat]);

  const loadMoreBooks = useCallback(
    async (batch: BookBatch) => {
      if (!batch.hasMore || sending || batch.pageSize <= 0) return;
      const nextOffset = batch.offset + batch.pageSize;
      setSending(true);
      try {
        const result = await invokeChat(messagesRef.current, nextOffset);
        if (!result.ok) {
          setMessages((prev) => [...prev, { role: 'assistant', content: result.hint }]);
          return;
        }
        setMessages((prev) => [...prev, result.message]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => [...prev, { role: 'assistant', content: `请求异常：${msg}` }]);
      } finally {
        setSending(false);
      }
    },
    [invokeChat, sending],
  );

  return (
    <>
      <button
        type="button"
        aria-label={open ? '收起 AI 助手' : '打开 AI 助手'}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-white/20 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <span className="text-xl font-semibold" aria-hidden>
          AI
        </span>
      </button>

      {open ? (
        <div
          className="fixed bottom-24 right-5 z-40 flex w-[min(100vw-2.5rem,26rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1024]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
          role="dialog"
          aria-label="AI 助手对话"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-cyan-200">AI 助手</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              收起
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(55vh,22rem)] space-y-3 overflow-y-auto px-3 py-3 text-sm"
          >
            {messages.map((m, i) =>
              m.role === 'user' ? (
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
                  {m.books && m.books.length > 0 ? (
                    <ul className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                      {m.books.map((b) => (
                        <li
                          key={b.id}
                          className="rounded-lg border border-cyan-500/15 bg-[#060a19]/90 px-2.5 py-2"
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
                        共 {m.bookBatch.total} 本匹配，已看{' '}
                        {m.bookBatch.offset + (m.books?.length ?? 0)} 本
                      </span>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void loadMoreBooks(m.bookBatch!)}
                        className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                      >
                        换一批
                      </button>
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {sending ? (
              <div className="mr-4 text-xs text-white/40">正在思考…</div>
            ) : null}
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
              placeholder="输入问题…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#060a19] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-500/50 focus:outline-none"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              发送
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
};
