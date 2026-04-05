// 图书意图：按问题筛选 + 评论热度排序 + 分页（bookBatchOffset）；非图书闲聊走轻量提示
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 5;
const FETCH_POOL = 220;

type Msg = { role: string; content: string };

type BookRow = {
  id: string;
  title: string;
  author: string;
  category?: string | null;
  publication_year?: number | null;
  description?: string | null;
  available_quantity?: number | null;
  quantity?: number | null;
  created_at?: string;
};

type BookBatchMeta = {
  offset: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type BookPayload = { id: string; title: string; blurb: string };

const BOOK_INTENT_RE =
  /书|小说|推荐|馆藏|科幻|图书|借阅|作者|分类|册|借|找几|哪些|什么书|书目|读本|看看|热门|人气|排行/i;

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMessages(messages: unknown): Msg[] {
  if (!Array.isArray(messages)) return [];
  const allowed = new Set(["system", "user", "assistant", "tool"]);
  const out: Msg[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as Msg;
    if (typeof role !== "string" || typeof content !== "string") continue;
    if (!allowed.has(role)) continue;
    out.push({ role, content });
  }
  return out;
}

function messagesForModel(msgs: Msg[]): Msg[] {
  return msgs.filter((m) => m.role !== "system");
}

function lastUserContent(msgs: Msg[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user") return msgs[i].content;
  }
  return "";
}

function isBookIntent(query: string, batchOffset: number): boolean {
  if (batchOffset > 0) return true;
  return BOOK_INTENT_RE.test(query.trim());
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function relevanceScore(book: BookRow, query: string): number {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return 1;
  const t = (book.title ?? "").toLowerCase();
  const a = (book.author ?? "").toLowerCase();
  const c = (book.category ?? "").toLowerCase();
  const d = (book.description ?? "").toLowerCase();
  let s = 0;
  if (q.length >= 2 && t.includes(q)) s += 25;
  if (q.length >= 2 && d.includes(q)) s += 12;
  if (q.length >= 2 && c.includes(q)) s += 18;
  if (q.length >= 2 && a.includes(q)) s += 15;
  const tags = ["科幻", "科学", "奇幻", "历史", "文学", "科普"];
  for (const tag of tags) {
    if (q.includes(tag) && (c.includes(tag) || d.includes(tag) || t.includes(tag))) {
      s += 22;
    }
  }
  return s;
}

async function fetchBooksPool(
  supabase: SupabaseClient,
  query: string,
): Promise<BookRow[]> {
  const sel =
    "id,title,author,category,publication_year,description,available_quantity,quantity,created_at";
  // PostgREST .or() 以逗号分隔条件，查询里不能含裸逗号
  const q = query.trim().replace(/,/g, " ").slice(0, 56).trim();
  if (q.length >= 1) {
    const esc = escapeIlike(q);
    const { data, error } = await supabase
      .from("books")
      .select(sel)
      .or(
        `title.ilike.%${esc}%,author.ilike.%${esc}%,category.ilike.%${esc}%,description.ilike.%${esc}%`,
      )
      .order("created_at", { ascending: false })
      .limit(FETCH_POOL);
    if (!error && data && data.length > 0) return data as BookRow[];
  }
  const { data: all } = await supabase
    .from("books")
    .select(sel)
    .order("created_at", { ascending: false })
    .limit(FETCH_POOL);
  return (all ?? []) as BookRow[];
}

async function loadReviewStats(
  supabase: SupabaseClient,
): Promise<Map<string, { count: number; sum: number }>> {
  const map = new Map<string, { count: number; sum: number }>();
  const { data, error } = await supabase
    .from("reviews")
    .select("book_id, rating");
  if (error || !data) return map;
  for (const r of data as { book_id: string; rating: number }[]) {
    const cur = map.get(r.book_id) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += Number(r.rating) || 0;
    map.set(r.book_id, cur);
  }
  return map;
}

function rankBooks(
  books: BookRow[],
  query: string,
  reviewMap: Map<string, { count: number; sum: number }>,
): BookRow[] {
  const q = query.trim();
  const scored = books.map((b) => {
    const r = reviewMap.get(b.id) ?? { count: 0, sum: 0 };
    const avg = r.count > 0 ? r.sum / r.count : 0;
    const rel = relevanceScore(b, q);
    const hot = r.count * 100 + avg * 15 + rel;
    return { b, hot };
  });
  scored.sort((x, y) => y.hot - x.hot);
  return scored.map((x) => x.b);
}

function toBookPayload(b: BookRow): BookPayload {
  const blurb = (b.description ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  return {
    id: b.id,
    title: b.title,
    blurb: blurb || "暂无简介",
  };
}

function formatBatchForPrompt(batch: BookRow[]): string {
  return batch
    .map((b, i) => {
      const snip = (b.description ?? "").replace(/\s+/g, " ").slice(0, 70);
      return `${i + 1}. id=${b.id} 《${b.title}》 ${b.author} ${b.category ?? ""} ${snip}`;
    })
    .join("\n");
}

async function buildAuthSupabase(
  req: Request,
): Promise<{ supabase: SupabaseClient } | { error: string }> {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { error: "未登录" };
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return { error: "缺少 Supabase 配置" };
  }
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  return { supabase };
}

async function generalSystemPrompt(req: Request): Promise<string> {
  const r = await buildAuthSupabase(req);
  if ("error" in r) {
    return "你是图书馆网站助手。用户似乎未登录，请简短提醒登录后再查询馆藏。不要编造图书。";
  }
  return [
    "你是图书馆网站助手，语气友好简洁。",
    "若用户未明确问馆藏/图书，可正常闲聊；若问到具体图书库存，请提示用户用「找科幻小说」这类问题以便查询书目。",
    "不要编造本馆不存在的书名。",
  ].join("");
}

async function runLlm(
  llmMessages: Msg[],
  bodyModel: string | undefined,
): Promise<{ content: string } | { error: string; status: number; detail: string }> {
  const provider = (Deno.env.get("CHAT_PROVIDER") ?? "deepseek")
    .toLowerCase()
    .trim();

  if (provider === "ollama") {
    const rawBase =
      Deno.env.get("OLLAMA_BASE_URL") ?? "http://host.docker.internal:11434/api";
    const baseUrl = rawBase.replace(/\/$/, "");
    const ollamaKey = Deno.env.get("OLLAMA_API_KEY");
    const model =
      bodyModel ?? Deno.env.get("OLLAMA_MODEL") ?? "gemma4:e2b";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ollamaKey) headers.Authorization = `Bearer ${ollamaKey}`;
    const ollamaRes = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: llmMessages,
        stream: false,
      }),
    });
    const text = await ollamaRes.text();
    if (!ollamaRes.ok) {
      return {
        error: "Ollama request failed",
        status: 502,
        detail: text.slice(0, 2000),
      };
    }
    try {
      const p = JSON.parse(text) as { message?: { content?: string } };
      const c = p.message?.content;
      if (typeof c !== "string") {
        return { error: "bad ollama shape", status: 502, detail: text.slice(0, 400) };
      }
      return { content: c };
    } catch {
      return { error: "ollama json", status: 502, detail: text.slice(0, 400) };
    }
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return {
      error: "Missing DEEPSEEK_API_KEY",
      status: 500,
      detail: "配置 DEEPSEEK_API_KEY 或 CHAT_PROVIDER=ollama",
    };
  }
  const baseRaw = Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com";
  const baseUrl = baseRaw.replace(/\/$/, "");
  const model =
    bodyModel ?? Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const dsRes = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: llmMessages, stream: false }),
  });
  const text = await dsRes.text();
  if (!dsRes.ok) {
    return {
      error: "DeepSeek request failed",
      status: 502,
      detail: text.slice(0, 2000),
    };
  }
  try {
    const parsed = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const c = parsed.choices?.[0]?.message?.content;
    if (typeof c !== "string") {
      return { error: "bad deepseek shape", status: 502, detail: text.slice(0, 500) };
    }
    return { content: c };
  } catch {
    return { error: "deepseek json", status: 502, detail: text.slice(0, 400) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  let body: {
    messages?: unknown;
    model?: string;
    bookBatchOffset?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON" }, 400);
  }

  const { messages, model: bodyModel, bookBatchOffset: rawOffset } = body;
  const batchOffset = Math.max(
    0,
    Math.floor(
      typeof rawOffset === "number" && !Number.isNaN(rawOffset) ? rawOffset : 0,
    ),
  );

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonRes({ error: "messages must be a non-empty array" }, 400);
  }

  const openaiMessages = normalizeMessages(messages);
  if (openaiMessages.length === 0) {
    return jsonRes(
      { error: "no valid messages (need user/assistant/system content)" },
      400,
    );
  }

  const dialog = messagesForModel(openaiMessages);
  const lastUser = lastUserContent(dialog);

  if (!isBookIntent(lastUser, batchOffset)) {
    const system = await generalSystemPrompt(req);
    const llmMessages: Msg[] = [
      { role: "system", content: system },
      ...dialog,
    ];
    const out = await runLlm(llmMessages, bodyModel);
    if ("error" in out) {
      return jsonRes(
        { error: out.error, detail: out.detail },
        out.status,
      );
    }
    const emptyBatch: BookBatchMeta = {
      offset: 0,
      pageSize: 0,
      total: 0,
      hasMore: false,
    };
    return jsonRes({
      message: { role: "assistant", content: out.content },
      books: [] as BookPayload[],
      bookBatch: emptyBatch,
    });
  }

  const authClient = await buildAuthSupabase(req);
  if ("error" in authClient) {
    return jsonRes({
      message: {
        role: "assistant",
        content: "请先登录后再查询馆藏书目。",
      },
      books: [],
      bookBatch: {
        offset: 0,
        pageSize: PAGE_SIZE,
        total: 0,
        hasMore: false,
      },
    });
  }

  const { supabase } = authClient;
  const [pool, reviewMap] = await Promise.all([
    fetchBooksPool(supabase, lastUser),
    loadReviewStats(supabase),
  ]);

  const ranked = rankBooks(pool, lastUser, reviewMap);
  const total = ranked.length;
  const slice = ranked.slice(batchOffset, batchOffset + PAGE_SIZE);
  const hasMore = batchOffset + PAGE_SIZE < total;

  const batchMeta: BookBatchMeta = {
    offset: batchOffset,
    pageSize: PAGE_SIZE,
    total,
    hasMore,
  };

  if (slice.length === 0) {
    return jsonRes({
      message: {
        role: "assistant",
        content:
          total === 0
            ? "当前没有可展示的图书记录，或没有符合您描述的书目。您可以换个关键词试试。"
            : "已经没有更多符合当前条件的图书了，可以换个说法重新搜索。",
      },
      books: [],
      bookBatch: batchMeta,
    });
  }

  const booksOut = slice.map(toBookPayload);
  const catalogHint = formatBatchForPrompt(slice);

  const systemBook = [
    "你是图书馆智能助手。下面「本轮卡片」中的图书会由网页以**带链接的卡片**展示，每本书含书名与短简介。",
    "",
    "写作要求（必须遵守）：",
    "1. 仅用 2～4 句中文作答，语气自然。",
    "2. **禁止**使用 Markdown 列表、星号、项目符号、编号清单；**禁止**在正文里重复逐本写出书名、作者、出版年等（界面已展示）。",
    "3. 只可概括推荐理由、阅读顺序或共同点；不要编造下列以外的图书。",
    "",
    "【本轮卡片将展示的图书（仅供你把握主题，勿在回复中展开书目）】",
    catalogHint,
  ].join("\n");

  const llmMessages: Msg[] = [
    { role: "system", content: systemBook },
    ...dialog,
  ];

  const out = await runLlm(llmMessages, bodyModel);
  if ("error" in out) {
    return jsonRes(
      { error: out.error, detail: out.detail },
      out.status,
    );
  }

  return jsonRes({
    message: { role: "assistant", content: out.content },
    books: booksOut,
    bookBatch: batchMeta,
  });
});
