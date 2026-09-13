# kabu3.0 仕様書 (SSOT)

## 1. プロジェクト概要 (System Overview)

本ドキュメントは、kabu3.0 システムの「単一の情報源 (SSOT: Single Source of Truth)」として機能する公式仕様書です。
システムの物理構造、データベーススキーマ、AIプロンプトから各計算ロジックに至るまで、すべてのアーキテクチャの仕様を定義します。

### 1.1 システムの目的
kabu3.0 は、個人投資家向けに完全にローカル環境で動作する高度な株式分析・管理プラットフォームです。
一般的なスクリーナー機能に加え、ローカルLLMを用いた決算書のAI解析、ベクトル検索を用いた概念的なテーマ検索、およびポートフォリオのバックテストまでを統合的に実行できるWebアプリケーションを提供します。

### 1.2 主要機能
1. **全銘柄スクリーナー**: 約4,000銘柄のテクニカル・ファンダメンタル指標に基づく高速なスクリーニング機能。
2. **AI決算分析 (RAG)**: 企業の決算説明会資料などを自動取得・PDF解析し、事業セグメントや将来見通しをAIアナリストが評価する機能。
3. **動的テーマ検索**: 「円安メリット」「AIを活用した自動化」など、ユーザーの自由な自然言語（概念）による銘柄検索とハイブリッド検索アルゴリズム（GICS連動）。
4. **マイテーマ・ポートフォリオ管理**: 抽出した銘柄を任意のテーマとして保存・管理し、パフォーマンスを追跡する機能。
5. **テーマ内銘柄の分析**: 保存したテーマ内に含まれる構成銘柄の株価情報やファンダメンタル指標をリスト形式で一覧表示し、テーマ単位での比較・分析を行う機能。
6. **買いアラートの提供**: 事前に定義されたテクニカル指標（パーフェクトオーダー、ゴールデンクロス等）やファンダメンタル条件に合致した銘柄を検知し、売買のタイミングをアラートとして提供する機能。
7. **マーク・ミネルヴィニ SEPA 分析**: 3ヶ月単体四半期の成長加速、Stage 2上昇トレンド、およびVCP（ボラティリティ収縮パターン）ブレイクアウト候補を自動スクリーニング・診断する機能。

### 1.3 テクノロジースタック
本システムはプライバシーとコストを重視し、高負荷なAI処理を含めすべてローカル環境内で完結するアーキテクチャを採用しています。

- **フロントエンド・BFF (Backend For Frontend)**
  - Next.js (App Router)
  - React, TypeScript
  - Vanilla CSS (UIスタイリング)
  - Lightweight-charts / Recharts (チャート描画)
  - Lucide-React (アイコン)
- **データベース・検索エンジン**
  - **リレーショナルDB**: SQLite (`@libsql/client`) / FTS5 (全文検索・Sparse Search)
  - **ベクトルDB**: Qdrant (ローカル稼働 / Dense Search)
- **AI・自然言語処理**
  - **ローカルLLM環境**: Ollama
  - **推論・生成モデル**: `gemma3:12b` (要約、GICS判定Stage1/2など) および Gemini API (GICS監査Stage3用)
  - **リランカーモデル**: `hotchpotch/japanese-bge-reranker-v2-m3-v1` (Python FastAPI / ポート8000)
  - **埋め込みモデル**: `bge-m3` (1024次元 / テーマのベクトル化、RAG検索用)
- **データ収集・解析 (バッチ処理)**
  - Node.js (バッチ処理スクリプト)
  - Cheerio (IR Bankスクレイピング)
  - Docling (Python/CUDA / 決算PDFの高精度Markdownパース)


## 2. 画面構成とUI・フロントエンド設計 (UI & Screen Specifications)

バックエンドのデータパイプラインやAI推論結果をエンドユーザーに提供するための、フロントエンドの主要な画面構成と画面遷移です。

### 2.1 画面遷移図と共通UI (Screen Flow & Common UI)

#### 2.1.1 画面遷移図
```mermaid
graph TD
    A[Sidebar (共通)] -->|ナビゲーション| B(メインスクリーナー `page.tsx`)
    A -->|ナビゲーション| C(テーマディスカバリー `themes/page.tsx`)
    A -->|ナビゲーション| F(SEPA分析画面 `sepa/page.tsx`)
    
    B -->|ティッカークリック| D(銘柄詳細ページ `stocks/[ticker]/page.tsx`)
    C -->|マイテーマ/異常検知から| D
    F -->|ティッカークリック| D
    
    A -->|データ同期実行| E((Data Sync API))
```

#### 2.1.2 サイドバーとデータ同期
- **サイドバー (`Sidebar.tsx`)**: 全ての画面で左側に固定表示されます。現在のパス(`usePathname`)に応じてアクティブ状態をハイライトします。
- **データ同期ボタン (`SyncButton.tsx`)**: サイドバー下部に常設されており、クリックすると `POST /api/data-sync` を呼び出します。バックエンドから Server-Sent Events (SSE) でストリーミングされる処理進捗（例: 「[2/5] 決算PDF解析中...」）を受信し、ボタン直下にリアルタイムで表示します。完了時にはアラートで通知されます。

### 2.2 メインスクリーナー (`src/app/page.tsx`)
アプリケーションのトップページであり、全上場銘柄を俯瞰・フィルタリングするための画面です。
- **機能**:
  - `stocks` テーブルに事前計算された約4,000銘柄のテクニカル・ファンダメンタル指標を一覧表示。
  - **フィルタリング**: 東証業種、GICSセクター、PER、PBR、時価総額、ゴールデンクロス/パーフェクトオーダー発生有無など、複数条件の掛け合わせによる高度な絞り込み機能を備えます。
  - 仮想化（Virtualization）技術を利用し、数千件のデータをDOM遅延なしで高速スクロール・ソート可能にしています。

### 2.3 テーマディスカバリー (`src/app/themes/page.tsx`)
自然言語による次世代の銘柄検索と、保存されたテーマポートフォリオの可視化を行う画面です。内部的に3つのタブで構成されています（`ThemeDiscoveryLayout`）。

#### 2.3.1 テーマ検索タブ (`ThemeSearchTab`)
- **機能**: ユーザーが「円安メリット」「AI半導体」といった自然言語を入力すると、バックエンドでLLMが5個の関連キーワードに拡張し、Qdrant(Dense) + SQLite(Sparse) のハイブリッド検索 (RRF) に加え、Python側で独立稼働するリランカー（Cross-Encoder）を用いた最終スコアリングによって、最も合致する上位50銘柄を極めて高い精度でリストアップします。
- **アクション**: 検索結果が良好であれば、任意の名前をつけて「マイテーマ」として保存（DBの `custom_themes` へ保存）できます。

#### 2.3.2 マイテーマ管理タブ (`CustomThemesTab`)
- **機能**: 保存済みのマイテーマ一覧を表示し、各テーマの構成銘柄とその類似度スコアを確認できます。
- **可視化 (Network Graph)**: `react-force-graph-2d` を用いて、テーマ内の構成銘柄群をフォース・ディレクテッド・グラフ（ネットワーク図）として視覚的にマッピングします。これにより、テーマの中心的な銘柄（コア）と周辺銘柄（サテライト）の関係性を直感的に把握できます。

#### 2.3.3 データクレンジング・異常検知タブ (`DataCleansingTab`)
- **機能**: バックエンドの `api/themes/anomalies/route.ts` によって検知された、「LLM監査によってGICS分類が『不適切（ERROR）』と判定された」銘柄をリスト表示します。
- **アクション**: リストにはAIが判定した「監査エラー理由（gics_audit_reason）」が表示されます。画面上から直接「事業要約」や「キーワード」を手動修正し「保存」を押すことで、即座に再エンベディングAPIが走り、正しい分類へと自己修復させることが可能です。また、全銘柄の分類再計算バッチをキックすることもできます。

### 2.4 銘柄詳細ページ (`src/app/stocks/[ticker]/page.tsx`)
個別銘柄の深い分析情報を集約したダッシュボード画面です（`StockAnalysisDashboard`）。

- **AI決算分析レポート**:
  - データ同期時にRAGパイプライン（`analyze_stock_rag.ts`）によって自動生成された `[ticker]_ai_report.json` を読み込み、【当期業績の事実】【次期見通しの事実】【前回決算との差分】【証券アナリスト視点の総合評価(ai_comment)】の4セクションをプロフェッショナルなレポート形式で表示します。
- **株価・テクニカルチャート**:
  - `lightweight-charts` を用いて、`daily_quotes` テーブルからローソク足チャートと出来高をインタラクティブに描画します。
- **財務推移チャート**:
  - `recharts` を用いて、`financials` テーブルの時系列データ（売上高、営業利益、EPSなど）を棒グラフ・折れ線グラフで視覚化します。
- **企業プロファイル情報**:
  - 四季報からクレンジング抽出された「特徴要約」「関連キーワード」および、AIが判定した「GICSサブ産業カテゴリ」と「テーマ」を表示します。

### 2.5 SEPA (ミネルヴィニ分析) 画面 (`src/app/sepa/page.tsx`)
マーク・ミネルヴィニ（Mark Minervini）の SEPA (Specific Entry Point Analysis) 手法に基づく、トレンドテンプレート選定およびVCP（ボラティリティ収縮パターン）ブレイクアウト候補スクリーニング画面です（`SepaDashboard`）。

#### 2.5.1 画面タブ機能概要
- **トレンドテンプレートタブ (`TrendTemplateTab`)**:
  - 8つのステージ2条件を満たした銘柄群を一覧表示。
  - ファンダメンタルフィルター（EPS加速、売上加速、マージン拡大、黒字転換、ROE 15%↑、3年連続増益、時価総額100〜1,000億、時価総額300〜3,000億）による動的絞り込み。
  - RS（レラティブストレングス）ランキング順、または「掲載日（Stage2突入日）」によるソートが可能。リスト復帰時にも最新の突入日を表示。
- **VCP・セットアップ候補タブ (`VcpCandidatesTab`)**:
  - トレンドテンプレート合格銘柄の中から、ベース形成（20〜65日）およびピボット形成（直近2〜15日）を経たブレイクアウト直前・直後の銘柄、および25日/50日SMAへのプルバック（押し目）銘柄を抽出。
  - 上部に5つのモード切替チップを搭載：
    - `[ Stage2 + コア成長 (Tier 1) ]`: エメラルド (`#10b981`)
    - `[ ★ Stage2 + 25日押し目 ]`: パープル (`#a855f7`, チャートの25SMA色に一致、強モメンタム浅押し)
    - `[ Stage2 + 50日押し目 ]`: シアン (`#06b6d4`, 機関投資家サポート押し)
    - `[ 🚀 ブレイク後押し目 ]`: アンバー (`#f59e0b`, 過去3〜30日前に出来高1.3倍超でベース突破した銘柄の25日/50日ファースト・プルバック。見せかけブレイクを排除する防衛基準［過去60営業日高値突破・CLV>=0.70上ヒゲ排除・ブレイク時SMA50>SMA200・52週高値から-15%以内・押し目深さガード］を厳格適用)
    - `[ 全VCP候補 ]`: アンバー (`#f59e0b`, セットアップ全件)
  - オプショントグル（「株式のみ」「時価総額 100〜1,000億」「時価総額 300〜3,000億」「売買代金 >= 1億」）を独立オーバーレイ可能。
  - 左ペイン（候補銘柄一覧）と右ペイン（クイック詳細プレビュー）の2ペイン構成。
  - 押し目モード選択時は、左テーブルが自動的に「25日線/50日線乖離・押し幅%・出来高枯渇比・RS」へ切り替わり、押し目深度とサポート状況を即座に確認可能。「🚀 ブレイク後押し目」選択時は「銘柄・株価・MA乖離(25MA/50MAバッジ)・ブレイク/調整(経過日数と高値下落率)・出来高枯渇比・RS」のコンパクトな6列構成で表示される。
  - チャート上にはベース期間高値（ベースレジスタンス：橙色点線）と真のピボット（ピボットライン：金色破線）、および25日SMA（紫）・50日SMA（緑）・150日SMA（青）・200日SMA（赤）を表示。
- **個別銘柄SEPA診断タブ (`DiagnosticsTab`)**:
  - 銘柄コード入力により、当該銘柄のSEPA適合状況（Stage2の8条件、ファンダメンタル4項目、VCP健全性ガード）を一目で判定する個別詳細診断ビュー。
  - **4桁標準コード・企業名検索対応**: 日本株の一般的な4桁コード（例: `7203`、末尾の0不要）、5桁コード（`72030`）、および企業名（例: `レーザーテック`）による柔軟な入力・即時診断に対応。BFF API（`/api/sepa/diagnostics/[ticker]`）側でJ-Quants 5桁コードとの相互正規化を行い、日足チャート（260営業日）・新規事業IRニュース・四半期財務履歴を完全同期取得。
  - リスクリワード計算パネル（ピボット基準の損切り価格、目標価格、R:R比率）を搭載。

#### 2.5.2 コンポーネント階層構造
```text
src/app/sepa/page.tsx
└── SepaDashboard (.sepa-page-wrapper: 縦スクロールレイアウト)
    ├── タブ切替ヘッダー ('trend' | 'vcp' | 'diagnostics')
    ├── TrendTemplateTab
    │   └── TrendFilterControls (EPS/売上/マージン/黒字転換/時価総額トグル)
    ├── VcpCandidatesTab (左右2ペインスプリット)
    │   ├── 上部: 4モード切替チップ & オプショントグル (100〜1,000億, 300〜3,000億, 売買代金1億)
    │   ├── 左ペイン: VCP / 押し目 銘柄リストテーブル (モード別動的ヘッダー)
    │   └── 右ペイン: 銘柄クイック詳細プレビュー
    │       ├── ChecklistBadges (8条件・健全性バッジ)
    │       └── SepaPriceChart (Base High / True Pivot / 25, 50, 150, 200 SMA表示)
    └── DiagnosticsTab (銘柄コード直接入力診断)
        ├── ChecklistBadges
        ├── SepaPriceChart
        └── RiskRewardPanel (ピボット基準のリスクリワード計算)
```

