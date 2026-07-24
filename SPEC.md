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
*(※機能追加時に随時追記・更新する)*

## 8. アーキテクチャ・設計ガイドライン

### 8.1 データパイプライン（バッチ処理）の設計
- **履歴蓄積・再計算**: J-Quants API等からの履歴蓄積、および `stocks` テーブルの再計算処理は、フロントエンドやNext.jsのAPI Routesからは切り離し、**別プロセスのNode.jsスクリプトとして独立**させること（例: `src/scripts/run_sync.ts` などに配置し、Node/Cronで実行する）。
- **AI・RAGパイプライン (Gemma3 + Docling)**: 決算PDFからハルシネーションのない抽出を行うため、`src/scripts/analyze_stock.ts` にて以下の処理を行う。
  1. `docling` (Python/CUDA環境) を用いたPDFの高精度Markdown化 (`src/scripts/pdf_to_md_docling.py`)
  2. 前回・今回資料のコンテキスト分離 (時期混同によるハルシネーションの防止)
  3. ローカルの `Gemma3:12B` によるJSON厳格抽出。SSOTプロンプト仕様として以下の**7つの厳守事項**を適用する：
     - ① 改行の絶対禁止（JSONパースエラー防止）
     - ② 箇条書きは「・」で1行にまとめる
     - ③ 推測の禁止（記載がない場合は「記載なし」）
     - ④ 1行＝短文ではなく、文字数を惜しまない詳細な長文の要求
     - ⑤ 抽象的表現の禁止（具体的な数値の引用必須）
     - ⑥ 単位の勝手な変換禁止（百万円単位のままなど）
     - ⑦ AI自身による足し算・引き算など計算の完全禁止
  4. 抽出データは以下の4軸JSONフォーマットに従う：
     - `current_performance`: 当期実績の評価（強みと弱みの統合）
     - `future_guidance`: 次期業績見通し（課題・リスク要因）
     - `report_comparison`: 前回と今回の定性的なトーン変化の比較（※数値の直接比較・記載は禁止）
     - `ai_comment`: アナリストとしての総合オピニオン
- **一時スクリプト**: 一時的な検証や実験用のスクリプトは `scratch/` ディレクトリに配置し、本番のバッチロジックとは明確に分離する。

### 8.2 フロントエンドの状態管理とテーブル描画
- **状態管理**: 全銘柄スクリーナー等の複雑なフィルタ条件やUI状態の管理には、Zustand、Jotai、またはReact Contextを要件に応じて選定・利用する。過度なProp Drillingを避けること。
- **テーブル描画 (仮想化)**: 全銘柄（約4,000銘柄）を一度にDOMにレンダリングすると深刻なパフォーマンス低下を引き起こすため、大量データのテーブル描画時には必ず仮想化ライブラリ（例: TanStack Table, React Virtualized 等）の利用を検討・実装すること。

### 8.3 エラーハンドリングとロギング
- **API取得時のリトライロジック**: J-Quantsなどの外部API連携では「レートリミット（429エラー）」「予期せぬタイムアウト」などが頻発する。フェッチロジックには適切なリトライ処理（Exponential Backoffなど）を組み込むこと。
- **異常値とゼロ除算のハンドリング**: 金融データ特有の「前期赤字からの成長率（ゼロ除算・マイナス除算）」「上場直後で過去データが存在しない場合」等の計算エラー発生時は、システムクラッシュを避けるため、デフォルト値として `NULL` を設定して適切にハンドリングすること（ダミー値の `0` による隠蔽は禁止）。
- **株式分割時の異常値**: 株式分割の検知時は必ず過去データの遡及調整（AdjFactor適用）を行い、テクニカル指標（SMA、モメンタム等）の計算に異常値が混入しないように徹底すること。
