/**
 * GICSセクター資金流入確認ツール 型定義・定数・MECEバッジロジック
 */

export const MIN_STOCKS_HARD_LIMIT = 5; // バックエンド集計ハードリミット (N >= 5)

export type InflowPeriod = 5 | 20 | 60;
export type CategoryLevel = 'industry' | 'industry_group'; // 6桁業種 または 4桁業種グループ

export type SectorStatusVariant =
  | 'super'       // 🔥 強烈な資金流入
  | 'lagging'     // 📈 上昇（市場劣後）
  | 'defensive'   // ⚖ 相対優位（地合い不良）
  | 'early'       // 📈 資金流入の初期兆候
  | 'neutral'     // ⚖ 中立
  | 'outflow';    // 📉 資金流出傾向


export interface SectorStatusBadgeInfo {
  label: string;
  variant: SectorStatusVariant;
  description: string;
}

export type StockPullbackType = 'NONE' | 'PULLBACK_21EMA' | 'PULLBACK_50MA' | 'BREAKOUT';

export interface StockPullbackBadgeInfo {
  priority: number;
  label: string;
  badgeType: 'trigger' | 'breakout' | 'pullback_21' | 'pullback_50' | 'none';
  description: string;
}

export interface SectorStockDetail {
  code: string;
  name: string;
  marketCap: number;
  close: number;
  returnRate: number;        // 期間騰落率 (%)
  dailyChangeRate: number;   // 当日騰落率 (%)
  volumeSurgeRatio: number;  // 当日出来高 / 50日平均出来高
  clv: number;               // 当日CLV (0.0〜1.0)
  rsRank: number;            // 直近RSランク (0〜99)
  pullbackStatus: {
    type: StockPullbackType;
    isBounceTriggered: boolean;
    clv: number;
    badge: StockPullbackBadgeInfo;
  };
}

export interface SectorInflowSummary {
  industryId: string;
  industryName: string;
  sectorId: string;
  sectorName: string;
  stockCount: number;
  finalScore: number;         // 最終パーセンタイルスコア (0〜100)
  rawScore: number;           // 合成生スコア (0.0〜1.0)
  status: SectorStatusBadgeInfo;

  // Layer 1: 資金フロー指標 (ウェイト: 40%)
  turnoverShareNow: number;     // 当期シェア (%)
  turnoverSharePast: number;    // 過去平均シェア (%)
  turnoverShareDeltaPct: number;// 相対変化率 (%)
  turnoverShareDeltaPt: number; // 絶対変化幅 (pt)
  netMfv: number;               // 規格化 MFV (-1.0〜+1.0)
  groupAdRatio: number;         // グループ A/D レシオ
  medianClv: number;            // グループ CLV 中央値 (0.0〜1.0)

  // Layer 2: 内部構造指標 (ウェイト: 35%)
  advanceRatio: number;         // セクター騰落ブレッドス (上昇銘柄比率: %)
  equalWeightReturn: number;    // 等ウェイト騰落率 (%)
  capWeightReturn: number;      // 時価総額加重騰落率 (%)
  spreadEqVsCap: number;        // 等ウェイト vs 加重 Spread (pt)
  volumeSurgeRatio: number;     // 出来高急増陽線比率 (%)
  newHighRatio: number;         // 直近60日新高値銘柄比率 (%)
  trendBreadth: number;         // トレンド同期率 (% > 25MA & 50MA)

  // Layer 3: モメンタム指標 (ウェイト: 25%)
  rsDelta: number;              // 業種平均RS期間変化幅
  breakoutRatio: number;        // Stage 2 ブレイク集中度 (直近5日ブレイク比率: %)

  // 構成銘柄ドリルダウン
  stocks: SectorStockDetail[];
}

export interface SectorInflowApiResponse {
  asOfDate: string;
  period: InflowPeriod;
  categoryLevel: CategoryLevel;
  totalMarketTurnover: number;
  totalSectorsCount: number;
  sectors: SectorInflowSummary[];
}


