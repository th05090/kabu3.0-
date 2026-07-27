# kabu3.0 総合仕様書 (SSOT)

本ドキュメントは `kabu3.0` プロジェクトの唯一の絶対的正解仕様書 (Single Source of Truth) である。
コードベースのすべての仕様（DBスキーマ・TypeScript型定義・変数抽出元・物理計算式・システム定数・API仕様・コンポーネント構造等）は、ここに機械的かつ全網羅的に記述・維持されなければならない。

## 1. プロジェクト概要
- **システム名称**: kabu3.0
- **目的**: 株式投資における全銘柄のスクリーニング、テーマ分析、個別銘柄分析、ポートフォリオ管理、およびバックテストを統合的に行う高度な分析・管理Webアプリケーション。
- **技術スタック**: Next.js (App Router), React, TypeScript, Vanilla CSS, @libsql/client (SQLite), recharts, lucide-react

## 2. ディレクトリ構造・アーキテクチャ
- `src/app/` : Next.js App Router (ページルーティング、APIルート)
- `src/components/` : 汎用UIコンポーネント (Button, Table, Modal, etc.)
- `src/features/<domain>/` : ドメイン・機能ごとの固有コンポーネント群 (300行を超える前に早期分離)
  - `screener` : 全銘柄スクリーニング表、フィルタ機能
  - `analysis` : 個別銘柄分析、チャート、AI決算分析
  - `theme` : テーマ作成、テーマ判定、各種バブルチャート・ツリーマップ等
  - `alert` : 買いシグナル管理（決算モメンタム、テクニカル、テーマ）
  - `portfolio` : 損益トラッキング、撤退ライン管理、キルスイッチ
  - `backtest` : 株式分割・単元未満株・スリッページを考慮したバックテストエンジン
- `src/lib/` : 汎用ユーティリティ関数
- `src/data/docs/` : ユーザー向け解説ドキュメント (KB)
  - `<system_name>_user_guide.md` の形式で配置。
- `scratch/` : 一時検証スクリプト用ディレクトリ
- `Agent.md` : 開発エージェント向けの厳格なルール定義ファイル

## 3. 開発ロードマップ (フェーズ定義)
- **Phase 1**: 全銘柄スクリーナー（表とフィルタ機能）の構築
- **Phase 1.5**: 実データ取得・履歴蓄積基盤の構築 (J-Quants API Bulk)
- **Phase 2**: 個別銘柄分析（指標推移、チャート表示）の構築
- **Phase 3**: AIテーマ判定およびテーマ分析（ツリーマップ、バブルチャート等）の実装
- **Phase 4**: 購入関連システム（アラート管理、ポートフォリオ管理、バックテスト）の実装

## 4. データベーススキーマ (SQLite)

### 履歴保存用テーブル群 (Phase 1.5以降の主軸)
APIから取得した元データを蓄積し、計算ロジックのベースとなるテーブル。

#### `equities_master` (銘柄基本情報)
- `ticker` (TEXT PK): 銘柄コード
- `name` (TEXT): 銘柄名
- `market` (TEXT): 市場区分
- `industry` (TEXT): 業種 (17業種または33業種)
- `summary` (TEXT): 抽出・生成された事業要約テキスト (手動補正対応)
- `gics_sub_industry_id` (TEXT): Qdrantベクトル検索で自動判定されたGICS細分類ID
- `last_updated` (TEXT): 最終更新日時

#### `daily_quotes` (日足データ)
- `ticker` (TEXT)
- `date` (TEXT)
- `open` (REAL), `high` (REAL), `low` (REAL), `close` (REAL): 四本値
- `volume` (REAL): 出来高
- `turnover` (REAL): 売買代金
- PK: `(ticker, date)`

#### `financials` (財務情報)
- `ticker` (TEXT)
- `date` (TEXT): 開示日など
- `net_sales` (REAL): 売上高
- `operating_profit` (REAL): 営業利益
- `profit` (REAL): 当期純利益
- `equity_to_asset_ratio` (REAL): 自己資本比率
- `shares_outstanding` (REAL): 発行済株式数
- `forecast_net_sales` (REAL): 予想売上高
- `forecast_operating_profit` (REAL): 予想営業利益
- `forecast_profit` (REAL): 予想当期純利益
- `forecast_dividend` (REAL): 予想1株あたり配当
- `eps` (REAL): 1株あたり利益(EPS)
- `adj_eps` (REAL): 株式分割調整後EPS
- `adj_dividend` (REAL): 株式分割調整後配当
- `adj_shares_outstanding` (REAL): 株式分割調整後発行済株式数
- `ordinary_profit` (REAL): 経常利益
- `total_assets` (REAL): 総資産
- `equity` (REAL): 自己資本
- `operating_cash_flow` (REAL): 営業CF
- `investing_cash_flow` (REAL): 投資CF
- `financing_cash_flow` (REAL): 財務CF
- `cash_and_equivalents` (REAL): 現金及び預金
- PK: `(ticker, date)`