#### 2.5.3 チャート描画仕様 (`SepaPriceChart.tsx`)
- **利用ライブラリ**: `lightweight-charts`
- **描画要素とカラー定義**:
  - 移動平均線: 25日SMA（紫色 `#a855f7` / 2px / 短期サポート）、50日SMA（緑色 `#10b981` / 2px）、150日SMA（シアン `#06b6d4` / 2px）、200日SMA（ローズ `#f43f5e` / 2px）
  - ベース期間高値（Base High）: 橙色 `#f97316` / LineStyle: Dotted（点線）/ 1px
  - 真のピボット（True Pivot Price）: 金色 `#fbbf24` / LineStyle: Dashed（破線）/ 2px
  - 初期表示範囲（ズーム）: 直近1ヶ月（約25営業日）に自動ズームフォーカス（`rightOffset: 3` で右端に余白を確保）。マウスホイールやドラッグにより過去300営業日分を自由に遡行・拡大縮小可能。
- **スタイリングルール**: Tailwind CSSではなく `src/app/globals.css` のクラスおよびインラインスタイルを用い、親要素 `.sepa-page-wrapper` による垂直スクロールを保証する。

### 2.6 フロントエンド状態管理と表示パフォーマンス最適化
バックエンドの膨大なデータパイプラインやAI推論結果をエンドユーザーに提供するための、UI側のアーキテクチャ設計です。

- **主要ファイル**: `src/features/screener/components/StockTable.tsx`, `src/features/themes/components/ThemeSearchTab.tsx`
- **設計思想**:
  - **仮想化（Virtualization）**: 約4,000銘柄を一括表示するスクリーナーにおいて、DOMの膨張によるブラウザのクラッシュを防ぐため、TanStack Table等を用いた仮想化レンダリングを採用し、画面に表示されている数十行のみを描画します。
  - **動的クエリのUI連動**: テーマ検索時、LLMが拡張抽出したキーワード群は「編集可能なタグUI」として画面に表示されます。ユーザーがこれらを削除・追加することで、裏側のFTS5 Sparse検索の入力文字列が動的に再構築されるアーキテクチャとなっています。



## 3. バックエンド・データパイプライン設計 (Backend Data Pipelines)

本章では、kabu3.0を構成する主要なデータパイプラインと、それを支える設計思想（利用ファイル、DBテーブル、コア関数など）について定義します。

### 3.1 データ同期とバッチオーケストレーション
外部API（J-Quants等）からのデータ取得と、それに続くすべてのAI推論パイプライン（抽出・判定・分析）を統括する起点となるプロセスです。

- **主要ファイル**: `src/app/api/data-sync/route.ts` (フロントエンドUIとSSE通信), `src/lib/jquants.ts` (同期オーケストレーション)
- **利用DBテーブル**: `sync_history`, `daily_quotes`, `financials`, `stock_splits`, `stocks`, `sepa_metrics`
- **J-Quants API エンドポイント**:
  - 銘柄マスタ: `/v2/bulk/list?endpoint=equities/master` $\to$ `/v2/bulk/get?key={Key}` (全上場銘柄の一括CSV)
  - 財務情報: `/v2/bulk/list?endpoint=fins/summary` $\to$ `/v2/bulk/get?key={Key}` (2024年以降・liveを対象)
  - 日足株価: `/v2/bulk/list?endpoint=equities/bars/daily` $\to$ `/v2/bulk/get?key={Key}` (2024年以降・liveを対象)
- **設計思想（冪等性と遡及調整）**:
  - **差分同期**: 毎回全件取得するのではなく、`sync_history` テーブル（S3 Key単位）を活用して未取得のデータのみを効率的にダウンロード・バルクインサート（5,000件単位）します。
  - **株式分割の自動遡及（AdjFactor）**:
    日足CSVの各レコードにおいて、`AdjFactor` が存在し、かつ `AdjFactor != 1.0` かつ `AdjFactor > 0` の場合を検知します。
    1. `stock_splits` テーブルに記録:
       ```sql
       INSERT INTO stock_splits (ticker, date, factor) VALUES (?, ?, ?)
       ON CONFLICT DO NOTHING;
       ```
    2. 分割日より過去（`date < split_date`）の日足・財務レコードを同一トランザクション内で自動遡及更新（UPDATE）：
       - **日足株価 (`daily_quotes`)**:
         - 株価指標（乗算）: `adj_open = adj_open * factor`, `adj_high = adj_high * factor`, `adj_low = adj_low * factor`, `adj_close = adj_close * factor`
         - 出来高（除算）: `adj_volume = adj_volume / factor`
         ```sql
         UPDATE daily_quotes SET 
           adj_open = adj_open * ?, adj_high = adj_high * ?, adj_low = adj_low * ?, adj_close = adj_close * ?, 
           adj_volume = adj_volume / ? 
         WHERE ticker = ? AND date < ?;
         ```
       - **財務データ (`financials`)**:
         - 1株当たり指標（乗算）: `adj_eps = adj_eps * factor`, `adj_dividend = adj_dividend * factor`
         - 株式数（除算）: `adj_shares_outstanding = adj_shares_outstanding / factor`
         ```sql
         UPDATE financials SET 
           adj_eps = adj_eps * ?, adj_dividend = adj_dividend * ?, 
           adj_shares_outstanding = adj_shares_outstanding / ? 
         WHERE ticker = ? AND date < ?;
         ```
       ※ J-Quants仕様において1:2分割の場合は `factor = 0.5` が配信されるため、株価・1株指標は $0.5$ 倍（半値）、株式数・出来高は $0.5$ で除算（2倍）となり、時系列の連続性が物理的に100%整合します。
  - **AIパイプライン・指標再計算のキック**: データ取得後、更新があった銘柄に対して「決算書AI解析パイプライン（3.2章）」や「新規事業IR抽出（3.4章）」を順次トリガーし、最終ステップとして全銘柄スクリーナー用キャッシュ（`stocks`）の再計算、およびミネルヴィニSEPA指標（`sepa_metrics`）の自動再計算（`calculateAndPopulateSepa`）を実行してシステム全体を最新状態に同期します。

### 3.2 決算書AI解析パイプライン (Docling + RAG)
決算PDFからの情報抽出において、LLMのハルシネーション（嘘の生成や単位変換ミス）を防ぐため、物理的なパースとRAG検索を組み合わせたハイブリッド・パイプラインです。

- **主要ファイル**: `src/features/earnings/index.ts` (抽出オーケストレータ), `src/scripts/analyze_stock_rag.ts` (AIレポート生成)
- **利用DB/モデル**: Qdrant (`financial_reports`), Ollama (`gemma3:12b`, `bge-m3`)
- **対象外銘柄**: 「ETF、ETN、REIT、投資法人、ファンド、TOKYO PRO Market」に該当する銘柄はバッチ処理の対象から厳格に除外されます。
- **処理フロー**:
  
  **【フェーズ1: ドキュメント取得とパース】**
  1. **ドキュメント取得と更新スキップ制御**: J-Quantsからの更新シグナルに対し、IR BankのURLから「実際の決算短信の発表日」を抽出します。業績修正などで新しい決算短信が存在しなかった（空振りだった）場合は `.ignore` フラグを生成し、以後の無駄な取得確認アクセスをスキップします。
  2. **Markdown解析**: `src/scripts/pdf_to_md_docling.py` (Docling) を用いてPDFを高精度なMarkdownに変換します。

  **【フェーズ2: AI解析とDB更新】**
  3. **Qdrantベクトル化**: 生成されたMarkdownを見出し構造（`#`, `##`）を維持したままチャンク化し、Qdrantに保存します。
  4. **セグメント情報のハイブリッド抽出**: 以下の多段フォールバックを用いてセグメント情報を抽出・要約します。
     - **Stage 1（プログラム表解析）**: DoclingによってMarkdownの「表（Table）」として綺麗に構造化された決算データに対して、正規表現を用いてセグメント損益表のヘッダー行を直接抽出し、事業名を取得します。LLM特有の抽出ミス（ハルシネーション）を防ぎ100%の精度を担保するため、LLMを使わずにノイズ除去フィルター（`/計|合計|調整額|全社|その他|消去|連結|損益計算書/`）をプログラム処理でかけて純粋な事業名だけを取り出します。
     - **Stage 2（単一事業の定型文検索）**: 表が存在しない「単一セグメント（1つの事業しか行っていない企業）」の場合、「当社は〇〇事業の単一セグメントであるため～」といったお決まりの定型文が記載されます。この定型文を正規表現で捕捉することで、確実かつ高速に事業名のみを抽出します。これもLLM推論を完全にスキップするため、ハルシネーションゼロで抽出が完了します。
     - **Stage 3（Qdrant + LLMフォールバック）**: Stage 1・2共に抽出失敗した場合のみ、静的クエリ `"セグメント情報 事業別 報告 計 | 収益"` を用いてQdrantからテキストを引き当て、プレーンテキスト形式でLLMにセグメント情報を抽出させます。出力結果に対してもStage 1同様のノイズ除去フィルターをかけます。
     - **深掘り抽出 (Pass 2)**: 抽出した各セグメント名をクエリの軸とし、動的にQdrantを検索（クエリ例: `"[セグメント名] 事業内容 概要 製品 サービス"`）し、事業の詳細内容を含む文章テキストを個別に抽出します。
     - **完全フォールバック (Plan 1)**: Stage 3でもセグメント名が一切抽出できなかった場合、四季報の事業プロフィールとQdrantのテキストを直接LLMに渡して1文要約を生成するハイブリッド要約ロジックへと移行します。
     - **アナリスト清書 (Step 2)**: 抽出・深掘りしたセグメント情報と参照情報を基に、プロのアナリスト文章として1文要約を生成します。その際、「具体的な企業名を要約に含めることを禁止する」という強力な制約を設けています。
  5. **GICS判定の委譲**: 抽出・更新された最新のセグメント情報をもとに、後述する共通エンジン（3.3章）である `run_gics_classification.ts` をキックし、企業の事業実態に合わせたGICS分類の再判定とベクトル更新を行います。
  6. **AIアナリストレポートの生成**: 最新決算と「1つ前の決算書」を比較して差分レポートを生成します（初回取得時など過去分がない場合は、最新データ単独で生成するフォールバックを行います）。
  7. **推論完了フラグの生成 (`.done`) と冪等性（トランザクション）の担保**: レポート生成までの全AI処理が完了した銘柄には `.done` フラグを生成します。数千件に及ぶ直列処理は途中で停止される前提となるため、この処理には冪等性を持たせています。`.done` が存在しない（未完了の）銘柄は、途中で強制終了された場合でも次回再開時に**「DB更新・GICS判定・Qdrant更新」を無条件で上書き（強制フルアップデート）**し、不整合を防ぐ疑似的なトランザクションの役割を果たします。

### 3.3 ハイブリッド検索・GICS判定アーキテクチャ
Dense検索（意味検索）とSparse検索（キーワード一致）を融合させた、システムの中核となる汎用的な検索・分類エンジンです。バックエンドでのGICS判定と、フロントエンドでのテーマ検索の両方で利用されます。

- **主要ファイル**: `src/scripts/run_gics_classification.ts`, `src/app/api/themes/search/route.ts`
- **利用DB**: SQLite FTS5 (`gics_fts`, `equities_fts`), Qdrant (`company_profiles`, `gics_categories`)
- **コア・アルゴリズム**:
  1. **Dense Search**: `bge-m3` によるCosine類似度計算（Qdrantベクトル検索）。
  2. **Sparse Search**: SQLiteのFTS5仮想テーブルを用いた `MATCH` 句によるBM25スコア検索。
  3. **Local RRF (Reciprocal Rank Fusion)**: DenseとSparseの順位を `k=60` の定数を用いて融合スコア化し、上位候補（Top 100）を決定します。
  4. **Cross-Encoder Reranking**: 抽出されたTop 100件の候補に対して、Pythonサーバーでホストされているリランカー（`hotchpotch/japanese-bge-reranker-v2-m3-v1`）を用いて最終スコアリング（生のLogit値による評価）を行い、上位50件に絞り込みます。
- **用途1: GICS分類・再判定 (バックエンド用途)**
  - 3.2章のフェーズ2から呼び出され、企業の最新の事業要約をもとにハイブリッド検索でTop 10のGICS候補を抽出します。
  - **東証業種マッピング（33業種・17業種フォールバック）とガードレール機構**: 検索を実行する前に、東証が定めた「33業種」および半角表記揺れ、さらには粒度の荒い「17業種（その他など）」に対して、許容されるGICSセクターを事前定義（`TSE_TO_GICS_MAPPING`）してフィルタリングします。AIの検索や推論のみに依存すると、決算資料の表現次第で「通信会社がエネルギー産業に分類される」ような致命的ミス（ハルシネーション）が起こり得ます。そのため、「絶対に覆らない正解データ（東証業種）」をハード制約のガードレールとして敷くことで、大事故を未然に防いでいます。
  - **LLM リランキングと監査**: 抽出された候補に対し、ローカルLLM(Gemma3)を用いて「10個 → 3個（Stage 1）」「3個 → 1個（Stage 2）」と段階的に絞り込みます。その後、決定したカテゴリが企業の実態と合致しているかを外部のGemini API（`gemini-flash-latest`）を用いた「LLM監査（Stage 3）」によって最終検証し、誤分類の検知と理由のテキスト化を行います。Gemini APIのJSON Structured Outputs機能を活用することでパースエラーを完全に防ぎます。
- **用途2: 動的テーマ検索 (フロントエンド用途)**
  - ユーザーが入力した自然言語（例：「円安メリット」）をLLMが関連キーワード群に拡張し、ハイブリッド検索 (RRF) ＋ Cross-Encoderリランカーを用いて上位50銘柄を瞬時にリストアップします。

### 3.4 新規事業IR・適時開示 抽出アーキテクチャ
決算書とは独立して、企業がTDnet等で発表する「新規事業」関連の適時開示資料（IRニュース）を対象としたデータ抽出・ベクトル化パイプラインです。

