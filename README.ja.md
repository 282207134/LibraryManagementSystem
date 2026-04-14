# 図書管理システム（Library Management System）

React + TypeScript + Supabase を基盤とした図書管理システムです。利用者向け画面、管理者画面、貸出/返却・お気に入り・レビュー機能、そして Edge Function ベースの AI アシスタントを含みます。

## 技術スタック

- React 19 + TypeScript 5
- Vite 7 + Tailwind CSS 4
- React Router 7
- Supabase（Auth / PostgreSQL / Storage / Edge Functions）

## 実装済み機能

- 認証：ログイン、登録、パスワード忘れ、パスワード再設定
- 利用者画面：ダッシュボード、蔵書一覧、書籍詳細、貸出履歴、お気に入り、プロフィール
- 管理者画面：図書管理（CRUD）、貸出記録管理
- 業務機能：貸出/返却 RPC、お気に入り、レビュー評価、表紙アップロード
- 多言語：中文 / English / 日本語 の切り替え
- AI アシスタント：`ai-chat` Edge Function + フロントカード表示 + ページング推薦

## ルーティング（現行実装）

- 未ログイン：
  - 同一ルート内でログイン/登録を切り替え表示
  - `/reset-password` は直接アクセス可能
- ログイン済み利用者：
  - `/user/dashboard`
  - `/user/home`、`/user/books`
  - `/user/books/:id`
  - `/user/my-borrowings`
  - `/user/my-favorites`
  - `/user/profile`
- 管理者専用：
  - `/admin/dashboard`
  - `/admin/borrowings`

## クイックスタート

1. 依存関係をインストール

```bash
npm install
```

1. 環境変数ファイルをコピー

```bash
cp .env.example .env
```

1. `.env` に以下を設定

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

1. `部署指南.md` を参照して DB / RLS / Storage を設定

1. 開発サーバーを起動

```bash
npm run dev
```

デフォルトアクセス先：`http://localhost:5173`

## よく使うスクリプト

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

### Edge Function（AI アシスタント）関連

```bash
npm run supabase:functions:serve
npm run supabase:cloud:secrets
npm run supabase:functions:deploy
```

> 注意：`package.json` の `--project-ref` は自分の Supabase プロジェクトに合わせてください。

## 環境変数一覧

| 変数 | 配置場所 | 用途 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ルート `.env` | フロントエンド接続先 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | ルート `.env` | フロントで使用する匿名 key（公開可） |
| `CHAT_PROVIDER` | `supabase/functions/.env` | `deepseek` または `ollama` |
| `DEEPSEEK_API_KEY` | `supabase/functions/.env` | DeepSeek API key（関数側のみ） |
| `OLLAMA_BASE_URL` | `supabase/functions/.env` | Ollama API URL |

## セキュリティ要点

- フロントでは `anon` key のみ使用し、`service_role` は配置しない
- モデル API key は `supabase/functions/.env` とクラウド secrets のみに保持
- 権限制御は RLS + RPC を最終基準とし、フロントのルートガードは補助

## 関連ドキュメント

- [部署指南](./部署指南.md)
- [データベース文書](./DATABASE.md)
- [Supabase テーブル/SQL 方針](./SUPABASE_TABLES_PROPOSAL.md)
- [プロジェクト設計書](./项目设计书.md)
- [UI 設計文書](./USER_INTERFACE_DESIGN.md)
- [AI アシスタント説明](./AI_ASSISTANT.md)
