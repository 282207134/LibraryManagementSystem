# AI Assistant Guide

This document describes the current AI assistant implementation in this project.

## Overview

- Frontend UI: `src/components/assistant/ChatAssistant.tsx`
- Mounted from: `src/components/user/UserLayout.tsx`
- Edge Function: `supabase/functions/ai-chat/index.ts`
- Invocation method: `supabase.functions.invoke("ai-chat", { body })`

The function detects book-related intent, queries `books` and `reviews`, ranks results by relevance and popularity, and returns paged book cards.

## Related Files

```text
supabase/functions/ai-chat/index.ts
supabase/functions/.env.example
supabase/functions/.env
src/components/assistant/ChatAssistant.tsx
src/components/user/UserLayout.tsx
```

## Environment Variables

### Frontend (`.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |

### Edge Function (`supabase/functions/.env`)

| Variable | Purpose |
| --- | --- |
| `CHAT_PROVIDER` | `deepseek` or `ollama` |
| `DEEPSEEK_API_KEY` | Required when using DeepSeek |
| `DEEPSEEK_MODEL` | Default: `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | Optional base URL |
| `OLLAMA_BASE_URL` | Ollama API base URL |
| `OLLAMA_MODEL` | Ollama model id |
| `OLLAMA_API_KEY` | Optional for hosted Ollama |

Do not put model secrets in any `VITE_*` variable.

## Request and Response

### Request body

```json
{
  "messages": [{ "role": "user", "content": "recommend sci-fi books" }],
  "bookBatchOffset": 0
}
```

### Response body (main fields)

```json
{
  "message": { "role": "assistant", "content": "..." },
  "books": [{ "id": "...", "title": "...", "blurb": "..." }],
  "bookBatch": { "offset": 0, "pageSize": 5, "total": 20, "hasMore": true }
}
```

## Cloud Deployment

1. Fill `supabase/functions/.env`
1. Sync secrets:

```bash
npm run supabase:cloud:secrets
```

1. Deploy function:

```bash
npm run supabase:functions:deploy
```

1. Run frontend and verify:

```bash
npm run dev
```

Make sure `--project-ref` in `package.json` matches your actual Supabase project.

## Local Function Debug

```bash
npx supabase@latest start
npm run supabase:functions:serve
```

## Troubleshooting

- `Edge Function returned a non-2xx`
  - Check HTTP status and response body
  - Common causes: not deployed, not authenticated, secrets not synced
- `Missing DEEPSEEK_API_KEY`
  - Provide key when `CHAT_PROVIDER=deepseek`
- Ollama connection error in cloud
  - Cloud functions cannot access local `127.0.0.1`
- `.env` parsing issues
  - Use UTF-8 encoding and keep formatting clean

## Security Notes

- Keep model keys on function side only
- Rotate keys immediately if leaked
- Keep `supabase/functions/.env` out of git