- **主要ファイル**: `src/scripts/fetch_ir_news.ts`, `src/scripts/analyze_ir_news.ts`
- **利用DB/モデル**: SQLite (`ir_news`), Qdrant (`company_profiles`)
- **処理フロー**:
  1. **クローラー抽出 (`src/scripts/fetch_ir_news.ts`)**:
     - **スクレイピング技術**: ブラウザ不要の軽量高速パースを実現するため `fetch` + `cheerio` を採用。
     - **検索対象URL**: `https://irbank.net/td/search?q=${encodeURIComponent(keyword)}`
     - **対象キーワード**: `["新規事業", "事業開始", "参入"]`
     - **期間制約**: 直近5カレンダー日以内（`limitDays = 5`）。日付行が5日を超えた時点で当該キーワードのスクレイピングを早期break。
     - **DOMセレクタ・抽出仕様**:
       - 一覧テーブル行: `table.cs tr`
       - 日付セパレータ行: `td.lf`（正規表現 `/(\d{4})年(\d{1,2})月(\d{1,2})日/` でパース）
       - データ行: `td` 要素が4つ以上存在する行
         - ティッカー: `tds[1] a`（※IR Bankのティッカーが4桁の場合は末尾に "0" を付加して5桁コードに正規化）
         - 開示タイトルおよび開示ID: `tds[3] a`（リンクテキストをタイトルとし、`href` の `/td/{id}` から開示IDを抽出）
       - PDFダウンロード: `https://irbank.net/pdf/{id}.pdf`
     - **ローカル保存規則**: `data/pdfs/{ticker}_ir_newbiz_{date}_{id}.pdf`
     - **DB登録**: `ir_news` テーブル（`id`, `ticker`, `title`, `date`, `pdf_path`, `analyzed = 0`）にレコードを保存。
  2. **Phase 1 (推論フェーズ - `src/features/ir_news/phase1_inference.ts`)**:
     - `ir_news` から `analyzed = 0` の未解析レコードを取得。
     - `src/scripts/pdf_to_md_docling.py` (Docling) を用いてPDFをMarkdownに変換。
     - ローカルLLM (`gemma3:12b`) を用いて、テキストから「事業領域」「コア技術」「ターゲット」「検索用類義語」をJSON形式で全件一括抽出（インメモリ配列に蓄積）。
  3. **Phase 2 (ベクトル化フェーズ - `src/features/ir_news/phase2_vectorization.ts`)**:
     - 推論完了後、抽出されたJSONメタデータを `bge-m3` でベクトル化。
     - Qdrantの `company_profiles` へ全件一括で追加・更新（upsert）。
     - VRAMの断片化とモデル切り替えのオーバーヘッドを防ぐため、Phase 1（推論）と Phase 2（埋め込み）は厳密に逐次分離実行されます。処理完了後、`ir_news.analyzed = 1` に更新します。


## 4. ディレクトリ・モジュール構成 (Directory Structure)

システム全体は、フロントエンド（UI）、BFF（API）、およびバックエンド（バッチ処理）が疎結合となるよう、明確なディレクトリ規則に基づいて構成されています。

```text
kabu3.0/
├── src/
│   ├── app/                 # Next.js App Router (ページおよびBFFエンドポイント)
│   │   ├── api/             # RESTful API ルート群
│   │   │   ├── sepa/        # SEPA BFF API (trend, vcp-candidates, diagnostics)
│   │   │   ├── themes/      # テーマ検索・マイテーマAPI
│   │   │   ├── stocks/      # 個別銘柄情報・事業要約API
│   │   │   └── data-sync/   # J-Quantsデータ同期SSEトリガー
│   │   ├── sepa/            # SEPA分析ダッシュボード画面 (page.tsx)
│   │   ├── stocks/[ticker]/ # 銘柄詳細ダッシュボード画面 (page.tsx)
│   │   └── themes/          # テーマディスカバリー画面 (page.tsx)
│   │
│   ├── components/          # アプリケーション全体で共通利用するUI部品 (Sidebar, SyncButton等)
│   │
│   ├── features/            # ドメイン駆動設計に基づく機能別モジュール群 (Feature Slices)
│   │   ├── sepa/            # SEPA関連UIコンポーネント・フック・型定義
│   │   │   ├── components/  # SepaDashboard, SepaPriceChart, ChecklistBadges, etc.
│   │   │   ├── hooks/       # useSepa データフェッチフック
│   │   │   └── types/       # SEPA専用 TypeScript 型定義 (sepa.ts)
│   │   ├── earnings/        # 決算PDF解析・Docling・RAG抽出
│   │   ├── ir_news/         # 新規事業IR適時開示解析・推論
│   │   ├── analysis/        # AI決算分析・個別チャート描画
│   │   ├── screener/        # 全銘柄スクリーナー、仮想化テーブル描画
│   │   └── themes/          # テーマ検索UI、マイテーマ管理、ネットワークグラフ
│   │
│   ├── lib/                 # アプリケーション全体で共有されるコアビジネスロジック
│   │   ├── sepa/            # SEPA計算エンジン
│   │   │   ├── index.ts     # SEPAパイプライン統括 & sepa_metrics テーブル永続化
│   │   │   ├── trend_calculator.ts # Stage 2 トレンド判定 & 掲載日Backwards Walk探索
│   │   │   ├── rs_calculator.ts    # 1〜99パーセンタイル動的加重RS (10日猶予除外)
│   │   │   ├── quarterly_parser.ts # 3ヶ月単独期パース & 物理減算
│   │   │   ├── quarterly_standalone.ts # ファンダメンタル急成長率 & Q4会計ノイズガード
│   │   │   └── vcp_screener.ts     # Base High / True Pivot / ATR収縮 / VDU
│   │   ├── calculator.ts    # テクニカル指標・ファンダメンタル指標の計算エンジン
│   │   ├── db.ts            # SQLite (libsql) 接続およびクエリラッパー
│   │   ├── gics.ts          # GICS分類マスタ連携ヘルパー
│   │   ├── jquants.ts       # J-Quants API クライアント & 同期後SEPA自動連携
│   │   └── anomaly_detector.ts # データ異常値・テーマ乖離検出
│   │
│   ├── scripts/             # 非同期で稼働する独立したNode.js/Pythonバッチ処理群
│   │   ├── calculate_sepa.ts # SEPA再計算CLIスクリプト
│   │   ├── rag/             # RAG専用のモジュール群 (chunker, embedder, qdrant, prompts)
│   │   ├── run_sync.ts      # 日次データ同期・遡及調整ジョブ
│   │   ├── run_theme_batch.ts # 決算書PDFパースとセグメント抽出バッチ
│   │   ├── run_gics_classification.ts # GICSハイブリッド判定・再分類バッチ
│   │   ├── analyze_stock_rag.ts # 決算書からのAIアナリストレポート生成バッチ
│   │   ├── fetch_ir_news.ts     # 新規事業関連IRのスクレイピング・PDF取得スクリプト
│   │   ├── analyze_ir_news.ts   # 新規事業関連IRのDocling解析とベクトルDB更新スクリプト
│   │   └── pdf_to_md_docling.py # Doclingを用いたPDF->Markdown高精度変換スクリプト
│   │
│   └── data/                # マスターデータおよびドキュメント
│       ├── gics_dictionary.ts # GICS分類マスタと東証業種ハード制約定義
│       ├── gics_categories.json # GICSベクトルの静的データ
│       └── docs/            # ユーザーガイドなどのMarkdownナレッジベース (sepa_user_guide.md 等)
│
├── data/                    # バッチ処理が生成・管理する物理ファイル群
│   ├── pdfs/                # 決算資料やIRニュースの元PDFおよび変換済みMarkdownファイル
│   └── pdf_batch_history.json # PDF取得済みの履歴管理（二重取得防止用）
│
├── scratch/                 # 動作検証・本番影響のない使い捨て一時スクリプト群
│
├── local.db                 # アプリケーションのメインデータベース (SQLite)
├── .env.local               # システム環境変数（ポートやパス設定など）
├── AGENTS.md                # AI開発エージェント向けの振る舞い・コーディングルール
└── SPEC.md                  # 本仕様書 (SSOT)
```

### 4.1 依存関係のルール
- `src/features/` 内のモジュールは独立性を保ち、他の Feature への直接的な依存（相互インポート）を極力避けます。
- 共通して必要なロジックやコンポーネントは `src/lib/` または `src/components/` に配置します。
- バッチ処理 (`src/scripts/`) は、Next.jsのサーバー（`src/app/api/`）から直接実行（Spawn）されるか、Cron等の外部スケジューラから独立したプロセスとして呼び出される設計であり、Next.jsのランタイムコンテキストには依存しません。


## 5. データモデルとデータベース設計 (Data Models & Database Design)

本システムは、構造化データ・時系列データ・全文検索を担うリレーショナルDB（SQLite）と、ベクトル検索を担うベクトルDB（Qdrant）のハイブリッド構成を採用しています。

### 5.1 SQLite メインデータベース (`local.db`)
フロントエンドおよびバッチ処理の主軸となるデータベースです。高速な全文検索を行うためFTS5仮想テーブルを活用しています。

#### 5.1.1 マスタ・プロファイル系テーブル
企業情報の根幹や、LLMによって生成された事業要約などを格納します。

- **`equities_master` (銘柄マスタ)**: J-Quantsからの基本情報と、AIが抽出した事業要約・GICS分類を保持します。
  - `ticker` (TEXT PK): 銘柄コード
  - `name`, `market`, `industry` (TEXT): 企業名、市場、東証業種
  - `last_updated` (TEXT): 最終更新日時
  - `theme`, `summary` (TEXT): 1文要約、AI事業詳細要約
  - `gics_sub_industry_id` (TEXT): 判定されたGICS分類ID
  - `gics_similarity_score` (REAL): GICSベクトルとの類似度
  - `theme_keywords` (TEXT): AIが抽出した機能的価値キーワード群
  - `main_segment`, `sub_segments` (TEXT): 決算書から特定した主力・サブ事業セグメント（JSON文字列）
  - `gics_audit_status` (TEXT): GICS分類に対するLLM監査結果（'OK', 'ERROR', 'PENDING'）
  - `gics_audit_reason` (TEXT): LLM監査によって'ERROR'と判定された際の具体的な理由テキスト

- **`shikiho_profiles` (四季報クレンジングデータ)**: LLMが四季報の「特色」からノイズを排除した純粋な機能的価値を格納します。
  - `ticker` (TEXT PK), `original_feature` (TEXT), `index_summary` (TEXT), `index_keywords` (TEXT)

#### 5.1.2 時系列・財務データ系テーブル
J-Quantsから取得した日足株価、財務情報、および株式分割履歴を格納します。これらはバッチ処理による遡及調整（AdjFactor適用）の対象となります。

- **`daily_quotes` (日足株価データ)**
  - `ticker`, `date` (TEXT, Composite PK)
  - 生データ: `open`, `high`, `low`, `close`, `volume`, `turnover` (REAL)
  - 遡及調整済データ: `adj_open`, `adj_high`, `adj_low`, `adj_close`, `adj_volume` (REAL)
- **`financials` (財務・決算データ)**
  - `ticker`, `period_end_date` (TEXT, Composite PK): 銘柄コード、決算対象期末日（J-Quants `CurPerEn`。例: 2024-03-31）
  - `date` (TEXT): 最新の適時開示日（発表日）
  - `fiscal_quarter` (TEXT): 四半期会計区分（J-Quants `CurPerType`。例: 1Q, 2Q, 3Q, FY）
  - `net_sales`, `operating_profit`, `profit` (REAL): 当期累計実績（※同日発表の業績予想修正など実績空行による上書きを防止する保護アップサート）
  - `forecast_net_sales` 等 (REAL): 次期予想
  - `eps`, `adj_eps`, `adj_dividend` 等 (REAL): 1株当たり指標
  - インデックス: `idx_financials_period (ticker, period_end_date)`
- **`stock_splits` (株式分割履歴)**
  - `ticker`, `date` (TEXT, Composite PK), `factor` (REAL): 遡及調整用の分割係数
- **`ir_news` (新規事業IR・適時開示履歴)**
  - `id` (TEXT PK): ドキュメントID
  - `ticker`, `title`, `date`, `pdf_path` (TEXT): 取得したIR資料の基本情報とローカル保存パス
  - `analyzed` (INTEGER): DoclingパースおよびAIメタデータ抽出が完了したかどうかのフラグ（0: 未解析, 1: 解析済）

#### 5.1.3 SEPA指標キャッシュテーブル
- **`sepa_metrics` (SEPA指標・VCP候補キャッシュ)**
  - `src/lib/sepa/index.ts` の `calculateAndPopulateSepa()` によって一括計算・更新されるテーブル。全上場銘柄のトレンドテンプレート、日本株独自RSレーティング、3ヶ月単体四半期ファンダメンタルズ、VCP・ピボット指標を保持します。

