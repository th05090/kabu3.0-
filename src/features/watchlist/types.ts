export type WatchlistSource = 'screener' | 'sepa' | 'sector' | 'manual';

export interface WatchlistItem {
  id: string;
  ticker: string;
  source: WatchlistSource;
  added_price: number;
  added_date: string;
  notes: string | null;
  target_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistStockDetail extends WatchlistItem {
  name: string;
  market: string;
  industry: string;
  gics_sub_industry_id?: string;
  current_price: number;
  daily_change_pct: number;
  volume_ratio?: number;
  since_added_pct: number;
  // SEPA関連指標
  is_trend_template_pass: boolean;
  is_pivot_breakout: boolean;
  growth_status?: string;
  sales_yoy_pct?: number;
  eps_yoy_pct?: number;
  rs_rating?: number;
  sma_21?: number;
  sma_50?: number;
  sma_200?: number;
  dist_from_sma_21_pct?: number;
  dist_from_sma_50_pct?: number;
}