#### `shikiho_profiles` (四季報・事業インデックス)
- `ticker` (TEXT PK): 銘柄コード
- `original_feature` (TEXT): 四季報の「特色」生テキスト
- `index_summary` (TEXT): LLM(Gemma)で無機質化・構造化された機能的価値の要約
- `index_keywords` (TEXT): 抽出されたキーワード群

### `stocks` テーブル (Phase 1: Screener用高速スナップショット)
履歴データからテクニカル・ファンダメンタル計算を行い、最新状態のみを保持するテーブル。UI表示に直結。

#### 銘柄基本情報
- `ticker` (TEXT PK): 銘柄コード
- `name` (TEXT): 銘柄名
- `market` (TEXT): 市場
- `industry` (TEXT): 業種
- `theme` (TEXT): テーマ（初期は業種と同値）
- `theme_score` (REAL): テーマ点

#### 株価・売買代金
- `current_price` (REAL): 現在株価
- `market_cap` (REAL): 時価総額(億円)
- `avg_trading_value_5d` (REAL): 5日平均売買代金(億円)
- `volume_ratio` (REAL): 出来高倍率
- `trading_value_ratio` (REAL): 売買代金倍率

#### ファンダメンタル指標
- `revenue_growth_pct` (REAL): 売上成長率% (今期予想 ÷ 前回本決算実績 - 1)
- `operating_profit_growth_pct` (REAL): 営利成長率% (前期赤字の場合は NULL)
- `operating_margin_pct` (REAL): 営業利益率%
- `eps_growth_pct` (REAL): EPS成長率% (前期赤字の場合は NULL)
- `equity_ratio_pct` (REAL): 自己資本比率%
- `operating_cf` (REAL): 営業CF
- `dividend_yield_pct` (REAL): 配当利回り%

#### 決算関連
- `forecast_achievement_pct` (REAL): 予想達成率
- `earnings_reaction_pct` (REAL): 決算反応%
- `post_earnings_rise_pct` (REAL): 決算後上昇%
- `drop_from_post_earnings_high_pct` (REAL): 決算後高値から下落%
- `earnings_category` (TEXT): 決算区分
- `earnings_date` (TEXT): 決算日
- `days_since_earnings` (INTEGER): 決算後日数
- `next_earnings_date_prediction` (TEXT): 次回決算日予測
- `remaining_business_days` (INTEGER): 残り営業日

#### テクニカル指標・トレンド
- `sma_25` (REAL): 25日線
- `is_above_sma_25` (BOOLEAN): 25日線上かどうか
- `sma_25_deviation_pct` (REAL): 25日乖離%
- `is_above_sma_75` (BOOLEAN): 75日線上かどうか
- `is_above_sma_200` (BOOLEAN): 200日線上かどうか
- `long_term_trend` (TEXT): 長期トレンド (75日線と200日線が両方上向きか等)
- `high_52w` (REAL): 52週高値
- `high_52w_deviation` (REAL): 52週高値乖離
- `distance_to_high_52w_pct` (REAL): 52週高値距離%
- `is_high_52w_update` (BOOLEAN): 52週高値更新

#### 追加フィルタ用指標
- `is_perfect_order` (BOOLEAN): パーフェクトオーダー
- `is_golden_cross` (BOOLEAN): ゴールデンクロス
- `rsi` (REAL): RSI
- `roc` (REAL): ROC
- `return_5d_pct` (REAL): 5日騰落率
- `return_20d_pct` (REAL): 20日騰落率
- `is_high_20d_update` (BOOLEAN): 20日高値更新
#### リスク・ボラティリティ指標
- `atr_14` (REAL): 14日ATR
- `atr_pct` (REAL): ATR/株価 (%)
- `stop_loss_2atr` (REAL): 2ATR損切ライン
- `stop_loss_3atr` (REAL): 3ATR損切ライン
- `max_drawdown` (REAL): 最大ドローダウン
- `volatility` (REAL): ボラティリティ