```sql
CREATE TABLE IF NOT EXISTS sepa_metrics (
  ticker TEXT PRIMARY KEY,
  name TEXT,
  market TEXT,
  industry TEXT,
  is_operating_company INTEGER DEFAULT 1,
  latest_date TEXT,
  current_price REAL,
  sma_50 REAL,
  sma_150 REAL,
  sma_200 REAL,
  sma_25 REAL,
  dist_sma25_pct REAL,
  dist_sma50_pct REAL,
  is_trend_structural_pass INTEGER,
  is_above_sma_50 INTEGER,
  is_above_sma_150 INTEGER,
  is_above_sma_200 INTEGER,
  is_sma_50_above_150_200 INTEGER,
  is_sma_150_above_200 INTEGER,
  sma_200_slope_22d REAL,
  is_sma200_uptrend_1m INTEGER,
  is_sma200_uptrend_5m INTEGER,
  low_52w REAL,
  distance_from_low_52w_pct REAL,
  high_52w REAL,
  distance_to_high_52w_pct REAL,
  is_ipo INTEGER,
  is_trend_template_pass INTEGER,
  passed_conditions_count INTEGER,
  stage2_entry_date TEXT,
  rs_score_raw REAL,
  rs_rating INTEGER,
  is_pseudo_rs INTEGER,
  sales_yoy_pct REAL,
  op_yoy_pct REAL,
  ordinary_profit_yoy_pct REAL,
  eps_yoy_pct REAL,
  growth_status TEXT,
  is_growth_accelerating INTEGER,
  is_margin_expanding INTEGER,
  has_3y_annual_growth INTEGER,
  has_accounting_noise_risk INTEGER,
  standalone_sales REAL,
  standalone_op REAL,
  standalone_profit REAL,
  standalone_eps REAL,
  roe REAL,
  market_cap REAL,
  avg_trading_value_5d REAL,
  base_high REAL,
  base_depth_pct REAL,
  pivot_price REAL,
  pivot_distance_pct REAL,
  is_near_pivot INTEGER,
  is_pivot_breakout INTEGER,
  is_handle_healthy INTEGER,
  atr_10 REAL,
  atr_50 REAL,
  atr_contraction_ratio REAL,
  is_volatility_contracted INTEGER,
  volume_5d_avg REAL,
  volume_50d_avg REAL,
  volume_dryup_ratio REAL,
  is_volume_dryup INTEGER,
  swing_high_20d REAL,
  pullback_depth_pct REAL,
  max_dd_60d REAL,
  min_volume_5d REAL,
  min_vdu_ratio REAL,
  has_distribution_day INTEGER,
  is_pullback_25 INTEGER,
  ir_catalyst_count INTEGER,
  latest_ir_title TEXT,
  latest_ir_date TEXT,
  gics_sub_industry_id TEXT,
  has_breakout_prior INTEGER DEFAULT 0,
  days_since_breakout INTEGER,
  breakout_date TEXT,
  breakout_price REAL,
  pullback_from_breakout_high_pct REAL
);
```

```typescript
// src/features/sepa/types/sepa.ts
export type QuarterlyGrowthStatus =
  | 'GROWTH'           // 前年同期比プラス成長 (正常)
  | 'EXPLOSIVE_GROWTH' // EPS +300%以上 かつ 売上+10%以上の正真正銘の大成長
  | 'TURNAROUND'        // 黒字転換 (前年赤字 -> 当期黒字)
  | 'LOSS_REDUCTION'   // 赤字縮小 (前年赤字 -> 当期赤字だが改善)
  | 'LOSS_EXPANSION'   // 赤字拡大 (前年赤字 -> 当期赤字で悪化)
  | 'DEFICIT_FALL'     // 赤字転落 (前年黒字 -> 当期赤字)
  | 'IRREGULAR_PERIOD' // 変則決算・会計期間不整合による除外
  | 'NO_DATA';         // データ不足

export interface SepaTrendMetrics {
  current_price: number;
  sma_50: number | null;
  sma_150: number | null;
  sma_200: number | null;
  is_above_sma_50: boolean;
  is_above_sma_150: boolean;
  is_above_sma_200: boolean;
  is_sma_50_above_150_200: boolean;
  is_sma_150_above_200: boolean;
  sma_200_slope_22d: number | null;
  is_sma200_uptrend_1m: boolean;
  is_sma200_uptrend_5m: boolean;
  low_52w: number | null;
  distance_from_low_52w_pct: number | null;
  high_52w: number | null;
  distance_to_high_52w_pct: number | null;
  is_ipo: boolean;
  is_trend_template_pass: boolean;
  passed_conditions_count: number;
  stage2_entry_date: string | null;
}

export interface SepaRsMetrics {
  rs_score_raw: number | null;
  rs_rating: number | null;     // 1〜99 パーセンタイル
  is_pseudo_rs: boolean;        // IPO等で63〜251日の短期間加重 (擬似RSフラグ)
}

export interface SepaFundamentalsMetrics {
  sales_yoy_pct: number | null;
  op_yoy_pct: number | null;
  ordinary_profit_yoy_pct: number | null;
  eps_yoy_pct: number | null;
  growth_status: QuarterlyGrowthStatus;
  is_growth_accelerating: boolean;
  is_margin_expanding: boolean;
  has_3y_annual_growth: boolean;
  has_accounting_noise_risk: boolean;
  standalone_sales: number | null;
  standalone_op: number | null;
  standalone_profit: number | null;
  standalone_eps: number | null;
  roe: number | null;
  market_cap: number | null;
  avg_trading_value_5d: number | null;
}

export interface SepaVcpMetrics {
  base_high: number | null;
  base_depth_pct: number | null;
  pivot_price: number | null;
  pivot_distance_pct: number | null;
  is_near_pivot: boolean;
  is_pivot_breakout: boolean;
  is_handle_healthy: boolean;
  atr_10: number | null;
  atr_50: number | null;
  atr_contraction_ratio: number | null;
  is_volatility_contracted: boolean;
  volume_5d_avg: number | null;
  volume_50d_avg: number | null;
  volume_dryup_ratio: number | null;
  is_volume_dryup: boolean;
}

export interface SepaPullbackMetrics {
  swing_high_20d: number | null;
  pullback_depth_pct: number | null;
  max_dd_60d: number | null;
  min_volume_5d: number | null;
  min_vdu_ratio: number | null;
  has_distribution_day: boolean;
  is_pullback_25: boolean;
  is_pullback_50: boolean;
  has_breakout_prior: boolean;
  days_since_breakout: number | null;
  breakout_date: string | null;
  breakout_price: number | null;
  pullback_from_breakout_high_pct: number | null;
}

export interface SepaStockRecord extends SepaTrendMetrics, SepaRsMetrics, SepaFundamentalsMetrics, SepaVcpMetrics, SepaPullbackMetrics {
  ticker: string;
  name: string;
  market: string;
  industry: string;
  is_operating_company: boolean;
  latest_date: string;
  gics_sub_industry_id?: string | null;
  ir_catalyst_count?: number;
  latest_ir_title?: string;
  latest_ir_date?: string;
}
```

### 5.2 Qdrant ベクトルデータベース (Vector DB)
自然言語による意味検索（Semantic Search）やRAG（Retrieval-Augmented Generation）のためのベクトルストアです。

- **埋め込みモデル**: `bge-m3` (Ollama経由)
- **ベクトル次元数**: 1024次元
- **類似度計算 (Metric)**: Cosine (コサイン類似度)
- **コレクション定義・Payloadスキーマ**:
  1. **`financial_reports` コレクション**:
     - **用途**: 決算PDF（Markdownパース済）の見出し・段落チャンクを保存。RAG抽出（Pass 1/Pass 2）の検索対象。
     - **Point ID**: `${ticker}_${period}_${chunk_index}` のMD5ハッシュから生成された決定的UUID。
     - **Payload スキーマ**:
       - `ticker` (string): 5桁銘柄コード（フィルター用）
       - `period` (string): `'prev'` (前期) または `'latest'` (当期)（フィルター用）
       - `text` (string): 見出しパンくずリスト付きチャンク本文
     - **全文検索インデックス**: ハイブリッド検索のため、`text` フィールドに全文検索インデックス（`type: 'text', tokenizer: 'word', min_token_len: 2, max_token_len: 15, lowercase: true`）を構築。
  2. **`company_profiles` コレクション**:
     - **用途**: 企業の事業要約やIRニュースのメタデータをベクトル化したもの。動的テーマ検索やマイテーマ構成銘柄の抽出対象。
     - **Point ID**: 銘柄コード (`ticker`) からMD5ハッシュにより生成された決定的UUID。
     - **Payload スキーマ**:
       - `ticker` (string): 5桁銘柄コード
       - `name` (string): 企業名
       - `summary` (string): AI生成・手動修正された事業詳細要約文
       - `keywords` (string): 機能的価値キーワード群（カンマ区切り）
       - `text` (string): ベクトル生成時に結合された元テキスト
  3. **`gics_categories` コレクション**:
     - **用途**: GICS（世界産業分類基準）の158サブ産業カテゴリの名称と説明文をベクトル化したもの。銘柄のGICSハイブリッド分類時のDense検索対象。
     - **Point ID**: GICSサブ産業ID (`sub_industry_id`) からMD5ハッシュにより生成された決定的UUID。
     - **Payload スキーマ**:
       - `id` (string): GICS 8桁コード（例: `"10101010"`、※REIT `6010` 系は除外）
       - `name` (string): GICSサブ産業名
       - `description` (string): カテゴリ定義解説文
       - `text` (string): `【カテゴリ名】\n${name}\n\n【説明】\n${description}`


## 6. API・インターフェース仕様 (API Specifications)

Next.js App Router (Route Handlers) を利用した、フロントエンド向けの BFF (Backend For Frontend) API仕様です。
RESTfulなエンドポイント設計を基本としつつ、LLM呼び出しやバッチトリガーを含みます。

### 6.1 銘柄・データ取得API
- **`POST /api/stocks/[ticker]/summary`**
  - **用途**: 個別銘柄の事業要約（ユーザーによる手動補正）を更新します。
  - **処理フロー**: `equities_master` を更新後、Ollamaで再度テキストをベクトル化してQdrantの `company_profiles` を上書きし、GICS分類の再判定までを一連のハイブリッド更新として実行します。
- **`GET /api/ir-news`**
  - **用途**: `ir_news` テーブルから新規事業関連の適時開示資料の一覧（最新50件、またはティッカー指定）を取得します。
- **`GET /api/pdf-preview`**
  - **用途**: ローカル環境に保存されたPDFファイル（決算書やIRニュース等）のパスを受け取り、ブラウザ上で安全にインライン表示（プレビュー）するためのプロキシAPIです。

### 6.2 マイテーマ（ポートフォリオ）管理API
- **`GET /api/themes`**
  - **用途**: 保存済みのマイテーマ一覧と、各テーマの構成銘柄数・トップ3銘柄を取得します。
- **`POST /api/themes`**
  - **用途**: 新規マイテーマを作成し、初期構成銘柄（`custom_theme_stocks`）のバルクインサートを実行します。
- **`DELETE /api/themes/[id]`**
  - **用途**: 単一のマイテーマと構成銘柄を削除します。
- **`POST /api/themes/bulk-delete`**
  - **用途**: 複数のマイテーマ（ID配列）をトランザクション内で一括削除します。
- **`GET /api/themes/[id]/stocks`**
  - **用途**: マイテーマに属する構成銘柄のリスト（基本情報、スコア等）を取得します。ネットワークグラフ描画用データとしても利用されます。
- **`POST /api/themes/[id]/stocks`**
  - **用途**: 既存のマイテーマに単一の銘柄を手動で追加します（重複時はスキップ）。

### 6.3 動的テーマ検索・リランカー連携API
- **`POST /api/themes/expand-query`**
  - **用途**: ユーザーが入力した自然言語（例：「円安メリット」）を、Qwen2.5 (14B) モデルを用いて関連する周辺キーワード（具体的な要素技術や製品名）に拡張・抽出します。出力を厳格に安定させるため、Few-Shotプロンプトと `num_ctx: 2048` を使用します。
- **`POST /api/themes/search`**
  - **用途**: 高度なハイブリッドテーマ検索を実行します。
  - **処理フロー**:
    1. **拡張キーワードによる同時検索**: QdrantのDense検索（`company_profiles` コサイン類似度）と、SQLiteのSparse検索（`equities_fts` BM25）を並行実行。
    2. **Local RRF (Reciprocal Rank Fusion)**: 定数 `K = 60` を用いて Dense と Sparse の順位を融合（`Score = 1 / (60 + DenseRank) + 1 / (60 + SparseRank)`）。上位100件（Top 100）を抽出。
    3. **Python Cross-Encoder リランカー呼び出し (ポート8000)**:
       - **エンドポイント**: `POST http://127.0.0.1:8000/rerank`
       - **リクエスト仕様**:
         ```json
         {
           "query": "拡張検索プロンプト（string）",
           "documents": ["候補銘柄のsummaryまたはtheme_keywords配列（string[]）"]
         }
         ```
       - **レスポンス仕様**:
         ```json
         {
           "scores": [1.45, -0.23, ...] // 生の未正規化Logit値（float[]）
         }
         ```
       - **スコア統合・ソート処理**:
         - 返却された各銘柄の生スコアを `rerank_score` に格納し、表示スコア `search_score` を `rerank_score` で上書き。
         - リランカーAPIエラーまたはタイムアウト時は、フォールバックとして元の `rrfScore` を維持。
         - 全件を `search_score` の降順でソートし、最上位50件（Top 50）をフロントエンドへ返却。
- **`GET /api/themes/anomalies`**
  - **用途**: `gics_audit_status = 'ERROR'` の銘柄を検索し、LLM監査によってGICS分類が不適切と判定された異常値銘柄を検知・取得します。

### 6.4 バッチ制御トリガーAPI
Next.jsのAPIコンテキストから、独立したNode.jsのバックグラウンドジョブをキックするためのエンドポイントです。

- **`POST /api/batch/reclassify`**
  - **用途**: `run_gics_classification.ts` 等を呼び出し、業種再分類やテーマの再判定バッチを非同期でトリガーします。
- **`POST /api/batch/audit-gics`**
  - **用途**: 未監査（`PENDING`）またはエラーとなっている銘柄に対し、`run_llm_audit_batch.ts` を呼び出してGICS分類のLLM監査を非同期で一括実行します。
- **`POST /api/data-sync`**
  - **用途**: フロントエンドのSyncボタンから呼び出され、データ同期からAI決算解析、テクニカル・SEPA指標再計算までを一気通貫で行うオーケストレーションジョブ（`syncJQuants`）をトリガーします。
  - **処理フロー**: 
    1. J-Quantsからの日足・財務等の差分取得と株式分割の遡及調整。
    2. J-Quantsの更新をトリガーとしつつ、ローカルに実在する最新のPDFファイルを逆引きして参照。新規の「決算短信PDF」が存在する場合にのみパース、セグメント情報抽出を実行します。過去決算が存在する場合は差分比較を、存在しない場合は単独分析によるAIアナリストレポートの自動生成を行います（`processEarningsReports` -> `generateAiReport`）。
    3. 全銘柄スクリーナー指標の再計算と `stocks` テーブルの更新（`calculateAndPopulateStocks`）。
    4. ミネルヴィニSEPA指標・VCP候補の全件再計算と `sepa_metrics` テーブルの更新（`calculateAndPopulateSepa`）。
  - **レスポンス**: `text/event-stream` (Server-Sent Events) でストリーミングされ、各処理ステップで `{"type": "progress", "message": "..."}` を返し、完了時に `{"type": "done"}` を返します。

