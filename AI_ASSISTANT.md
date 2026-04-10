# AI 图书馆助手：配置、部署与使用说明

本文档整理本项目中 **Supabase Edge Function `ollama-chat` + 前端 `ChatAssistant`** 的架构、环境变量、部署命令与使用方式。

---

## 1. 架构概览

| 层级 | 作用 |
|------|------|
| **前端** | `src/components/assistant/ChatAssistant.tsx`，挂在 `UserLayout`，调用 `supabase.functions.invoke('ollama-chat', { body })`。 |
| **Edge Function** | `supabase/functions/ollama-chat/index.ts`，在服务端持有大模型密钥，按用户 JWT 查询 `books` / `reviews`，调用 **DeepSeek** 或 **Ollama**，返回文案 + 结构化书目。 |
| **安全原则** | **切勿**把 `DEEPSEEK_API_KEY`、`OLLAMA_API_KEY` 等写入根目录 `VITE_*` 变量；浏览器可见的代码不能带模型密钥。 |

**说明**：函数目录名为 `ollama-chat` 仅为历史命名，与是否使用 Ollama 无关；前端固定 `invoke('ollama-chat')`。

---

## 2. 相关文件

```
supabase/functions/ollama-chat/index.ts   # Edge Function 主逻辑
supabase/functions/.env                   # 本地调试密钥（勿提交 Git）
supabase/functions/.env.example           # 变量说明模板
src/components/assistant/ChatAssistant.tsx
src/components/user/UserLayout.tsx        # 挂载助手
package.json                              # npm 脚本（含 deploy / secrets）
```

根目录 `.env` 仅服务 **Vite**（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`），**不会**被 Edge Function 自动读取。

---

## 3. 环境变量

### 3.1 前端（项目根目录 `.env`）

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL，如 `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 控制台 **Settings → API** 中的 **anon public** 密钥 |

- **云端联调**：填线上项目即可，`invoke` 会请求已部署到**同一项目**的 Edge Function。
- **整站本地 Supabase**：改为 `supabase status` 中的本地 API URL 与 anon key（与云端数据不同步）。

### 3.2 Edge Function（`supabase/functions/.env`）

复制 `.env.example` 为 `.env` 后填写。部署到云端时，通过 `npm run supabase:cloud:secrets` 将其中键值同步为 **Supabase Secrets**。

| 变量 | 说明 |
|------|------|
| `CHAT_PROVIDER` | `deepseek`（默认）或 `ollama` |
| **DeepSeek** | `DEEPSEEK_API_KEY`（必填）、`DEEPSEEK_MODEL`（默认 `deepseek-chat`）、可选 `DEEPSEEK_BASE_URL` |
| **Ollama** | `OLLAMA_BASE_URL`、`OLLAMA_MODEL`、`OLLAMA_API_KEY`（本机常为空；Ollama Cloud 再填） |

部署在 **Supabase 云端**时，运行环境会自动注入 `SUPABASE_URL`、`SUPABASE_ANON_KEY`，用于在函数内用用户 JWT 查询数据库，**无需**在 `.env` 里手写这两项。

**注意**：

- 可同时保留 Ollama 与 DeepSeek 的配置行；实际生效由 `CHAT_PROVIDER` 决定。
- `npm run supabase:cloud:secrets` 会把 `.env` 中**所有** `KEY=value` 推送到云端；不需要的密钥可删行或在 Dashboard 清理。
- 根目录 `.env` 建议使用 **UTF-8 无 BOM**，否则部分环境下 Supabase CLI 解析可能报错（如 `unexpected character '»'`）。

---

## 4. 云端部署（推荐日常流程）

### 4.1 一次性准备

