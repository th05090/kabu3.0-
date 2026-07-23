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
- `long_term_trend` (TEXT): 長期トレンド
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
- `is_high_60d_update` (BOOLEAN): 60日高値更新

## 5. TypeScript型定義 (Core Types)
*(※機能追加時に随時追記・更新する)*

## 6. システム定数・環境変数
- **ポート番号**: 3000 (デフォルト)
- **DBファイルパス**: `file:local.db` (ローカルSQLiteファイル)

## 7. API仕様
*(※機能追加時に随時追記・更新する)*