### 6.5 SEPA (ミネルヴィニ分析) BFF API群
SEPAダッシュボードおよび個別診断ビューをサポートするRoute Handlers群です。

- **`GET /api/sepa/trend`**
  - **用途**: `sepa_metrics` テーブルからStage 2トレンドテンプレート銘柄一覧を取得します。
  - **クエリパラメータ**:
    - `filter`: 
      - `'tier1'`: Stage 2 + コア成長 (`is_trend_template_pass = 1 AND sales_yoy_pct >= 10.0 AND (eps_yoy_pct >= 20.0 OR growth_status = 'TURNAROUND')`, デフォルト推奨)
      - `'all_pass'`: Stage 2 全件 (`is_trend_template_pass = 1`)
      - `'ipo_only'`: IPO急成長株 (`is_ipo = 1`)
      - `'turnaround'`: 黒字転換 (`growth_status = 'TURNAROUND'`)
      - `'all'`: 全銘柄
    - `exclude_etf`: 投信・ETF・ETN・REIT等の非事業会社を除外 (`'true'` または未指定の場合 `is_operating_company = 1`、`'false'` で全銘柄)
    - `min_rs`: RSレーティング下限（例: `80`）
    - `accelerating`: `'true'` の場合 成長加速 (`is_growth_accelerating = 1`。売上>=10%またはEPS>=15%ガード付き)
    - `margin_expansion`: `'true'` の場合 営業利益率改善 (`is_margin_expanding = 1`)
    - `min_roe`: ROE下限（%）（例: `15.0`。純資産ゼロ以下の債務超過はNULL判定で除外）
    - `annual_growth`: `'true'` の場合 3期連続年間EPSプラス成長 (`has_3y_annual_growth = 1`)
    - `sweet_spot_cap`: `'true'` の場合 時価総額100〜1,000億円 (`market_cap >= 100 AND market_cap <= 1000`)
    - `mid_large_cap`: `'true'` の場合 時価総額300〜3,000億円 (`market_cap >= 300 AND market_cap <= 3000`)
    - `min_liquidity`: `'true'` の場合 5日平均売買代金1億円以上 (`avg_trading_value_5d >= 1.0`)
    - `search`: ティッカーまたは銘柄名の部分一致検索
    - `sort_by`: ソート対象カラム名 (`ticker`, `current_price`, `rs_rating`, `passed_conditions_count`, `stage2_entry_date`, `sales_yoy_pct`, `eps_yoy_pct`, `funda_score`, `market_cap`)
    - `order`: 昇順/降順 (`'asc'` または `'desc'`, デフォルト `'desc'`)
    - `page`: ページ番号 (デフォルト `1`)
    - `limit`: 1ページあたりの件数 (デフォルト `50`, 最大 `100`)
  - **レスポンス形式**:
    ```json
    {
      "success": true,
      "data": [ /* SepaStockRecord 配列 (funda_score 含む) */ ],
      "total": 241,
      "page": 1,
      "limit": 50,
      "totalPages": 5
    }
    ```

- **`GET /api/sepa/vcp-candidates`**
  - **用途**: VCP収縮、ピボットブレイクアウト候補、および25日/50日SMAプルバック（押し目）銘柄一覧を取得します。
  - **クエリパラメータ**:
    - `mode`: 
      - `'strict_funda'`: Stage 2 + コア成長 Tier 1 (`is_trend_template_pass = 1 AND rs_rating >= 80` かつ 売上+10%↑, EPS+20%↑/黒字転換, デフォルト)
      - `'stage2_pullback_25'`: ★ 25日SMA押し目モード (`is_pullback_25 = 1 AND rs_rating >= 75`。構造的Stage 2 + 高値調整 -3%〜-12% + 25日線乖離 -1.5%〜+3.5% + 出来高枯渇比 <= 0.75 + 大商い下落日なし + 60日最大DD >= -30%)
      - `'stage2_pullback_50'`: 50日SMA押し目モード (`is_pullback_50 = 1 AND rs_rating >= 75`。構造的Stage 2 + 高値調整 -5%〜-20% + 50日線乖離 -2.0%〜+3.5% + 出来高枯渇比 <= 0.75 + 大商い下落日なし + 60日最大DD >= -30%)
      - `'all'`: 全VCP候補 `is_trend_template_pass = 1 AND (is_near_pivot = 1 OR is_volume_dryup = 1 OR is_volatility_contracted = 1)`
    - `sweet_spot_cap`: `'true'` の場合 時価総額100〜1,000億円のオーバーレイ (`market_cap >= 100 AND market_cap <= 1000`)
    - `mid_large_cap`: `'true'` の場合 時価総額300〜3,000億円のオーバーレイ (`market_cap >= 300 AND market_cap <= 3000`)
    - `min_liquidity`: `'true'` の場合 5日平均売買代金1億円以上のオーバーレイ (`avg_trading_value_5d >= 1.0`)
    - `exclude_etf`: 投信・ETF・ETN・REIT等の非事業会社を除外 (`'true'` または未指定の場合 `is_operating_company = 1`、`'false'` で全銘柄)
    - `sort_by`: ソート対象カラム名 (`ticker`, `current_price`, `pivot_price`, `pivot_distance_pct`, `dist_sma25_pct`, `dist_sma50_pct`, `pullback_depth_pct`, `min_vdu_ratio`, `atr_contraction_ratio`, `volume_dryup_ratio`, `rs_rating`, `market_cap`, `funda_score`)
    - `order`: 昇順/降順 (`'asc'` または `'desc'`, デフォルト `'desc'`)
    - `page`: ページ番号 (デフォルト `1`)
    - `limit`: 1ページあたりの件数 (デフォルト `50`, 最大 `100`)
  - **ソート順**: 
    - `stage2_pullback_25`: 未指定時は `ORDER BY rs_rating DESC, dist_sma25_pct ASC`
    - `stage2_pullback_50`: 未指定時は `ORDER BY rs_rating DESC, dist_sma50_pct ASC`
    - その他通常時: 未指定時は `ORDER BY is_pivot_breakout DESC, is_near_pivot DESC, pivot_distance_pct DESC, rs_rating DESC`
  - **レスポンス形式**:
    ```json
    {
      "success": true,
      "data": [ /* SepaStockRecord 配列 */ ],
      "total": 42,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
    ```

- **`GET /api/sepa/diagnostics/[ticker]`**
  - **用途**: 指定銘柄のSEPA詳細診断情報（Stage2の8条件判定、四半期単体ファンダメンタルズ、VCP・ピボット状態、および直近300日分の日足時系列チャートデータ）を取得します。
  - **レスポンス形式**:
    ```json
    {
      "success": true,
      "data": {
        "stock": { /* SepaStockRecord */ },
        "quotes": [
          { "date": "2026-03-31", "open": 2500, "high": 2550, "low": 2480, "close": 2530, "volume": 120000 }
        ]
      }
    }
    ```

## 7. コアロジックと計算アルゴリズム (Core Logic & Algorithms)

本章では、スクリーナーで利用されるテクニカル・ファンダメンタル指標の厳密な物理計算式、マーク・ミネルヴィニ SEPA 計算エンジン、東証ハード制約、およびkabu3.0のドメイン固有の知能を司るLLMの完全なプロンプト群を網羅して定義します。

### 7.1 テクニカル・ファンダメンタル指標計算式 (`src/lib/calculator.ts`)
スクリーナー表示やアラート提供のためにSQL（またはTS）で計算される各指標の厳密な物理定義です。

- **時価総額 (億円)**: `最新株価 * 調整後発行済株式数 / 100,000,000`
- **TTM 純利益および TTM PER (株価収益率)**:
  日本企業の四半期累計開示特性に対応したロールオーバー（LTM/TTM）純利益から逆算します。
  - 最新開示が通期（FY）の場合:
    $`TTM\_Profit = 最新通期当期純利益 (latest\_fy\_profit)`$
  - 最新開示が第1〜第3四半期（Q1〜Q3）の場合（累計ロールオーバー式）:
    $`TTM\_Profit = 前年度通期純利益 + 当期累計純利益 - 前年同期累計純利益`$
  - $`TTM\_EPS = TTM\_Profit / adj\_shares\_outstanding`$
  - $`PER = 最新株価 / TTM\_EPS`$ (※前期純利益がゼロ以下の場合は `NULL`)
- **PBR (株価純資産倍率)**: `最新株価 / (自己資本 / 発行済株式数)`
- **ROE (自己資本利益率, %)**: `TTM_Profit / 自己資本 * 100`
- **ROA (総資産利益率, %)**: `TTM_Profit / 総資産 * 100`
- **営業利益率 (%)**: `営業利益 / 売上高 * 100`
- **自己資本比率 (%)**: `(equity_to_asset_ratio) * 100`
- **配当利回り (%)**: `調整後予想配当 / 最新株価 * 100`
- **成長率指標 (売上/営利/EPS)**: `(次期予想 / 前期実績 * 100) - 100` ※前期が0以下の場合は異常値となるため `NULL` として除外。
- **予想達成率 (%)**: `営業利益実績 / 次期予想営業利益 * 100`
- **単純移動平均 (SMA 25/75/200)**: 過去指定日数の `adj_close` の平均。
- **SMA乖離率 (%)**: `(現在値 - SMA) / SMA * 100`
- **RSI (14日)**: `14日間の平均値上がり幅 / (14日間の平均値上がり幅 + 平均値下がり幅) * 100`
- **MACD**: `12日EMA - 26日EMA` (MACDシグナルはMACDの9日EMA)
- **ATR (Average True Range, 14日)**: `Max(当日高値-当日安値, 当日高値-前日終値, 前日終値-当日安値)` の14日間平均。
- **パーフェクトオーダー**: `現在値 > SMA25 AND SMA25 > SMA75 AND SMA75 > SMA200` がすべて成立。
- **ゴールデンクロス**: `当日: SMA25 > SMA75 AND 前日: SMA25 <= SMA75`
- **高値ブレイクアウト**: `当日の高値 >= 過去N日間(20日, 60日, 52週)の最高値`
- **出来高倍率 (`volume_ratio`)**: `当日の出来高 (current_volume) / 過去25日間の平均出来高 (avg_volume_past_25d)`
- **売買代金倍率 (`trading_value_ratio`)**: `当日の売買代金 (current_turnover) / 過去25日間の平均売買代金 (avg_turnover_past_25d)`
- **決算リアクション (%)**: `(決算翌日の終値 - 決算前日の終値) / 決算前日の終値 * 100`

### 7.2 マーク・ミネルヴィニ SEPA 計算エンジン (`src/lib/sepa/`)
株式投資の世界的名著『ミネルヴィニの成長株投資法』に基づく、Stage 2 上昇トレンド、ファンダメンタル急加速、およびVCP（ボラティリティ収縮パターン）の物理計算エンジンです。

#### 7.2.1 3ヶ月単独期（QoQ）ファンダメンタル算出 (`quarterly_parser.ts`, `quarterly_standalone.ts`)
日本の有価証券報告書・決算短信の累計開示データから、正確な「3ヶ月単独四半期」の実績を決定論的パイプラインによって復元・比較します。適時開示（業績予想修正・配当予想等）による実績空行の混入や訂正開示による重複を完全に排除します。

- **決定論的5段階パイプライン**:
  1. **実績値フィルタリング**: 売上高・営業利益・純利益がすべて null の適時開示・予想のみの空行（`net_sales == null && operating_profit == null`）を前段で厳格に除外。
  2. **同一決算期の訂正開示スマートマージ**: 同一決算対象期末日（`period_end_date`）を持つ開示が複数存在する場合、適時開示日（`date`）が最も新しいレコードを正とし、過去の訂正前数値を排除。
  3. **決算期末日（`period_end_date`）による昇順ソート**: 開示順ではなく会計期間の時系列順に正しく並べる。
  4. **3ヶ月単独値の物理減算復元（直前四半期欠損ガード付き）**:
     - Q1単独: $Q1$（期初3ヶ月実績そのまま）
     - Q2単独: 直前が同一年度の1Qの場合のみ $Q2_{累計} - Q1$
     - Q3単独: 直前が同一年度の2Qの場合のみ $Q3_{累計} - Q2_{累計}$
     - Q4単独: 直前が同一年度の3Qの場合のみ $通期実績 - Q3_{累計}$
     - ※直前四半期が未開示・欠損している場合は、決して1Qや2Qを引いて偽の数値を捏造せず、単体値算出不可（`is_irregular_period`）として安全に処理。
  5. **前年同期比較（YoY）の特定**: `period_end_date` の差分日数（300日〜420日）に基づいて前年同四半期を厳密に特定し成長率を算出。
- **QoQ 成長率**: 前年同期の3ヶ月単独実績との前年同期比（YoY）を算出。
- **ミネルヴィニ SEPA 2層型ファンダメンタルズ判定（Tier 1 & Tier 2）**:
  - **Tier 1: 基本ハードフィルター（必須AND）**:
    実戦的な成長株母集団を形成する中核条件。全条件の無分別なAND結合による過剰絞り込みを防ぎ、市場から優良な急成長株（約240銘柄）を適確に抽出：
    1. **Stage 2 上昇トレンド（テクニカル8条件適合）**: `is_trend_template_pass = 1`
    2. **直近四半期 EPS急成長**: 前年同期比 $+20\%$ 以上、または黒字転換（`TURNAROUND`）
    3. **直近四半期 売上高成長**: 前年同期比 $+10\%$ 以上
    4. **事業会社（株式）限定**: 投信・ETF・REIT等を除外（`is_operating_company = 1`）
  - **Tier 2: 発展（スコアリング・バッジ表示・オプショントグル）**:
    Tier 1 該当銘柄の中で、ミネルヴィニの理想条件の兼備状況を4点満点（0〜4）でスコアリング評価し、UIにバッジ表示・ソート対応。オプショントグルで任意絞り込み可能：
    1. **成長加速（`is_growth_accelerating`）**:
       - 単純な前期比比較による赤字縮小（-50% $\to$ -20%）や低成長（+1% $\to$ +3%）の誤検知を排除するため、「売上加速かつ売上YoY $\ge +10\%$」または「EPS加速かつEPS YoY $\ge +15\%$」を必須足切り水準とする。
    2. **営業利益率の改善（`is_margin_expanding`）**:
       - 直近四半期の営業利益率（OP / Sales） $>$ 前年同期の営業利益率。
    3. **年間持続性（`has_3y_annual_growth`）**:
       - 株式分割調整後EPS（`adj_eps`）で直近3年間連続プラス成長（赤字転落なし）。IPO株は開示年数に応じたバイパス判定（2期または1期）を適用。
    4. **高ROE（`roe >= 15.0%`）**:
       - 債務超過企業（純資産 $\le 0$）が「マイナス $\div$ マイナス」で正のROEとしてすり抜ける致命的トラップを排除し、債務超過時は強制的にNULL除外。
    5. **時価総額スイートスポット & 最低流動性（独立オーバーレイ）**:
       - 時価総額100〜1,000億円、5日平均売買代金1億円以上は独立トグルとして提供し、超大型主導株を純ファンダメンタルズから排除しない設計。
