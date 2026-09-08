/**
 * ミネルヴィニ SEPA（Specific Entry Point Analysis）型定義 (SSOT)
 */

// 四半期成長率・損益ステータス
export type QuarterlyGrowthStatus =
  | 'GROWTH'           // 前年同期比プラス成長 (正常)
  | 'EXPLOSIVE_GROWTH' // EPS +300%以上 かつ 売上+10%以上の正真正銘の大成長
  | 'TURNAROUND'        // 黒字転換 (前年赤字 -> 当期黒字)
  | 'LOSS_REDUCTION'   // 赤字縮小 (前年赤字 -> 当期赤字だが改善)
  | 'LOSS_EXPANSION'   // 赤字拡大 (前年赤字 -> 当期赤字で悪化)
  | 'DEFICIT_FALL'     // 赤字転落 (前年黒字 -> 当期赤字)
  | 'IRREGULAR_PERIOD' // 変則決算・会計期間不整合による除外
  | 'NO_DATA';         // データ不足

// トレンドテンプレート指標
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
  is_sma200_uptrend_1m: boolean; // 22日スロープ>0 かつ 22日前以上 かつ 10日前以上
  is_sma200_uptrend_5m: boolean; // 5ヶ月上向きボーナス
  low_52w: number | null;
  distance_from_low_52w_pct: number | null; // 安値から何%反発しているか (>= +25%)
  high_52w: number | null;
  distance_to_high_52w_pct: number | null;   // 高値から何%圏内か (<= 25%以内)
  is_ipo: boolean;                           // 上場250日未満
  is_trend_template_pass: boolean;           // 必須条件クリア (IPOバイパス対応)
  passed_conditions_count: number;           // 8条件中クリア数
  stage2_entry_date: string | null;          // 直近でStage 2に突入・再合格した日付
}

// 日本株独自RS（Relative Strength）指標
export interface SepaRsMetrics {
  rs_score_raw: number | null;
  rs_rating: number | null;     // 1〜99 パーセンタイル
  is_pseudo_rs: boolean;        // IPO等で63〜251日の短期間加重 (擬似RSフラグ)
}

// 四半期単体ファンダメンタルズ指標
export interface SepaFundamentalsMetrics {
  sales_yoy_pct: number | null;
  op_yoy_pct: number | null;
  ordinary_profit_yoy_pct: number | null;
  eps_yoy_pct: number | null;
  growth_status: QuarterlyGrowthStatus;
  is_growth_accelerating: boolean; // 当四半期成長率 > 前四半期成長率 (売上 or EPS)
  is_margin_expanding: boolean;    // 単体営業利益率 > 前年同期
  has_3y_annual_growth: boolean;   // 過去3期連続で通期EPSがプラス成長
  has_accounting_noise_risk: boolean; // 売上が伸びていないのに利益だけ急増 (⚠️警告)
  standalone_sales: number | null;
  standalone_op: number | null;
  standalone_profit: number | null;
  standalone_eps: number | null;
  roe: number | null;
  market_cap: number | null;
  avg_trading_value_5d: number | null;
  funda_score?: number; // Tier 2 発展ファンダ該当数スコア (0〜4)
}

// VCP・ピボット客観候補指標
export interface SepaVcpMetrics {
  base_high: number | null;           // ベース高値 (直近2〜65営業日の終値ベース最高値)
  base_depth_pct: number | null;      // ベースの深さ ((現在値 - base_high) / base_high * 100)
  pivot_price: number | null;         // 真のピボット価格 (直近2〜15営業日の終値ベース局所高値)
  pivot_distance_pct: number | null;  // ピボットからの乖離率 (-5% 〜 0% がセットアップ)
  is_near_pivot: boolean;             // ピボットから -5% 〜 0% 圏内 (かつ健全ハンドル)
  is_pivot_breakout: boolean;         // 0% 〜 +3% かつ 出来高1.5倍以上 (かつ健全ハンドル)
  is_handle_healthy: boolean;         // ハンドルがベース上半部にあるか (pivot >= base_high * 0.85)
  atr_10: number | null;
  atr_50: number | null;
  atr_contraction_ratio: number | null; // ATR10 / ATR50 (< 0.70)
  is_volatility_contracted: boolean;
  volume_5d_avg: number | null;
  volume_50d_avg: number | null;
  volume_dryup_ratio: number | null;    // 5日平均出来高 / 50日平均出来高 (< 0.60)
  is_volume_dryup: boolean;
}

// SEPA 総合銘柄レコード (キャッシュテーブル & API返却用)
export interface SepaStockRecord extends SepaTrendMetrics, SepaRsMetrics, SepaFundamentalsMetrics, SepaVcpMetrics {
  ticker: string;
  name: string;
  market: string;
  industry: string;
  is_operating_company: boolean; // 1: 事業会社 (株式), 0: 投信・ETF・REIT等
  latest_date: string;
  ir_catalyst_count?: number; // 新規事業IRニュース数
  latest_ir_title?: string;
  latest_ir_date?: string;
}