#### バリュエーション指標
- `per` (REAL): 株価収益率 (PER)
- `pbr` (REAL): 株価純資産倍率 (PBR)
- `psr` (REAL): 株価売上高倍率 (PSR)
- `roe` (REAL): 自己資本利益率 (ROE)
- `roa` (REAL): 総資産利益率 (ROA)

#### テクニカル分析追加
- `macd` (REAL): MACD
- `macd_signal` (REAL): MACDシグナル

## 5. TypeScript型定義 (Core Types)
*(※機能追加時に随時追記・更新する)*

## 6. システム定数・環境変数
- **ポート番号**: 3000 (デフォルト)
- **DBファイルパス**: `file:local.db` (ローカルSQLiteファイル)

## 7. API仕様
- **Next.js App Router (Route Handlers)** を利用してフロントエンド向けのBFF (Backend For Frontend) APIを構築する。
- RESTful原則に従い、リソース指向のエンドポイント設計とする（例: `GET /api/stocks`, `GET /api/stocks/[ticker]`）。
- **`POST /api/stocks/[ticker]/summary`**: 個別銘柄の事業要約手動補正用エンドポイント。ユーザーが編集した要約を受け取り、`equities_master` を更新、再度Ollamaでベクトル化してQdrantでGICS分類を再判定し、結果を保存する一連のハイブリッド更新処理を行う。

## 8. アーキテクチャ・設計ガイドライン

### 8.1 データパイプライン（バッチ処理）の設計
- **履歴蓄積・再計算**: J-Quants API等からの履歴蓄積、および `stocks` テーブルの再計算処理は、フロントエンドやNext.jsのAPI Routesからは切り離し、**別プロセスのNode.jsスクリプトとして独立**させること（例: `src/scripts/run_sync.ts` などに配置し、Node/Cronで実行する）。
  - **差分同期（Incremental Sync）**: J-Quants APIからのバルクデータ取得時は、毎回全件取得するのではなく、ローカルDBに新設した `sync_history` テーブルを活用し、未取得の新規ファイルのみを抽出してダウンロード・パースする差分同期ロジックを実装済み。
  - **株式分割の遡及調整**: 日足データ等の取得時に `AdjFactor` を検知した場合、新規の差分ファイルからであっても過去の全履歴データ（日足・財務）に対して自動で係数調整（UPDATE）が行われる設計となっている。
- **AI・RAGパイプライン (Gemma3 + Qdrant ハイブリッド検索)**: 決算PDFからハルシネーションのない抽出を行うため、`src/scripts/analyze_stock_rag.ts` を中心とした以下のRAGアーキテクチャを稼働させる。
  1. **Markdown解析**: `docling` (Python/CUDA環境) を用いたPDFの高精度Markdown化 (`src/scripts/pdf_to_md_docling.py`)
  2. **見出しベースのチャンキング (Header-Aware Chunking)**: 表や文脈の分断を防ぐため、Markdownの見出し（`#`, `##`）単位でセクションを切り出し、パンくずリストメタデータ（`[大項目 > 中項目]`）を付与してチャンク化（`src/scripts/rag/chunker.ts`）。
  3. **Embedding**: `Ollama` 経由で日本語特化の `bge-m3:latest` モデルを使用し、チャンクを1024次元ベクトルに変換（`src/scripts/rag/embedder.ts`）。
  4. **ベクトルDB (Qdrant) 保存**: ローカル稼働の Qdrant に対して、ベクトルとテキストペイロード（BM25 Full-textインデックス付き）を格納。メタデータとして「対象時期（prev/latest）」「銘柄コード」を付与（`src/scripts/rag/qdrant.ts`）。
  5. **ハイブリッド検索 (Reciprocal Rank Fusion; RRF)**: Qdrantの Query API などを駆使し、「密ベクトル（Dense）による意味的類似度スコア」と「疎ベクトル/BM25による完全キーワード一致スコア」のランクを融合（RRF）させ、検索漏れとノイズの両方を極限まで排除。
  6. **2段階パイプライン（Gemma3:12B）による高精度出力**: 12Bモデルの計算・単位変換のハルシネーションを防ぎつつ、プロの文章クオリティを担保するため、抽出と清書を分離した2段階プロセスを実行する。
     - **Step 1 (ファクト抽出)**: 「無機質なデータ転記ボット」として、単位変換を一切行わずに数値などの事実をJSON配列として抽出する。この際、「金額単位変換の絶対禁止」「推測の排除」を厳守させる。
     - **TS側での単位パース**: Step 1で抽出されたJSON内の「50,684,952百万円」などの文字列を、正規表現により「50兆6849億5200万円」といった日本語の通貨単位に正確にパース・置換する。その後、Step 2がサボって配列をそのまま出力しないよう、プレーンテキストの形式に変換する。
     - **Step 2 (アナリスト清書)**: 「プロの証券アナリスト」として、パース済みのファクトデータのみを情報源とし、専門用語を用いた高度な文章に清書する。ここではすべての出力を「プレーンテキストの文字列（String）」として出力するよう強制し、配列やオブジェクトの使用を禁ずる。
  7. 抽出データは以下の4軸JSONフォーマット（String型）に従う：
     - `current_performance`: 当期実績の評価（強みと弱みの統合）
     - `future_guidance`: 次期業績見通し（課題・リスク要因）
     - `report_comparison`: 前回と今回の定性的なトーン変化の比較（※事前知識の使用禁止）
     - `ai_comment`: アナリストとしての総合オピニオン（インプリケーションの提示）