- **ステータス判定（`growth_status`）**: 本業の収益力である営業利益（OP）の正負推移を主軸とし、投資的に妥当な判定を実施：
  - **黒字転換 (`TURNAROUND`)**: 前年同期が営業赤字（OP $\le 0$）から当期営業黒字（OP $> 0$）へ転換。または営業黒字維持下で純利益が黒字転換。
  - **赤字転落 (`DEFICIT_FALL`)**: 前年同期が営業黒字（OP $> 0$）から当期営業赤字（OP $\le 0$）へ転落（※営業利益が黒字を維持している場合は、特損等で最終赤字になってもDEFICIT_FALLにはせず特損リスク警告を付与）。
  - **赤字縮小 (`LOSS_REDUCTION`)**: 前年営業赤字かつ当期営業赤字で、赤字幅が縮小（当期OP $>$ 前年OP）。
  - **赤字拡大 (`LOSS_EXPANSION`)**: 前年営業赤字かつ当期営業赤字で、赤字幅が拡大（当期OP $\le$ 前年OP）。
  - **大成長 (`EXPLOSIVE_GROWTH`)**: 営業・純利ともに黒字で、EPS YoY $\ge +300\%$ かつ 売上YoY $\ge +10\%$。
  - **成長・黒字 (`GROWTH`)**: 通常の黒字成長。
- **EPS加速 (`eps_acceleration`)**: 最新QのEPS成長率 > 前QのEPS成長率 かつ 最新Q成長率 $\ge +15\%$
- **売上加速 (`sales_acceleration`)**: 最新Qの売上成長率 > 前Qの売上成長率 かつ 最新Q成長率 $\ge +10\%$
- **営業利益率拡大 (`margin_expansion`)**: 最新Qの営業利益率（OP / Sales） > 前年同期の営業利益率
- **Q4会計ノイズガード**: 売上YoYが+10%未満なのにEPSだけが急増（+300%以上）している場合、または営業黒字なのに最終赤字の場合は一過性の特殊要因（資産売却・特損等）とみなし、警告フラグ（`has_accounting_noise_risk: true`）を付与。
- **スクリーナー指標（`calculator.ts`）との整合性**: スクリーナー（`stocks` テーブル）の最新決算指標（PER, PBR, ROE, 営業利益率等）抽出においても、実績空行を除外する `WHERE (net_sales IS NOT NULL OR operating_profit IS NOT NULL OR profit IS NOT NULL)` を適用し、全銘柄で数値の一致を担保。債務超過銘柄のROE/PBRはNULL化。

#### 7.2.2 トレンドテンプレート判定・掲載日算出 (`trend_calculator.ts`)
ミネルヴィニのStage 2上昇トレンドを判定する8大条件：
1. **株価 > 150日SMA かつ 株価 > 200日SMA**
2. **150日SMA > 200日SMA**
3. **200日SMAが上向き（最低1ヶ月/22営業日以上）**: 22日間のSMA200の線形回帰傾きがプラス（$\beta > 0$）
4. **50日SMA > 150日SMA かつ 50日SMA > 200日SMA**
5. **株価 > 50日SMA**
6. **株価が52週安値から最低30%以上上昇（$\ge +30\%$）**
7. **株価が52週高値から25%以内（`within_52w_high_pct` $\ge -25\%$）**
8. **RSレーティング $\ge 70$（後述）**
※IPO新興株バイパス: 200営業日未満のIPO銘柄については、SMA200関連条件をスキップし、データ存在する期間（SMA50等）でのみ判定。
- **掲載日（Stage 2突入日：`stage2_entry_date`）の遡及算出**:
  - 最新日でStage 2に合致した銘柄に対し、日足過去データを直近から過去へ順次遡り（Backwards Walk）、8条件を満たし続けた最も古い連続期間の開始日を突入日として特定・記録。リストから一時脱落した後に復帰した場合でも、最新の突入日が記録されます。

#### 7.2.3 独自レラティブストレングス（RS）パーセンタイル算出 (`rs_calculator.ts`)
日本市場全上場銘柄（約4,200銘柄）を母集団として、IBD方式の加重株価パフォーマンスを算出し、1〜99のパーセンタイル順位を付与。
- **加重スコア式**: $Score = 2 \times P_{63} + P_{126} + P_{189} + P_{252}$ （直近四半期のパフォーマンスを2倍に加重）
- **上場廃止銘柄の自動除外**: 市場全体の最新取引日（`latest_market_date`）から10カレンダー日以上更新のない銘柄は、RS計算母集団およびSEPA指標算出から自動除外。

#### 7.2.4 VCP（ボラティリティ収縮）およびベース・ピボット算出 (`vcp_screener.ts`)
1. **ベース期間高値（`base_high`）**: 直近65営業日から直近2営業日までの終値最高値。
2. **ベース深さ（`base_depth_pct`）**: ベース期間最高値からの最大下落率。ベース深さが35%超（$-35\%$ 未満）の場合は深いベースとして除外。
3. **真のピボット（`pivot_price`）**: 直近2〜15営業日前（ハンドル形成部）の終値最高値を真のピボットとする（当日・前日のノイズを避けるため2営業日前から）。
4. **ピボット健全性ガード（`is_handle_healthy`）**: ハンドル部ピボットが高値から深く押しすぎていないかを検証（$pivot\_price \ge base\_high \times 0.85$）。15%以上乖離した安値圏の局所高値はピボットとして不適格。
5. **ボラティリティ収縮率（`atr_contraction_ratio`）**: 直近10日ATR / 過去50日ATR が $0.70$ 未満（過去平均より30%以上の値幅収縮で `is_volatility_contracted = 1`）。
6. **出来高ドライアップ率（`volume_dryup_ratio`）**: 直近5日平均出来高 / 過去50日平均出来高 が $0.60$ 未満（過去平均の60%以下に売り玉枯渇で `is_volume_dryup = 1`）。
7. **セットアップ・ブレイクアウト判定**:
   - ピボット接近（セットアップ圏内: `is_near_pivot`）: 健全ハンドル（$pivot \ge base\_high \times 0.85$）かつ 当日終値がピボット価格の $-5.0\% \sim 0.0\%$ 圏内。
   - ピボットブレイクアウト（`is_pivot_breakout`）: 健全ハンドル かつ 当日終値がピボット価格を上放れ（$0.0\% \sim +3.0\%$）かつ 当日出来高が50日平均の1.5倍以上（$Volume_{today} \ge Vol_{50d\_avg} \times 1.5$）。

#### 7.2.5 ミネルヴィニ流プルバック（押し目）物理計算エンジン (`vcp_screener.ts`)
ブレイクアウト後の初押し、または強力な上昇トレンド中の移動平均線サポート（25日SMAおよび50日SMA）からの反発局面を機械的かつ厳密に検知するアルゴリズムです。

1. **構造的Stage 2（`is_trend_structural_pass`）**:
   - プルバック中（特に50日線テスト時）は、終値が一時的に50日線をわずかに下回る押し目（$-2.0\% \sim 0.0\%$）があり得るため、通常の `Close > SMA50` 必須縛りを外し、「SMA50 > SMA150 > SMA200 かつ 200日線スロープ $> 0$」をベーストレンド前提とする。
2. **直近20日スイング高値（`swing_high_20d`）と健全な押し幅（`pullback_depth_pct`）**:
   - 天井圏での単なる横ばい（偽押し目）を排除するため、直近20営業日高値が移動平均線から最低 $+3.5\%$ 以上上に乖離していることを必須とする。
   - **25日SMA押し目**: スイング高値からの下落率が $-3.0\% \sim -12.0\%$（モメンタム維持の浅い押し）。
   - **50日SMA押し目**: スイング高値からの下落率が $-5.0\% \sim -20.0\%$（機関投資家防衛ラインへの本格調整）。
3. **サポート移動平均線との乖離率（`dist_sma25_pct`, `dist_sma50_pct`）**:
   - **25日SMAサポート**: 当日終値が25日SMAの $-1.5\% \sim +3.5\%$ 圏内。
   - **50日SMAサポート**: 当日終値が50日SMAの $-2.0\% \sim +3.5\%$ 圏内。
4. **出来高枯渇比（`min_vdu_ratio`）**:
   - 直近5営業日間の最小出来高 / 過去50日平均出来高 が $\le 0.75$（直近5日間に一度でも出来高が50日平均の75%以下に干上がった「出来高枯渇＝売り玉出尽くし」が発生）。
5. **大商い下落日ディストリビューション排除ガード（`has_distribution_day`）**:
   - 直近5日間に、前日比マイナスかつ出来高が50日平均の1.5倍以上の大陰線売り抜け日が存在する場合は即座に除外（`has_distribution_day = 0` 必須）。
6. **過去60営業日最大ドローダウン（DD）ガード（`max_dd_60d`）**:
   - 過去60営業日（約3ヶ月）以内の最高値から最安値への最大下落率が $-30.0\%$ を超えて売られた銘柄（チャート崩壊・大暴落銘柄）を排除（`max_dd_60d >= -30.0%`）。
7. **長期線急落ブレイクダウン排除ガード**:
   - 直近20営業日以内に一度でも終値が200日SMAを $5\%$ 以上割り込んだ（$Close < SMA200 \times 0.95$）ことがある銘柄を排除。
8. **RSレーティング**:
   - 市場上位 $25\%$ 以内の強さを持つ銘柄に限定（`rs_rating >= 75`）。
9. **ブレイク後押し目（First Pullback）および偽ブレイク防衛ロジック**:
   - `is_pullback_25 = 1` または `is_pullback_50 = 1` の銘柄に対し、直近3〜30営業日前（$T_{BO} \in [3, 30]$）のブレイクアウトを探索：
     - **出来高急増**: $Volume[T_{BO}] \ge \text{当時50日平均出来高} \times 1.3$
     - **上ヒゲ排除（CLV）**: $CLV = \frac{Close[T_{BO}] - Low[T_{BO}]}{High[T_{BO}] - Low[T_{BO}]} \ge 0.70$（上位30%以内の高値引け大陽線）
     - **防衛1: 過去60営業日（約1四半期）高値突破**: $Close[T_{BO}] > \max(High[T_{BO}-60 \dots T_{BO}-1])$（底値圏の戻り売り壁を確実に判定窓に含める）
     - **防衛2: ブレイク日時点の Stage 2 健全性**: $SMA50[T_{BO}] > SMA200[T_{BO}]$ かつ $Close[T_{BO}] > SMA50[T_{BO}]$
     - **防衛3: 52週高値から -15% 以内**: $Close[T_{BO}] \ge High_{52w}[T_{BO}] \times 0.85$
     - **防衛4: 押し目健全深さガード**: ブレイク後最高値からの調整率が25MA押し目なら $\ge -12.0\%$、50MA押し目なら $\ge -20.0\%$

### 7.3 東証33業種 -> GICS ハード制約マッピング (`TSE_TO_GICS_MAPPING`)
ハルシネーションによる大分類の誤りを防ぐため、`src/lib/anomaly_detector.ts` 等で定義された `TSE_TO_GICS_MAPPING` を利用します。
- (例) `情報・通信業` $\to$ 許可されるGICSセクター: `情報通信`, `一般消費財・サービス`, `資本財`, `金融`, `ヘルスケア`, `不動産`
- (例) `銀行業` $\to$ 許可されるGICSセクター: `金融`
※この制約フィルターを通過しないGICSカテゴリは、どれだけベクトル類似度が高くても棄却されます。

### 7.4 RAGパイプライン・プロンプト設計と安全装置
決算書PDFや四季報データから情報を抽出・分類するためのプロンプト設定です。すべて `gemma3:12b` (Ollama) に最適化されています。

#### 7.4.1 決算書PDF抽出プロンプト (src/scripts/rag/theme_prompts.ts, src/lib/segment_extractor.ts)

**Stage 3: Qdrantプレーンテキスト抽出用 (フォールバック)**
```text
あなたは企業の決算説明資料から、事業セグメントとその売上高を抽出する専門家です。
以下のテキストから、報告されている事業セグメント名と、その売上高（または収益）を抽出してください。

【厳格なルール】
- 以下のフォーマットの箇条書きテキストとして出力してください。余計な文章は一切含めないでください。
  - セグメント: [セグメント名], 売上高: [数値]
  - セグメント: [セグメント名], 売上高: [数値]
- 「国内」「海外」「日本」「北米」などの地域別売上や、「第1四半期」「上期」などの期間別データ、または「売上高」「営業利益」などの単なる勘定科目しかない場合は、セグメント情報ではないため、絶対に「なし」とだけ出力してください。
- 該当するセグメント情報が見つからない場合も「なし」と出力してください。

【テキスト】
{context}
```

