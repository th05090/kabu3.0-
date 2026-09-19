export interface DocItem {
  id: string;
  filename: string;
  title: string;
  category: 'playbook' | 'trading' | 'themes' | 'analysis';
  categoryLabel: string;
  badge?: string;
  description: string;
}

export const DOCS_REGISTRY: DocItem[] = [
  {
    id: 'playbook',
    filename: 'master_trading_playbook.md',
    title: '総合実戦トレード・プレイブック',
    category: 'playbook',
    categoryLabel: 'マスター手順書',
    badge: '必須・推奨',
    description: 'セクター資金流入からSEPA押し目、反発確認、資金管理・損切りまでの体系的思考フレームワーク。',
  },
  {
    id: 'market-regime',
    filename: 'market_regime_user_guide.md',
    title: '市場地合い判定（Market Regime）ガイド',
    category: 'trading',
    categoryLabel: '環境認識',
    badge: '地合い常駐',
    description: 'ヘッダー常駐の相場環境インジケーター。指数・ブレッドス・Stage 2比率・ディストリビューション日の客観判定。',
  },
  {
    id: 'sector-inflow',
    filename: 'sector_inflow_user_guide.md',
    title: 'GICSセクター資金流入確認ツール ガイド',
    category: 'trading',
    categoryLabel: '資金フロー分析',
    badge: '先行初動',
    description: '先行初動レーダー4大兆候、トレンド確認3層11指標、3段階相場進行ステータスとバックテスト実証値。',
  },
  {
    id: 'sepa',
    filename: 'sepa_user_guide.md',
    title: 'SEPAスクリーナー 利用マニュアル',
    category: 'trading',
    categoryLabel: 'テクニカル分析',
    badge: 'Stage 2',
    description: 'ミネルヴィニ流トレンドテンプレート、Stage 2+Tier 1財務条件、21EMA/50MA押し目、ピボットロック機構。',
  },
  {
    id: 'themes',
    filename: 'theme_extraction_user_guide.md',
    title: 'テーマ分析・動的検索 ガイド',
    category: 'themes',
    categoryLabel: 'テーマディスカバリー',
    description: '四季報・決算書ハイブリッド要約パイプライン、GICS分類、自然言語による動的テーマ検索（RRF）。',
  },
  {
    id: 'custom-themes',
    filename: 'custom_themes_user_guide.md',
    title: 'マイテーマ管理 ガイド',
    category: 'themes',
    categoryLabel: 'テーマディスカバリー',
    description: '有望銘柄群のマイテーマ保存、手動銘柄追加・除外、一括バルク管理。',
  },
  {
    id: 'ai-analysis',
    filename: 'ai_analysis_user_guide.md',
    title: 'AI決算分析 (RAG) ガイド',
    category: 'analysis',
    categoryLabel: '決算・AI解析',
    description: 'Docling Markdown化、見出しチャンキング、Qdrantハイブリッド検索、Gemma3:12Bアナリストレポート。',
  },
  {
    id: 'stock-analysis',
    filename: 'analysis_user_guide.md',
    title: '個別銘柄分析ダッシュボード ガイド',
    category: 'analysis',
    categoryLabel: '個別企業分析',
    description: 'Bento-box画面レイアウト、テクニカル/モメンタム指標、2ATR損切りライン、GICS分類手動変更。',
  },
];
