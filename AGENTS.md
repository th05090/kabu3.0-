# Agent Rules

## 1. Git & Versioning
- **NEVER AUTO-COMMIT**: 自動コミット絶対禁止。`git add .` 後、変更内容を報告しユーザーの明示指示を待つこと。
- **DYNAMIC VERSIONING**: バージョンは `git describe --tags --abbrev=0` および `git log -n 3` から動的取得。
- **COMMIT FORMAT**: `type(scope): VERSION Title` (例: `feat(ui): V1.3.1 モーダル修復`) + 箇条書き本文。
## 2. Communication & Language
- **JAPANESE ONLY**: Changelog、コミット、報告、ドキュメントはすべて日本語。
- **NO BLIND "DONE"**: 単なる「完了しました」報告は禁止。必ず「5. 完了前検証」のエビデンスを添えること。
- **NO SPEC SPECULATION & FACT-BASED**: 推測に基づく独断アレンジ禁止。不具合指摘時は必ずログ・DB実測値を取得して根拠に基づき会話すること。
## 3. General Principles (SSOT / YAGNI / KISS)
- **SINGLE SSOT (`SPEC.md`)**: プロジェクト全体の唯一の絶対的正解仕様書はルート直下の `SPEC.md`（単一ドキュメント）とする。`SPEC.md` には抽象的表現を禁止し、DBスキーマ・TypeScript型定義・変数抽出元・物理計算式・システム定数・API仕様・コンポーネント構造の「システムのすべて」を機械的かつ全網羅的に記述・維持すること。
- **YAGNI & DEAD CODE CLEANUP**: 旧仕様の判定・型・関数・不要コードはその日のうちに100%完全削除すること。
- **PROTECT EXISTING UI/FUNCTIONS**: 既存UI機能（ソート、セパレート表示等）やデザインを修正時に勝手に破壊・削除しないこと。
- **SYSTEM-SPECIFIC KB (`src/data/docs/<system_name>_user_guide.md`)**: ユーザー向け解説ドキュメントは機能・システムごとに `src/data/docs/` 配下に個別ファイルとして作成し、画面の操作方法や指標の投資的意味を解説すること。
## 4. Code Generation & Safety
- **NO CODE TRUNCATION**: 編集時に `// ... rest of code` 等の省略コメントでコードやコメントを壊さないこと。
- **NO SYMPTOM MASKING**: `try-catch` やダミー値（`|| 0`）でのエラー隠蔽禁止。根本原因（Upstream）を修正すること。
- **SMALL STEPS**: 複数ファイルの巨大一括変更を避け、1機能ごとに変更・検証を反復すること。
## 5. Verification Before Response (完了前3重チェック)
AIは完了報告の前に、以下3点の実行・合格ログを提示しなければならない：
1. `npx tsc --noEmit` エラー 0 件
2. バックエンド計算値とフロント表示数値の100%一致
3. デッドコード・旧判定の完全不存在
## 6. Architecture & Documentation
- **ROOT CLEANLINESS**: 一時検証スクリプトは `scratch/` へ配置。
- **MODULE SEPARATION & COMPONENT**: 300行超える前に早期分離。コンポーネントは `features/<domain>/` へ整理。
- **KB SYNC**: スキーマ・コア判定・新機能追加時は `SPEC.md` および `src/data/docs/` 内の個別KBドキュメントを即座に同時更新すること。
## 7. Framework Specific
<!-- BEGIN:nextjs-agent-rules -->
# Next.js Guidelines
- Next.jsのバージョン固有仕様に従うこと。記述前に `node_modules/next/dist/docs/` を確認すること。
<!-- END:nextjs-agent-rules -->