**Pass 2: セグメント事業内容・深掘り抽出用**
```text
あなたはデータ抽出アシスタントです。以下のテキストから、指定された各セグメントの事業内容（具体的な製品名、サービス名、対象顧客など）を抽出してください。
テキストに記載がない場合は「記載なし」としてください。

【対象セグメント】
- {segmentName1}
- {segmentName2}

【厳守事項】
1. セグメント名をそのまま繰り返すのではなく、関連キーワード（製品名など）を必ず拾うこと。
2. 存在しない情報を勝手に推測したり捏造したりしないこと。
3. 出力は以下のJSON形式のみとし、マークダウンで囲まないでください。JSONの値に改行を含めないでください。

{
  "segments": [
    { "segment": "セグメント名", "description": "事業内容の要約" }
  ]
}

【テキスト】
{pass2Text}
```

**Step 2: アナリスト1文要約用**
```text
あなたはプロの証券アナリストです。以下の企業のセグメント別売上構成と参考情報を基に、この企業がどのようなビジネスを中核としているか、投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない推測や、企業名の直訳・妄想は絶対に禁止します。具体的な企業名を要約に含めることを禁止します。

【企業名】: {companyName} ({ticker5})

{refInfo}
【売上が最大の主力セグメント】: {maxSegment.segment}（{maxSegment.description}）
【その他の展開セグメント】:
- {otherSegment1.segment}（{otherSegment1.description}）
- {otherSegment2.segment}（{otherSegment2.description}）

【思考のステップ】
必ず以下の順番で思考してください。
1. 上記の主力事業とその他事業の情報をスキャンし、中核事業を特定する。
2. 決して推測や関連用語からの類推を行わないこと。
3. 指定されたJSONフォーマットのみを出力して終了すること。

【出力形式】
以下のJSONフォーマットのみを出力してください。
{ "summary": "1文要約" }
```

**Plan 1: ハイブリッド要約用（単一セグメント・抽出失敗時フォールバック）**
```text
あなたはプロの証券アナリストです。以下の企業の「四季報プロフィール」と「有価証券報告書の事業内容テキスト」を総合的に判断し、この企業の中核事業を投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない推測や、企業名の直訳・妄想は絶対に禁止します。具体的な企業名を要約に含めることを禁止します。

【企業名】: {companyName} ({ticker5})

【四季報プロフィール（参考）】
- 事業概要: {shikihoSummary}
- キーワード: {shikihoKeywords}

【有価証券報告書テキスト（抜粋）】
{earningsText}

【思考のステップ】
必ず以下の順番で思考してください。
1. テキスト全体を1度だけスキャンし、中核事業を特定する。
2. 決して推測や関連用語からの類推を行わないこと。
3. 指定されたJSONフォーマットのみを出力して終了すること。

【出力形式】
以下のJSONフォーマットのみを出力してください。
{ "summary": "1文要約" }
```

#### 7.4.2 決算アナリストレポート生成プロンプト (`src/scripts/analyze_stock_rag.ts`)
2つのドキュメント（前回決算と最新決算）の差分を抽出し、プロのアナリスト文章に清書します。

**Step 1: 事実抽出ボット（System Prompt）**
```text
あなたは無機質なデータ転記ボットです。推論、要約、単位変換を一切行わず、提供されたテキストから事実のみを抽出してください。
【厳守事項】
1. 計算・四則演算の禁止: 数値はテキストにあるものをそのまま抽出すること。「足し算・引き算・パーセンテージ計算・金額単位変換」を絶対に行わないこと。
2. 事実のコピペに徹する：テキストに書かれていない単語は絶対に補完・捏造しないでください。
3. 対象データの限定：「連結（Consolidated）」の数値を優先し、「個別」は無視してください。
4. 出力はJSONのみ：以下のJSONスキーマの形式で出力し、マークダウンのコードブロックで囲むこと。
5. ※もし該当する情報が全くない場合は、捏造せず「記載なし」と出力してください。
```

**Step 2: アナリスト清書（System Prompt）**
```text
あなたはプロの証券アナリストです。
提供された【抽出済み決算データ】のみを情報源として、最終的な決算アナリストレポートを作成してください。
【厳守事項】
1. 外部知識の完全遮断：提供されたデータ内に存在しないキーワードを勝手に生成しないでください。事実ベース以外の推測（ハルシネーション）は厳禁です。
2. アナリストのトーン：事実に忠実でありつつ、証券アナリストとしての専門的な語彙を用いて、論理的でプロフェッショナルな文章に整えてください。
3. インプリケーション（示唆）の提示：'ai_comment'の項目では、提供された事実データから論理的に導き出せる「総合的な評価と今後の展望」を鋭く記述してください。
4. 全項目の統合出力：提供された3つのデータの内容を清書し、あなた自身の「ai_comment」を追加した4つの項目でJSONを出力してください。
5. 【重要】データ型の厳守：出力するJSONのすべての値（value）は、必ず「プレーンテキストの文字列（String）」にしてください。配列やオブジェクトを絶対に使用しないでください。
6. ※もし抽出データが全くなく、評価が不可能な場合は、捏造せず各項目に「記載なし」または「評価不能」と出力してください。
```

#### 7.4.3 GICS 3段階分類・再分類プロンプト (src/scripts/run_gics_classification.ts, src/features/gics/classifier.ts)

**Stage 1 (Top 10 → Top 3 絞り込み)**
```text
「{companyName}」について「事業要約」、「機能的価値 キーワード」、「メイン事業セクション」、「サブ事業セクション」の4つの情報をもとに、関連性が高いテーマをテーマリストから最大3つ選び、文字列のJSON配列として回答してください。例: ["テーマA", "テーマB", "テーマC"]
最優先判定基準: 【メイン事業セクション】の売上規模および事業内容に最も直接合致するテーマを必ず1つ以上含めてください。

企業名：{ticker} {companyName}
事業要約：{summary}
機能的価値 キーワード：
{keywords}
【メイン事業セクション】
{mainSegmentJson}
【サブ事業セクション】
{subSegmentsJson}
テーマリスト
{themeListText}
```

**Stage 2 (Top 3 → 最終1つに決定)**
```text
以下の3つの候補の中から、「{companyName}」の事業内容に最も一致するテーマを1つ選び、テーマ名のみ回答してください。

企業名：{ticker} {companyName}
事業要約：{summary}
機能的価値 キーワード：
{keywords}

【メイン事業セクション】
{mainSegmentJson}

【サブ事業セクション】
{subSegmentsJson}

テーマリスト
{themeListText2}
```

**Stage 3 (LLM Audit 異常値検知)**
※実行環境（Ollama または Gemini）に応じてプロンプトを分岐させています。

*(1) Ollama用プロンプト (推論プロセス強制型)*
```text
あなたは厳格なGICS分類の監査役です。
企業の実態とGICS分類の間に矛盾がないか監査してください。

企業情報:
{companyName}

事業要約: 
{summary}
メイン事業：{mainSegmentJson}
サブ事業：{subSegmentsJson}

判定されたGICS細分類: 
{finalGicsName}
判定されたGICS細分類の説明：
{finalGicsDescription}

判定を出す前に、必ず以下の【ステップ1】を埋めてから、【ステップ2】を出力してください。

【ステップ1：属性の強制言語化】

提供価値： [物理的なモノ / デジタル・データ / 人的サービス] のどれか

顧客対象： [BtoB（企業向け） / BtoC（一般消費者向け）] のどちらか

ビジネス形態： [開発・製造 / 流通・小売り / インフラ提供] のどれか

【ステップ2：矛盾判定】
ステップ1で書き出した企業の実態と、判定されたGICS細分類の説明を比較し、明確な矛盾（ねじれ）があれば [ERROR] と理由を、妥当であれば [OK] を出力してください。
```

*(2) Gemini用プロンプト (JSONスキーマモード適用時)*
```text
あなたは厳格なGICS分類の監査役です。
企業の実態とGICS分類の間に矛盾がないか監査し、明確な矛盾（ねじれ）があれば ERROR と理由を、妥当であれば OK と出力してください。

企業情報:
{companyName}

事業要約: 
{summary}
メイン事業：{mainSegmentJson}
サブ事業：{subSegmentsJson}

判定されたGICS細分類: 
{finalGicsName}
判定されたGICS細分類の説明：
{finalGicsDescription}
```

#### 7.4.4 動的テーマ検索・キーワード拡張プロンプト (`src/app/api/themes/expand-query/route.ts`)
自然言語検索時に入力された曖昧なクエリを、FTS5（Sparse Search）で検索可能な周辺キーワードに拡張します。
```text
あなたは日本株式市場のテーマ投資検索システム向けクエリ拡張AIです。
ユーザーから入力された投資テーマに対し、企業の事業説明文に実際に含まれる【具体的な要素技術、電子部品、インフラ、サプライチェーンの製品名】をカンマ区切りで5個だけ日本語で出力してください。
出力形式の例：
A, B, C, D, E
※上記のように単語のみをカンマ区切りで出力し、前置き、挨拶、解説、リスト番号などは絶対に含めないでください。

=== 例 ===
User: 脱炭素
Assistant: 再生可能エネルギー, 水素アンモニア, EV充電器, 排出権取引, CCS

User: 半導体製造装置
Assistant: 露光装置, エッチング装置, ダイサー, ウェハ洗浄, テスタ
=== 例はここまで ===

User: {query}
Assistant:
```

#### 7.4.5 IRニュース分析プロンプト (`src/scripts/analyze_ir_news.ts`)
```text
あなたは企業のIR資料（適時開示）から、ベクトル検索データベースのインデックス構築に最適なメタデータを抽出・生成する専門のAIアシスタントです。

以下の【PDF資料】は、ある企業が発表した「新規事業」等に関するPDF資料から抽出されたテキストです。
この情報をベクトル検索で高精度にヒットさせるために、テキストの内容を分析し、以下の【抽出カテゴリ】に従ってキーワードおよび短いフレーズを出力してください。

【抽出カテゴリ】
1. business_domain (事業領域・業界): 
   - 該当する業界、市場、セクター（例：フィンテック、医療AI、M&A仲介など）
2. core_technology_model (コア技術・ビジネスモデル): 
   - 使用されている技術や提供形態（例：SaaS、LLM、ブロックチェーン、サブスクリプション、PoCなど）
3. target_and_problem (ターゲット・解決する課題): 
   - 誰向けのサービスか、何を解決するか（例：製造業の人手不足解消、バックオフィスのDX推進など）
4. search_synonyms (検索用類義語・関連語): 
   - 入力テキストに直接記載されていなくても、検索者が入力しそうな類義語、関連する抽象概念、トレンドワードをLLMの知識を用いて3〜5つ補完してください。

【制約事項】
・単なる単語だけでなく、ベクトル空間で意味を捉えやすい「短いフレーズ（名詞句）」も含めること。
・出力は必ず以下のJSONスキーマに従い、JSONコードブロックのみを出力すること。余計な解説は不要です。

【出力JSONフォーマット】
{
  "business_domain": ["...", "..."],
  "core_technology_model": ["...", "..."],
  "target_and_problem": ["...", "..."],
  "search_synonyms": ["...", "..."]
}
```


#### 7.4.6 LLM出力揺れの補正とTS側の安全装置 (Output Sanitization)
LLM（とくにローカルのgemma3:12b等）は指定フォーマットを逸脱する出力揺れを起こすため、パイプラインの随所にTypeScript側での強固な補正ロジックを挟んでいます。

- **無限ループ（タイムアウト）の完全防止（JSONフォーマット強制）**:
  - `gemma4:12b` などが要約生成後に不要な思考プロセスを書き連ねて無限ループに陥るのを防ぐため、要約抽出プロンプト（Unified / Step 2）では出力を単一のJSONオブジェクト `{ "summary": "..." }` に強制し、Ollama APIレベルで `format: "json"` を指定して物理的に生成をストップさせる安全装置を設けています。
  - ハルシネーション（存在しない事業の捏造）を防ぐため、要約プロンプト内に明示的な「思考のステップ」を組み込んでいます。
- **決算金額の単位パース (`formatJapaneseCurrency`)**:
  - LLMに「金額の単位変換」をさせると計算ミス（ハルシネーション）が高確率で発生するため、LLMには一切計算させず「123,456百万円」とそのまま抽出させます。
  - その後、TS側の正規表現とBigInt計算によって安全に「1234億5600万円」等へ変換し、Step 2（清書）のLLMへ渡します（`analyze_stock_rag.ts`）。
- **JSONパース失敗時のフォールバック**:
  - `analyze_stock_rag.ts` では、LLMがJSON文字列として出力しなかった場合、`try/catch` で生テキストとしてそのまま次段へ渡すフォールバックを持っています。
  - `run_gics_classification.ts` の Stage 1 でJSON配列の出力に失敗した場合は、エラーで停止せず、RRFスコアの「Top 3」を強制的に採用して Stage 2 に進みます。
  - `gics.ts` の Stage 3 (監査) において、LLMからの通信タイムアウトやエラーが発生した場合は、安全側に倒して `auditStatus = 'ERROR'`（監査エラー）として理由とともに記録し、異常値として後から検知・再処理できるようにしています。
- **余分な装飾・不要文字の除去**:
  - `expand-query` API では、LLMが「です・ます」や不要な句点（。）、改行を追加した場合を想定し、文字列処理で確実に不要文字を除去してクエリ化します。



## 8. エラーハンドリングと運用設計 (Error Handling & Operations)

本システムは完全ローカル環境での稼働を前提としているため、バッチ処理の中断に対する復帰（冪等性）や、ローカルリソース（特にGPU）の枯渇に対するフェイルセーフを考慮した設計となっています。

### 8.1 バッチ処理の冪等性 (Idempotency)
長時間のバッチ処理が中断されても、再実行時に二重処理を防止する仕組みを実装しています。

- **J-Quantsデータ同期 (`sync_history`)**:
  - ダウンロード・処理が完了したCSVのS3 Keyを `sync_history` テーブルに記録します。
  - 再実行時は未記録のファイルのみを差分取得（Incremental Sync）します。
  - DBへの書き込みは `INSERT OR REPLACE` や `INSERT OR IGNORE` を多用し、株式分割（`stock_splits`）の遡及計算も `ON CONFLICT DO NOTHING` と事前存在チェックを組み合わせて冪等性を担保しています。
- **決算PDF解析 (`data/pdf_batch_history.json`)**:
  - `Docling` による重いPDFパース処理を回避するため、解析が完了したファイル履歴をJSON形式で記録し、未処理のPDFのみを対象とします。