- **一時スクリプト**: 一時的な検証や実験用のスクリプトは `scratch/` ディレクトリに配置し、本番のバッチロジックとは明確に分離する。

### 8.4 テーマ抽出と動的テーマの設計 (Shikiho & RAG)
- **ハイブリッド要約パイプライン**: 決算書PDFのRAGだけでは事業の実態が抽象化される問題を防ぐため、以下の2段階プロセスを採用する。
  1. **四季報クレンジング (`run_shikiho_index_batch.ts`)**: 四季報の「特色」テキストから、取引先名や装飾語（ノイズ）をLLMで排除し、純粋な機能的価値（キーワードと要約）として `shikiho_profiles` テーブルへ保存。
  2. **PDF表データ・事業内容抽出 (`run_theme_batch.ts`)**: Qdrant（決算書PDF）に対して「表」をベクトル検索してセグメントと売上高を特定（Pass 1）。続いて各セグメント名を検索クエリとして事業内容を深堀り（Pass 2）。
  3. **最終統合**: PDFからのセグメント情報と、四季報からの無機質な機能的価値をLLMに同時入力し、1文の事業要約と主幹テーマを生成する。
- **動的テーマ検索 (Semantic Search)**: ユーザーの自由な自然言語（例：「円安メリット」「AIを活用した検査」）による銘柄検索を実現するため、Step 2で生成した「事業要約 ＋ 四季報キーワード」の純度の高いテキストをベクトル化（`bge-m3`）し、Qdrantの `company_profiles` コレクションへ保存する。これによりハルシネーションやノイズのない高度な意味検索が可能になる。
- **GICS分類マッピング (Vector Classification)**: 主幹テーマの決定において、LLMの推論に依存せず、Qdrant上にGICS（世界産業分類基準）の各分類名と詳細説明ベクトルを格納した `gics_categories` コレクションを作成する。企業のプロフィールベクトルとGICSベクトルのCosine類似度を計算して最も近い分類を特定し、TypeScriptの辞書で上位階層（大・中分類）を逆引きする完全決定論的アーキテクチャを採用する。

### 8.5 フロントエンドの状態管理とテーブル描画
- **状態管理**: 全銘柄スクリーナー等の複雑なフィルタ条件やUI状態の管理には、Zustand、Jotai、またはReact Contextを要件に応じて選定・利用する。過度なProp Drillingを避けること。
- **テーブル描画 (仮想化)**: 全銘柄（約4,000銘柄）を一度にDOMにレンダリングすると深刻なパフォーマンス低下を引き起こすため、大量データのテーブル描画時には必ず仮想化ライブラリ（例: TanStack Table, React Virtualized 等）の利用を検討・実装すること。

### 8.3 エラーハンドリングとロギング
- **API取得時のリトライロジック**: J-Quantsなどの外部API連携では「レートリミット（429エラー）」「予期せぬタイムアウト」などが頻発する。フェッチロジックには適切なリトライ処理（Exponential Backoffなど）を組み込むこと。
- **異常値とゼロ除算のハンドリング**: 金融データ特有の「前期赤字からの成長率（ゼロ除算・マイナス除算）」「上場直後で過去データが存在しない場合」等の計算エラー発生時は、システムクラッシュを避けるため、デフォルト値として `NULL` を設定して適切にハンドリングすること（ダミー値の `0` による隠蔽は禁止）。
- **株式分割時の異常値**: 株式分割の検知時は必ず過去データの遡及調整（AdjFactor適用）を行い、テクニカル指標（SMA、モメンタム等）の計算に異常値が混入しないように徹底すること。また、遡及調整のUPDATE処理は必ず「適用済みの分割記録」を事前チェックし、二重適用を防ぐこと（冪等性の担保）。