/**
 * 完全MECEなバッジ判定ロジック
 */
export function getSectorStatusBadge(
  finalScore: number,
  equalWeightReturn: number,
  rsDelta: number
): SectorStatusBadgeInfo {
  // 1. スコア上位帯 (80点以上)
  if (finalScore >= 80) {
    if (equalWeightReturn > 0 && rsDelta > 0) {
      return {
        label: '資金集中（市場超過・上昇）',
        variant: 'super',
        description: 'セクター上昇 ＆ TOPIXアウトパフォームの完全合致',
      };
    }
    if (equalWeightReturn > 0 && rsDelta <= 0) {
      return {
        label: 'セクター上昇（指数劣後）',
        variant: 'lagging',
        description: '業種自体は上昇しているが、市場全体の急騰にモメンタムが劣後',
      };
    }
    // equalWeightReturn <= 0
    return {
      label: '相対優位（下落耐性 / 防衛的）',
      variant: 'defensive',
      description: 'セクター自体は下落しているが、相対的な下げ渋り・ディフェンシブ優位',
    };
  }

  // 2. スコア初期流入帯 (65点〜79点)
  if (finalScore >= 65) {
    if (equalWeightReturn > 0 && rsDelta > 0) {
      return {
        label: '資金流入（初動シグナル）',
        variant: 'early',
        description: '商い・先行銘柄・相対モメンタムに資金集約の初期サイン',
      };
    }
    return {
      label: '中立（流入兆候あり）',
      variant: 'neutral',
      description: '指標の一部に流入兆候があるが、市場対比または方向性が未定着',
    };
  }

  // 3. 中立帯 (45点〜64点)
  if (finalScore >= 45) {
    return {
      label: '中立（市場平均並み）',
      variant: 'neutral',
      description: '市場平均並みの通常の推移',
    };
  }

  // 4. 流出帯 (44点以下)
  return {
    label: '資金流出傾向（商い縮小）',
    variant: 'outflow',
    description: '商い縮小・ディストリビューション傾向',
  };
}

/**
 * 個別銘柄バッジ排他制御ルール
 */
export function resolveStockBadge(params: {
  pullbackType: StockPullbackType;
  isBounceTriggered: boolean;
  isRecentBreakout: boolean;
}): StockPullbackBadgeInfo {
  const { pullbackType, isBounceTriggered, isRecentBreakout } = params;

  // [優先度 1] 反発確認（前日高値上抜け）
  if ((pullbackType === 'PULLBACK_21EMA' || pullbackType === 'PULLBACK_50MA') && isBounceTriggered) {
    return {
      priority: 1,
      label: '反発確認（前日高値上抜け）',
      badgeType: 'trigger',
      description: '支持帯からの反発を確認（前日高値突破）',
    };
  }

  // [優先度 2] ブレイクアウト（直近5日以内）
  if (isRecentBreakout) {
    return {
      priority: 2,
      label: 'ブレイクアウト（5日以内）',
      badgeType: 'breakout',
      description: '直近5営業日以内にベース新高値ブレイクアウト発生',
    };
  }

  // [優先度 3] 21EMA支持帯（調整中）
  if (pullbackType === 'PULLBACK_21EMA') {
    return {
      priority: 3,
      label: '21EMA支持帯（調整中）',
      badgeType: 'pullback_21',
      description: '21EMA支持帯テスト中（出来高枯渇・反発監視）',
    };
  }

  // [優先度 4] 50日線支持帯（調整中）
  if (pullbackType === 'PULLBACK_50MA') {
    return {
      priority: 4,
      label: '50日線支持帯（調整中）',
      badgeType: 'pullback_50',
      description: '50MA支持帯テスト中（出来高枯渇・反発監視）',
    };
  }

  // [優先度 5] ― (通常)
  return {
    priority: 5,
    label: '―',
    badgeType: 'none',
    description: '通常状態',
  };
}