- **IRニュース自動取得・ベクトル化の冪等性**:
  - `ir_news` テーブルの取得・登録時、同一日付・同一ティッカー・同一タイトルのニュースは重複チェックによりスキップします。
  - Qdrantへの登録時は決定論的UUID（`MD5(ticker + "_" + published_at + "_" + title)`）を使用するため、何度再実行しても同一ポイントが上書き（Upsert）され、ベクトル空間が重複データで汚染されることはありません。

### 8.2 一時ファイルとロギング (`/scratch` ディレクトリ)
検証用の出力やバッチのエラーログ、中間データのダンプは、ソースコード（`src/`）や永続データ（`data/`）を汚染しないよう、すべて `scratch/` ディレクトリに吐き出す運用としています。
- **抽出生データ**: `scratch/step1_debug.json`（LLMのJSONフォーマット破綻調査用）
- **バッチログ**: `scratch/phase2_output.log`, `scratch/shikiho_output.log`
- **差分出力**: `scratch/phase2_changes.csv`（旧判定から新判定への移行確認用）
- **一時検証スクリプト**: `scratch/check_*.ts`, `scratch/test_*.ts` 等の使い捨てコード

### 8.3 ローカルLLMのリソース競合・制約事項 (Resource Constraints)
本システムの中核である `gemma3:12b` などのローカルLLM（Ollama経由）およびエンベディング（`bge-m3`）は、VRAMおよびシステムメモリを大きく占有します。

- **GPUメモリ競合の回避**:
  - LLM推論中または重いバッチ処理中（特に `run_gics_classification.ts` 等の並列処理中）に、**高負荷な3Dゲーム等を同時にプレイすると、GPUリソース（VRAM等）の競合によりOllamaの推論プロセスがクラッシュ（OOM等）したり、著しいパフォーマンス低下・タイムアウトを引き起こす危険性（「ゲームするとまずい」制約）**があります。
  - バッチ実行中は重い他のローカルアプリケーションの起動を避けるか、バッチをバックグラウンドで切り離して安全なタイミングで実行する運用が推奨されます。

### 8.4 Qdrant と SQLite のバックアップ方針
- **SQLite (`local.db`)**:
  - 単一ファイルであるため、OSレベルのファイルコピーで容易に完全バックアップが可能です。
- **Qdrant**:
  - 内部で `financial_reports`, `company_profiles`, `gics_categories` の3コレクションを管理しています。再構築が必要な場合は `equities_master` の `summary` と `theme_keywords`、および `ir_news` を元に再度エンベディングAPI（Ollama `bge-m3`）を実行することで完全復元が可能です。


## 9. システム定数・設定値 (System Configuration)

パイプライン、スクリーニング、およびハイブリッド検索精度に影響を与える主要なハードコード定数および環境変数の一覧です。

### 9.1 AI / 機械学習モデル・検索設定
| 設定項目 | 値 | 説明 |
| :--- | :--- | :--- |
| **LLM モデル** | `gemma3:12b` | Ollamaローカル実行。構造化抽出およびGICS分類判定に使用。 |
| **Embedding モデル** | `bge-m3` | 次元数: 1024, Distance: Cosine。Dense検索用ベクトル。 |
| **Reranker モデル** | `hotchpotch/japanese-bge-reranker-v2-m3-v1` | Python FastAPI (ポート 8000) で稼働するCross-Encoder。 |
| **Ollama URL** | `http://localhost:11434/api/generate` | ローカルLLM推論エンドポイント。 |
| **Qdrant URL** | `http://localhost:6333` | ローカルベクトル検索エンジンエンドポイント。 |
| **Reranker URL** | `http://127.0.0.1:8000/rerank` | リランカー推論エンドポイント。 |
| **RRF K値 (`RRF_K`)** | `60` | Hybrid Search 時の Dense/Sparse スコア統合の平滑化定数。 |
| **Reranker 入力候補数** | 上位 `100` 件 | RRF結合スコア上位100件をリランカーサーバーへ送信。 |
| **Reranker 出力足切り数** | 上位 `50` 件 | リランカーRaw Logitスコア降順で最終足切り。 |
| **PDFチャンクサイズ** | `2,500` 文字 | `headerAwareChunker` による見出し維持チャンク分割の最大長。 |
| **GICS分類 Sparse検索件数** | 上位 `158` 件 | GICS全サブインダストリ数と同数を事前検索。 |
| **GICS分類 RRF Top抽出数** | 上位 `10` 件 | Stage 1 LLMプロンプトに入力し、上位3候補へ絞り込み。 |

### 9.2 データベース・データ同期設定
| 設定項目 | 値 | 説明 |
| :--- | :--- | :--- |
| **SQLite DBパス** | `file:local.db` | ローカルSQLiteデータベースファイル。 |
| **SQLite バッチ挿入サイズ** | `5,000` 件 | J-Quantsデータのバルクインサート時のトランザクションコミット単位。 |

### 9.3 ミネルヴィニ SEPA / VCP スクリーニング定数
| 設定項目 | 値 | 説明 |
| :--- | :--- | :--- |
| **RSレーティング足切り閾値** | `70` | 市場全体の上位30%以上のモメンタム銘柄を適格判定。 |
| **上場廃止除外猶予期間** | `10` 日 | 市場最新営業日より10日以上日足が更新されていない銘柄を除外。 |
| **SMA200 傾き回帰期間** | `22` 営業日 | 最小二乗法によるSMA200の傾き（約1ヶ月分）を算出。 |
| **ベース高値探索期間** | 直近 `2 〜 65` 営業日 | 当日および前日を除く約3ヶ月間の終値最高値をベース高値とする。 |
| **ピボット価格探索期間** | 直近 `2 〜 15` 営業日 | 直近約3週間の局所高値をハンドル・ピボット価格とする。 |
| **ハンドル健全性比率** | `>= 0.85` | ピボット価格がベース高値の85%以上（ベース上半部15%以内）に位置すること。 |
| **ピボット接近判定レンジ** | `-5.0% 〜 0.0%` | 健全ハンドルかつ現在終値がピボット価格から-5%以内のセットアップ圏内。 |
| **ATR収縮比率 (`ATR10 / ATR50`)** | `< 0.70` | 短期10日ATRが長期50日ATRの70%未満（30%以上の値幅収縮）で収縮判定。 |
| **出来高枯渇比率 (`Vol5 / Vol50`)** | `< 0.60` | 5日平均出来高が50日平均の60%以下（40%以上の枯渇）でVDU判定。 |
| **ピボットブレイクアウト判定** | `0.0% 〜 +3.0%` かつ 当日出来高 >= 50日平均 × 1.5 | 健全ハンドルからピボットを出来高急増を伴って上放れた状態を即時検知。 |
| **Tier 1 四半期売上高成長閾値** | `>= +10.0%` | 四半期単体売上高の前年同期比成長率（必須ハードフィルター）。 |
| **Tier 1 四半期EPS急成長閾値** | `>= +20.0%` または `TURNAROUND` | 四半期単体EPSの前年同期比成長率（黒字転換も適格、必須ハードフィルター）。 |
| **Tier 2 成長加速判定足切り** | 売上 `>= +10.0%` または EPS `>= +15.0%` | 赤字縮小や超低成長の加速偽シグナルを排除する必須足切り水準。 |
| **Tier 2 年間EPS持続期間** | 過去 `3` 期連続プラス成長 | 株式分割調整後EPS（`adj_eps`）で3年連続増益（IPOバイパス: 2期/1期）。 |
| **Tier 2 ROE適格水準** | `>= 15.0%` | 自己資本利益率15%以上（債務超過 `equity <= 0` はNULL除外）。 |
| **時価総額スイートスポット** | `100億 〜 1,000億円` | ミネルヴィニが推奨する大化け株の最適時価総額レンジ（独立オーバーレイ）。 |
| **最低流動性（5日平均売買代金）** | `>= 1.0億円` | 機関投資家の参入可能な最低出来高代金基準（独立オーバーレイ）。 |

### 9.4 GICSセクター資金流入確認ツール仕様・定数
| 設定項目 | 値 | 説明 |
| :--- | :--- | :--- |
| **集計単位** | GICS Industry (6桁 / 約74業種) <br> GICS Industry Group (4桁 / 約25業種グループ) | 画面上のタブ切り替えにより即座に階層を切り替え可能。それぞれの母集団内で再パーセンタイル均等分布化。 |
| **対象母集団** | GICS分類済み全銘柄（約3,650社） | `equities_master` の `gics_sub_industry_id IS NOT NULL`（監査ステータス `OK` および `ERROR` を含む全分類済み上場株。ETF/ETN/REIT/投資法人は除外）。 |
| **母集団ハードリミット** | `N >= 5` | 構成銘柄数5社未満の極小業種は集計母集団から完全除外。 |
| **集計窓期間** | `5`, `20`, `60` 営業日 | 5日（初動）、20日（標準）、60日（定着）。 |
| **Layer 1: 資金フロー配点** | `40%` | 売買代金シェア変化(35%), 規格化MFV(35%), A/D比(20%), CLV中央値(10%)。 |
| **Layer 2: 内部構造配点** | `35%` | 騰落ブレッドス(25%), Spread(25%), 大商い率(20%), 新高値率(20%), トレンド同期(10%)。 |
| **Layer 3: モメンタム配点** | `25%` | 超過RS(60%), Stage 2ブレイク率(40%)。 |
| **売買代金シェア変化率ブレンド** | `50:50` | 相対変化率ランク(50%) と 絶対変化幅ランク(50%) を等分合成。 |
| **規格化 MFV 範囲** | `[-1.0, +1.0]` | チャイキンCLV正規化式 $(2C - (H+L))/(H-L)$ を用いて売買代金で規格化。 |
| **グループ A/D レシオ** | 全銘柄取引日合算 | $\sum \text{出来高増陽線} \div (\sum \text{出来高増陰線} + 1)$。 |
| **下落相場 Spread クランプ** | `等ウェイト騰落 <= 0` | 業種下落時は大型株急落の偽陽性を防ぐためランクを中立(0.50)にクランプ。 |
| **スコア再パーセンタイル化** | `0 〜 100 点` | 合成RawScoreを全業種（または全業種グループ）間で再パーセンタイル化し均等分布。 |
| **🔥 強烈な資金流入** | スコア `>= 80` かつ 業種騰落 `> 0` かつ 超過RS `> 0` | セクター上昇とTOPIXアウトパフォームの完全合致。 |
| **📈 上昇（市場劣後）** | スコア `>= 80` かつ 業種騰落 `> 0` かつ 超過RS `<= 0` | 業種自体は上昇しているが相場全体の勢いに劣後。 |
| **⚖ 相対優位（地合い不良）** | スコア `>= 80` だが 業種騰落 `<= 0` | 全面安局面の相対的な下げ渋り・ディフェンシブ。 |
| **ドリルダウン排他バッジ** | 1:🔥反発トリガー, 2:🚀直近ブレイク, 3:★25MA押し目, 4:★50MA押し目 | 個別銘柄のSEPA状態を優先順位に基づき単一バッジ化。 |
| **押し目乖離率レンジ** | `-1.5% 〜 +3.5`% | 25MA/50MA支持帯テストのSEPA正規仕様に完全統一。 |

### 9.5 個別企業分析 GICS細分類手動選択・自動逆算・DB即時反映仕様
| 設定項目 | 仕様・実装内容 | 説明 |
| :--- | :--- | :--- |
| **対象画面** | `/stocks/[ticker]` (個別分析ダッシュボード) | 「分類情報」カード（`GicsClassificationCard.tsx`）からモーダルを呼び出し。 |
| **選択可能母集団** | 全149件のGICS細分類 (`GICS_DICTIONARY`) | 細分類コード(8桁)、細分類名、小分類、中分類、セクター名でリアルタイムインクリメンタル検索。 |
| **自動逆算マッピング** | 細分類選択 $\rightarrow$ 小/中/大分類の完全逆算 | `GICS_DICTIONARY[sub_id]` より `industry_id` (小分類), `industry_group_id` (中分類), `sector_id` (大分類/主幹テーマ) を100%自動決定。 |
| **更新API** | `POST /api/stocks/[ticker]/gics` | Body: `{ subIndustryId: string }`。4桁/5桁双方のticker不整合を完全吸収。 |
| **DB反映先 1** | `equities_master` | `gics_sub_industry_id`, `theme` (= sector_name), `gics_audit_status = 'OK'`, `gics_audit_reason = 'ユーザー手動選択'`。 |
| **DB反映先 2** | `stocks` | `gics_sub_industry_id`。 |
| **DB反映先 3** | `sepa_metrics` | `gics_sub_industry_id`。セクター資金流入レーダーやSEPAスクリーナーへ即座に反映。 |
| **ユーザーフィードバック** | Optimistic UI ＋ DB保存完了バッジ | クリック直後にUI更新。API成功時にグリーンバッジ（`DB保存完了`）をトースト表示。 |


## 10. 今後の課題・ロードマップ (Roadmap)


現在のシステム構成における課題と、将来に向けた拡張構想です。

1. **バッチ処理の高速化と並列化**
   - 現在のGICS業種判定やアナリストレポート生成は、ローカルLLMの逐次処理（forループ）となっており、全銘柄を回すと膨大な時間がかかります。キューイングシステム（Redis/BullMQ等）の導入による並列処理化（※GPUのVRAM上限に依存）。
2. **自動アノテーション・教師データの蓄積**
   - LLMが誤判定したGICSやテーマについて、ユーザーが手動でUIから訂正した履歴を別テーブルに保存し、今後のFew-Shotプロンプトの事例としてフィードバックさせる自己改善ループの構築。
3. **異常値検知 (Anomaly Detection) の強化**
   - 新しく実装された「ベクトル外れ値検知（Peer Consistency）」に加え、財務諸表の不自然な変化（例: 売掛金の急増）などを自動検知するロジックの追加。
4. **LLMプロンプトの外部管理**
   - ソースコード内にハードコードされている各種プロンプト（`theme_prompts.ts` 等）をDB化し、フロントエンドUIからABテストや微調整を行えるようにする。