1. 安装 Node.js；Supabase CLI 可用 `npx supabase@latest` 调用，无需全局安装。
2. 登录（任选其一）：
   ```bash
   npx supabase@latest login
   ```
   或使用 [Access Token](https://supabase.com/dashboard/account/tokens)：
   ```bash
   npx supabase@latest login --token <你的令牌>
   ```

### 4.2 同步密钥并部署

在项目根目录：

```bash
# 将 supabase/functions/.env 写入云端 Secrets
npm run supabase:cloud:secrets

# 部署函数（脚本内已带 --use-api，可不依赖本机 Docker）
npm run supabase:functions:deploy
```

> **修改 `package.json`**：脚本中的 `--project-ref` 须与你的 Supabase 项目一致（与 `VITE_SUPABASE_URL` 中的子域对应）。更换项目时请同步修改 `supabase:functions:deploy` 与 `supabase:cloud:secrets` 两行。

### 4.3 验证

1. `npm run dev`，用户登录后进入任意 `/user/...` 页面。
2. AI 助手默认展开；发送一条与图书相关的问题（如「推荐几本科幻小说」）。
3. 若失败，助手会尽量展示 HTTP 状态与错误 JSON；也可在 [Dashboard → Edge Functions](https://supabase.com/dashboard) 查看日志。

---

## 5. 本地调试 Edge Function（可选）

需要 **Docker Desktop** 运行正常。

```bash
npx supabase@latest start
npm run supabase:functions:serve
```

使用 `npx supabase@latest status` 查看本地 **anon key**，用 `curl` 或前端把 `VITE_*` 指向 `http://127.0.0.1:54321` 进行联调。

**本机 Ollama**：在 `supabase/functions/.env` 中设置 `CHAT_PROVIDER=ollama`、`OLLAMA_BASE_URL=http://host.docker.internal:11434/api` 等；云端部署的函数**无法**访问你电脑的 `127.0.0.1:11434`，除非使用 Ollama Cloud 或自建公网入口。

---

## 6. 功能与使用说明

### 6.1 界面行为

- 助手默认**打开**；可点右上角「收起」或右下角 **AI** 按钮收起/再打开。
- **图书类问题**（含书、小说、推荐、科幻、借阅、分类等关键词，或点击「换一批」时的续页）：  
  - 服务端从 `books` 拉候选集，按 **`reviews` 数量与均分、与问题的相关度** 排序（借阅表对普通用户 RLS 通常不可全库统计，故用评论热度近似「热门」）。  
  - 每轮最多返回 **5** 本书的结构化数据：`id`、`title`、`blurb`（简介约 110 字）。  
  - 前端以**卡片**展示：**书名**为链接，跳转 **`/user/books/:id`** 详情页。  
  - 若还有更多匹配结果，显示 **「换一批」**：使用相同对话历史并附带 `bookBatchOffset` 请求下一批。
- **非图书闲聊**（如仅「你好」）：不附带书目卡片，`books` 为空。

### 6.2 调用约定（前端 → Edge Function）

- 普通发送：`body: { messages: [{ role, content }, ...] }`。
- 换一批：`body: { messages: [...], bookBatchOffset: <数字> }`（由上一响应的 `bookBatch` 推算）。

### 6.3 登录与权限

- 查询 `books` 使用请求头中的 **用户 JWT**，与 RLS「登录用户可读 books」一致；**请先登录**后再问馆藏。

---

## 7. 模型提供方选择

| `CHAT_PROVIDER` | 说明 |
|-----------------|------|
| `deepseek`（默认） | 调用 [DeepSeek](https://api.deepseek.com) OpenAI 兼容接口；需配置 `DEEPSEEK_API_KEY`。 |
| `ollama` | 调用 Ollama HTTP API；本地常用 `OLLAMA_BASE_URL=http://host.docker.internal:11434/api`。 |

云端部署时若误设 `ollama` + `host.docker.internal`，边缘节点无法访问你的电脑，请求会失败。

---

## 8. 常见问题排查

| 现象 | 可能原因与处理 |
|------|----------------|
| `Edge Function returned a non-2xx` | 展开详情中的 HTTP 码；404 多为函数未部署或名称错误；401 多为未登录或会话过期。 |
| `Missing DEEPSEEK_API_KEY` | `CHAT_PROVIDER=deepseek` 时必须在 Secrets / `functions/.env` 中配置密钥并 `supabase:cloud:secrets`。 |
| `model 'xxx' not found`（Ollama） | 模型名与当前 `OLLAMA_BASE_URL` 环境不一致（云端与本机模型列表不同）；改为该平台存在的模型 ID 后重新 `secrets`。 |
| CLI 解析 `.env` 报错 | 去掉 UTF-8 BOM；避免键名重复；查询字符串勿含未转义的裸逗号（函数内已对逗号做替换，仍建议避免怪异符号）。 |
| `supabase start` / Docker 失败 | 检查 Docker Desktop、磁盘空间、WSL2；或改用仅 `deploy --use-api` 的云端流程。 |

---

## 9. 与 Supabase MCP 的关系

**Supabase MCP**（在 Cursor 等编辑器中）便于管理项目与配置，**不能替代**：

- Edge Function 代码与部署；
- 模型服务商账号与密钥；
- 前端聊天 UI 与 `invoke` 调用。

---

## 10. 密钥安全

- 不要在聊天、Issue、截图中泄露 API Key；泄露后应**立即轮换**。
- `supabase/functions/.env` 已在 `supabase/.gitignore` 中忽略，请勿手动提交。

---

## 11. 参考命令速查

```bash
# 开发前端
npm run dev

# 生产构建
npm run build

# 云端：同步函数环境变量
npm run supabase:cloud:secrets

# 云端：部署
npm run supabase:functions:deploy

# 本地：启动函数（需 Docker + 通常需先 supabase start）
npm run supabase:functions:serve
```

更多官方说明见：[Supabase Edge Functions](https://supabase.com/docs/guides/functions)。
