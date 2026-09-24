/**
 * GICS分類 逆引き辞書データ
 * Qdrantのベクトル検索で得られた細分類(sub_industry)のIDをキーとして、
 * 大分類・中分類等のIDと名称を取得するための辞書です。
 */

export interface GICSClassification {
  sub_industry_name: string;
  industry_id: string;
  industry_name: string;
  industry_group_id: string;
  industry_group_name: string;
  sector_id: string;
  sector_name: string;
}

export const GICS_DICTIONARY: Record<string, GICSClassification> = {
"10101010": {
    "sub_industry_name": "石油・ガス掘削",
    "industry_id": "101010",
    "industry_name": "エネルギー設備・サービス",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10101020": {
    "sub_industry_name": "石油・ガス装置・サービス",
    "industry_id": "101010",
    "industry_name": "エネルギー設備・サービス",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10102010": {
    "sub_industry_name": "総合石油・ガス",
    "industry_id": "101020",
    "industry_name": "石油・ガス・消耗燃料",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10102020": {
    "sub_industry_name": "石油・ガス探査・開発",
    "industry_id": "101020",
    "industry_name": "石油・ガス・消耗燃料",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10102030": {
    "sub_industry_name": "石油・ガス精製・販売",
    "industry_id": "101020",
    "industry_name": "石油・ガス・消耗燃料",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10102040": {
    "sub_industry_name": "石油・ガス貯蔵・輸送",
    "industry_id": "101020",
    "industry_name": "石油・ガス・消耗燃料",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"10102050": {
    "sub_industry_name": "石炭・消耗燃料",
    "industry_id": "101020",
    "industry_name": "石油・ガス・消耗燃料",
    "industry_group_id": "1010",
    "industry_group_name": "エネルギー",
    "sector_id": "10",
    "sector_name": "エネルギー"
  },

"15101010": {
    "sub_industry_name": "基礎化学品",
    "industry_id": "151010",
    "industry_name": "化学",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15101020": {
    "sub_industry_name": "総合化学",
    "industry_id": "151010",
    "industry_name": "化学",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15101030": {
    "sub_industry_name": "肥料・農薬",
    "industry_id": "151010",
    "industry_name": "化学",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15101040": {
    "sub_industry_name": "工業用ガス",
    "industry_id": "151010",
    "industry_name": "化学",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15101050": {
    "sub_industry_name": "特殊化学品",
    "industry_id": "151010",
    "industry_name": "化学",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15102010": {
    "sub_industry_name": "建設資材",
    "industry_id": "151020",
    "industry_name": "建設資材",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15103010": {
    "sub_industry_name": "金属・ガラス・プラスチック容器",
    "industry_id": "151030",
    "industry_name": "容器・包装",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15103020": {
    "sub_industry_name": "紙・プラスチック包装製品・材料",
    "industry_id": "151030",
    "industry_name": "容器・包装",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104010": {
    "sub_industry_name": "アルミ",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104020": {
    "sub_industry_name": "各種金属・鉱業",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104025": {
    "sub_industry_name": "銅",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104030": {
    "sub_industry_name": "金",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104040": {
    "sub_industry_name": "貴金属・鉱物",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104045": {
    "sub_industry_name": "銀",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15104050": {
    "sub_industry_name": "鉄鋼",
    "industry_id": "151040",
    "industry_name": "金属・鉱業",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15105010": {
    "sub_industry_name": "林産品",
    "industry_id": "151050",
    "industry_name": "紙製品・林産品",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"15105020": {
    "sub_industry_name": "紙製品",
    "industry_id": "151050",
    "industry_name": "紙製品・林産品",
    "industry_group_id": "1510",
    "industry_group_name": "素材",
    "sector_id": "15",
    "sector_name": "素材"
  },

"20101010": {
    "sub_industry_name": "航空宇宙・防衛",
    "industry_id": "201010",
    "industry_name": "航空宇宙・防衛",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20102010": {
    "sub_industry_name": "建設関連製品",
    "industry_id": "201020",
    "industry_name": "建設関連製品",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20103010": {
    "sub_industry_name": "建設・土木",
    "industry_id": "201030",
    "industry_name": "建設・土木",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20104010": {
    "sub_industry_name": "電気部品・設備",
    "industry_id": "201040",
    "industry_name": "電気設備",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20104020": {
    "sub_industry_name": "重電機設備",
    "industry_id": "201040",
    "industry_name": "電気設備",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20105010": {
    "sub_industry_name": "コングロマリット",
    "industry_id": "201050",
    "industry_name": "コングロマリット",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20106010": {
    "sub_industry_name": "建設機械・大型輸送設備",
    "industry_id": "201060",
    "industry_name": "機械",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20106015": {
    "sub_industry_name": "農業機械",
    "industry_id": "201060",
    "industry_name": "機械",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20106020": {
    "sub_industry_name": "産業機械・用品・部品",
    "industry_id": "201060",
    "industry_name": "機械",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20107010": {
    "sub_industry_name": "商社・流通業",
    "industry_id": "201070",
    "industry_name": "商社・流通業",
    "industry_group_id": "2010",
    "industry_group_name": "資本財",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20201010": {
    "sub_industry_name": "商業印刷",
    "industry_id": "202010",
    "industry_name": "商業サービス・用品",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20201050": {
    "sub_industry_name": "環境関連・ファシリティサービス",
    "industry_id": "202010",
    "industry_name": "商業サービス・用品",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20201060": {
    "sub_industry_name": "事務サービス・用品",
    "industry_id": "202010",
    "industry_name": "商業サービス・用品",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20201070": {
    "sub_industry_name": "各種支援サービス",
    "industry_id": "202010",
    "industry_name": "商業サービス・用品",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20201080": {
    "sub_industry_name": "セキュリティ・警報装置サービス",
    "industry_id": "202010",
    "industry_name": "商業サービス・用品",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20202010": {
    "sub_industry_name": "人事・雇用サービス",
    "industry_id": "202020",
    "industry_name": "専門サービス",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20202020": {
    "sub_industry_name": "調査・コンサルティングサービス",
    "industry_id": "202020",
    "industry_name": "専門サービス",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20202030": {
    "sub_industry_name": "情報処理・外注サービス",
    "industry_id": "202020",
    "industry_name": "専門サービス",
    "industry_group_id": "2020",
    "industry_group_name": "商業・専門サービス",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20301010": {
    "sub_industry_name": "航空貨物・物流サービス",
    "industry_id": "203010",
    "industry_name": "航空貨物・物流サービス",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20302010": {
    "sub_industry_name": "旅客航空輸送",
    "industry_id": "203020",
    "industry_name": "旅客航空輸送",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20303010": {
    "sub_industry_name": "海上運輸",
    "industry_id": "203030",
    "industry_name": "海上運輸",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20304010": {
    "sub_industry_name": "鉄道運輸",
    "industry_id": "203040",
    "industry_name": "陸上運輸",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20304030": {
    "sub_industry_name": "貨物陸上輸送",
    "industry_id": "203040",
    "industry_name": "陸上運輸",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20304040": {
    "sub_industry_name": "旅客陸上輸送",
    "industry_id": "203040",
    "industry_name": "陸上運輸",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20305010": {
    "sub_industry_name": "空港サービス",
    "industry_id": "203050",
    "industry_name": "運送インフラ",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20305020": {
    "sub_industry_name": "高速道路・鉄道路線",
    "industry_id": "203050",
    "industry_name": "運送インフラ",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"20305030": {
    "sub_industry_name": "港湾サービス",
    "industry_id": "203050",
    "industry_name": "運送インフラ",
    "industry_group_id": "2030",
    "industry_group_name": "運輸",
    "sector_id": "20",
    "sector_name": "資本財・サービス"
  },

"25101010": {
    "sub_industry_name": "自動車用部品・装置",
    "industry_id": "251010",
    "industry_name": "自動車用部品",
    "industry_group_id": "2510",
    "industry_group_name": "自動車・自動車部品",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25101020": {
    "sub_industry_name": "タイヤ・ゴム",
    "industry_id": "251010",
    "industry_name": "自動車用部品",
    "industry_group_id": "2510",
    "industry_group_name": "自動車・自動車部品",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25102010": {
    "sub_industry_name": "自動車製造",
    "industry_id": "251020",
    "industry_name": "自動車",
    "industry_group_id": "2510",
    "industry_group_name": "自動車・自動車部品",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25102020": {
    "sub_industry_name": "自動二輪車製造",
    "industry_id": "251020",
    "industry_name": "自動車",
    "industry_group_id": "2510",
    "industry_group_name": "自動車・自動車部品",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25201010": {
    "sub_industry_name": "民生用電子機器",
    "industry_id": "252010",
    "industry_name": "家庭用耐久財",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25201020": {
    "sub_industry_name": "家具・装飾",
    "industry_id": "252010",
    "industry_name": "家庭用耐久財",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25201030": {
    "sub_industry_name": "住宅建設",
    "industry_id": "252010",
    "industry_name": "家庭用耐久財",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25201040": {
    "sub_industry_name": "家庭用電気機器",
    "industry_id": "252010",
    "industry_name": "家庭用耐久財",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25201050": {
    "sub_industry_name": "家庭用品・雑貨",
    "industry_id": "252010",
    "industry_name": "家庭用耐久財",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25202010": {
    "sub_industry_name": "レジャー用品",
    "industry_id": "252020",
    "industry_name": "レジャー用品",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25203010": {
    "sub_industry_name": "アパレル・アクセサリー・贅沢品",
    "industry_id": "252030",
    "industry_name": "繊維・アパレル・贅沢品",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25203020": {
    "sub_industry_name": "履物",
    "industry_id": "252030",
    "industry_name": "繊維・アパレル・贅沢品",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25203030": {
    "sub_industry_name": "繊維",
    "industry_id": "252030",
    "industry_name": "繊維・アパレル・贅沢品",
    "industry_group_id": "2520",
    "industry_group_name": "耐久消費財・アパレル",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25301010": {
    "sub_industry_name": "カジノ・ゲーム",
    "industry_id": "253010",
    "industry_name": "ホテル・レストラン・レジャー",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25301020": {
    "sub_industry_name": "ホテル・リゾート・クルーズ船",
    "industry_id": "253010",
    "industry_name": "ホテル・レストラン・レジャー",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25301030": {
    "sub_industry_name": "レジャー設備",
    "industry_id": "253010",
    "industry_name": "ホテル・レストラン・レジャー",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25301040": {
    "sub_industry_name": "レストラン",
    "industry_id": "253010",
    "industry_name": "ホテル・レストラン・レジャー",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25302010": {
    "sub_industry_name": "教育サービス",
    "industry_id": "253020",
    "industry_name": "各種消費者サービス",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25302020": {
    "sub_industry_name": "専門消費者サービス",
    "industry_id": "253020",
    "industry_name": "各種消費者サービス",
    "industry_group_id": "2530",
    "industry_group_name": "消費者サービス",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25501010": {
    "sub_industry_name": "販売",
    "industry_id": "255010",
    "industry_name": "販売",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25503030": {
    "sub_industry_name": "大規模小売り",
    "industry_id": "255030",
    "industry_name": "大規模小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504010": {
    "sub_industry_name": "衣料小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504020": {
    "sub_industry_name": "コンピュータ・電子機器小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504030": {
    "sub_industry_name": "住宅関連用品小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504040": {
    "sub_industry_name": "その他の専門小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504050": {
    "sub_industry_name": "自動車小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"25504060": {
    "sub_industry_name": "家具・装飾小売り",
    "industry_id": "255040",
    "industry_name": "専門小売り",
    "industry_group_id": "2550",
    "industry_group_name": "一般消費財・サービス流通・小売り",
    "sector_id": "25",
    "sector_name": "一般消費財・サービス"
  },

"30101010": {
    "sub_industry_name": "薬品小売り",
    "industry_id": "301010",
    "industry_name": "生活必需品流通・小売り",
    "industry_group_id": "3010",
    "industry_group_name": "生活必需品流通・小売り",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30101020": {
    "sub_industry_name": "食品流通",
    "industry_id": "301010",
    "industry_name": "生活必需品流通・小売り",
    "industry_group_id": "3010",
    "industry_group_name": "生活必需品流通・小売り",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30101030": {
    "sub_industry_name": "食品小売り",
    "industry_id": "301010",
    "industry_name": "生活必需品流通・小売り",
    "industry_group_id": "3010",
    "industry_group_name": "生活必需品流通・小売り",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30101040": {
    "sub_industry_name": "生活必需品小売り",
    "industry_id": "301010",
    "industry_name": "生活必需品流通・小売り",
    "industry_group_id": "3010",
    "industry_group_name": "生活必需品流通・小売り",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30201010": {
    "sub_industry_name": "醸造",
    "industry_id": "302010",
    "industry_name": "飲料",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30201020": {
    "sub_industry_name": "蒸留酒・ワイン",
    "industry_id": "302010",
    "industry_name": "飲料",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30201030": {
    "sub_industry_name": "清涼飲料・ノンアルコール飲料",
    "industry_id": "302010",
    "industry_name": "飲料",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30202010": {
    "sub_industry_name": "農産物・サービス",
    "industry_id": "302020",
    "industry_name": "食品",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30202030": {
    "sub_industry_name": "包装食品・肉",
    "industry_id": "302020",
    "industry_name": "食品",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30203010": {
    "sub_industry_name": "タバコ",
    "industry_id": "302030",
    "industry_name": "タバコ",
    "industry_group_id": "3020",
    "industry_group_name": "食品・飲料・タバコ",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30301010": {
    "sub_industry_name": "家庭用品",
    "industry_id": "303010",
    "industry_name": "家庭用品",
    "industry_group_id": "3030",
    "industry_group_name": "家庭用品・パーソナル用品",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"30302010": {
    "sub_industry_name": "パーソナルケア用品",
    "industry_id": "303020",
    "industry_name": "パーソナルケア用品",
    "industry_group_id": "3030",
    "industry_group_name": "家庭用品・パーソナル用品",
    "sector_id": "30",
    "sector_name": "生活必需品"
  },

"35101010": {
    "sub_industry_name": "ヘルスケア機器",
    "industry_id": "351010",
    "industry_name": "ヘルスケア機器・用品",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35101020": {
    "sub_industry_name": "ヘルスケア用品",
    "industry_id": "351010",
    "industry_name": "ヘルスケア機器・用品",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35102010": {
    "sub_industry_name": "ヘルスケア・ディストリビュータ",
    "industry_id": "351020",
    "industry_name": "ヘルスケア・プロバイダー/ヘルスケア・サービス",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35102015": {
    "sub_industry_name": "ヘルスケアサービス",
    "industry_id": "351020",
    "industry_name": "ヘルスケア・プロバイダー/ヘルスケア・サービス",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35102020": {
    "sub_industry_name": "ヘルスケア施設",
    "industry_id": "351020",
    "industry_name": "ヘルスケア・プロバイダー/ヘルスケア・サービス",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35102030": {
    "sub_industry_name": "管理健康医療",
    "industry_id": "351020",
    "industry_name": "ヘルスケア・プロバイダー/ヘルスケア・サービス",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35103010": {
    "sub_industry_name": "ヘルスケア・テクノロジー",
    "industry_id": "351030",
    "industry_name": "ヘルスケア・テクノロジー",
    "industry_group_id": "3510",
    "industry_group_name": "ヘルスケア機器・サービス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35201010": {
    "sub_industry_name": "バイオテクノロジー",
    "industry_id": "352010",
    "industry_name": "バイオテクノロジー",
    "industry_group_id": "3520",
    "industry_group_name": "医薬品・バイオテクノロジー・ライフサイエンス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35202010": {
    "sub_industry_name": "医薬品",
    "industry_id": "352020",
    "industry_name": "医薬品",
    "industry_group_id": "3520",
    "industry_group_name": "医薬品・バイオテクノロジー・ライフサイエンス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"35203010": {
    "sub_industry_name": "ライフサイエンス・ツール/サービス",
    "industry_id": "352030",
    "industry_name": "ライフサイエンス・ツール/サービス",
    "industry_group_id": "3520",
    "industry_group_name": "医薬品・バイオテクノロジー・ライフサイエンス",
    "sector_id": "35",
    "sector_name": "ヘルスケア"
  },

"40101010": {
    "sub_industry_name": "都市銀行",
    "industry_id": "401010",
    "industry_name": "銀行",
    "industry_group_id": "4010",
    "industry_group_name": "銀行",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40101015": {
    "sub_industry_name": "地方銀行",
    "industry_id": "401010",
    "industry_name": "銀行",
    "industry_group_id": "4010",
    "industry_group_name": "銀行",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40201020": {
    "sub_industry_name": "各種金融サービス",
    "industry_id": "402010",
    "industry_name": "金融サービス",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40201030": {
    "sub_industry_name": "マルチセクター持株会社",
    "industry_id": "402010",
    "industry_name": "金融サービス",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40201040": {
    "sub_industry_name": "専門金融",
    "industry_id": "402010",
    "industry_name": "金融サービス",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40201050": {
    "sub_industry_name": "商業用・住宅用不動産金融",
    "industry_id": "402010",
    "industry_name": "金融サービス",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40201060": {
    "sub_industry_name": "取引・決済処理サービス",
    "industry_id": "402010",
    "industry_name": "金融サービス",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40202010": {
    "sub_industry_name": "消費者金融",
    "industry_id": "402020",
    "industry_name": "消費者金融",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40203010": {
    "sub_industry_name": "資産運用会社・資産管理銀行",
    "industry_id": "402030",
    "industry_name": "資本市場",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40203020": {
    "sub_industry_name": "投資銀行・証券会社",
    "industry_id": "402030",
    "industry_name": "資本市場",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40203030": {
    "sub_industry_name": "総合資本市場",
    "industry_id": "402030",
    "industry_name": "資本市場",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40203040": {
    "sub_industry_name": "取引所およびデータ提供会社",
    "industry_id": "402030",
    "industry_name": "資本市場",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },

/*"40204010": {
    "sub_industry_name": "モーゲージ不動産投資信託（REIT）",
    "industry_id": "402040",
    "industry_name": "モーゲージ不動産投資信託（REIT）",
    "industry_group_id": "4020",
    "industry_group_name": "金融サービス",
    "sector_id": "40",
    "sector_name": "金融"
  },
*/ 
"40301010": {
    "sub_industry_name": "保険ブローカー",
    "industry_id": "403010",
    "industry_name": "保険",
    "industry_group_id": "4030",
    "industry_group_name": "保険",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40301020": {
    "sub_industry_name": "生命保険・健康保険",
    "industry_id": "403010",
    "industry_name": "保険",
    "industry_group_id": "4030",
    "industry_group_name": "保険",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40301030": {
    "sub_industry_name": "総合保険",
    "industry_id": "403010",
    "industry_name": "保険",
    "industry_group_id": "4030",
    "industry_group_name": "保険",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40301040": {
    "sub_industry_name": "動産保険・損害保険",
    "industry_id": "403010",
    "industry_name": "保険",
    "industry_group_id": "4030",
    "industry_group_name": "保険",
    "sector_id": "40",
    "sector_name": "金融"
  },

"40301050": {
    "sub_industry_name": "再保険",
    "industry_id": "403010",
    "industry_name": "保険",
    "industry_group_id": "4030",
    "industry_group_name": "保険",
    "sector_id": "40",
    "sector_name": "金融"
  },

"45102010": {
    "sub_industry_name": "情報技術コンサルティング・他のサービス",
    "industry_id": "451020",
    "industry_name": "情報技術サービス",
    "industry_group_id": "4510",
    "industry_group_name": "ソフトウェア・サービス",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45102030": {
    "sub_industry_name": "インターネットサービスおよびインフラストラクチャー",
    "industry_id": "451020",
    "industry_name": "情報技術サービス",
    "industry_group_id": "4510",
    "industry_group_name": "ソフトウェア・サービス",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45103010": {
    "sub_industry_name": "アプリケーション・ソフトウェア",
    "industry_id": "451030",
    "industry_name": "ソフトウェア",
    "industry_group_id": "4510",
    "industry_group_name": "ソフトウェア・サービス",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45103020": {
    "sub_industry_name": "システム・ソフトウェア",
    "industry_id": "451030",
    "industry_name": "ソフトウェア",
    "industry_group_id": "4510",
    "industry_group_name": "ソフトウェア・サービス",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45201020": {
    "sub_industry_name": "通信機器",
    "industry_id": "452010",
    "industry_name": "通信機器",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45202030": {
    "sub_industry_name": "テクノロジー ハードウェア・コンピュータ記憶装置・周辺機器",
    "industry_id": "452020",
    "industry_name": "コンピュータ・周辺機器",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45203010": {
    "sub_industry_name": "電子装置・機器",
    "industry_id": "452030",
    "industry_name": "電子装置・機器・部品",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45203015": {
    "sub_industry_name": "電子部品",
    "industry_id": "452030",
    "industry_name": "電子装置・機器・部品",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45203020": {
    "sub_industry_name": "電子製品製造サービス",
    "industry_id": "452030",
    "industry_name": "電子装置・機器・部品",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45203030": {
    "sub_industry_name": "テクノロジー ディストリビュータ",
    "industry_id": "452030",
    "industry_name": "電子装置・機器・部品",
    "industry_group_id": "4520",
    "industry_group_name": "テクノロジー・ハードウェアおよび機器",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45301010": {
    "sub_industry_name": "半導体素材・装置",
    "industry_id": "453010",
    "industry_name": "半導体・半導体製造装置",
    "industry_group_id": "4530",
    "industry_group_name": "半導体・半導体製造装置",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"45301020": {
    "sub_industry_name": "半導体",
    "industry_id": "453010",
    "industry_name": "半導体・半導体製造装置",
    "industry_group_id": "4530",
    "industry_group_name": "半導体・半導体製造装置",
    "sector_id": "45",
    "sector_name": "情報技術"
  },

"50101010": {
    "sub_industry_name": "代替通信事業会社",
    "industry_id": "501010",
    "industry_name": "各種電気通信サービス",
    "industry_group_id": "5010",
    "industry_group_name": "電気通信サービス",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50101020": {
    "sub_industry_name": "総合電気通信サービス",
    "industry_id": "501010",
    "industry_name": "各種電気通信サービス",
    "industry_group_id": "5010",
    "industry_group_name": "電気通信サービス",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50102010": {
    "sub_industry_name": "無線通信サービス",
    "industry_id": "501020",
    "industry_name": "無線通信サービス",
    "industry_group_id": "5010",
    "industry_group_name": "電気通信サービス",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50201010": {
    "sub_industry_name": "広告",
    "industry_id": "502010",
    "industry_name": "メディア",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50201020": {
    "sub_industry_name": "放送",
    "industry_id": "502010",
    "industry_name": "メディア",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50201030": {
    "sub_industry_name": "ケーブル・衛星テレビ",
    "industry_id": "502010",
    "industry_name": "メディア",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50201040": {
    "sub_industry_name": "出版",
    "industry_id": "502010",
    "industry_name": "メディア",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50202010": {
    "sub_industry_name": "映画・娯楽",
    "industry_id": "502020",
    "industry_name": "娯楽",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50202020": {
    "sub_industry_name": "インタラクティブ・ホームエンターテイメント",
    "industry_id": "502020",
    "industry_name": "娯楽",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"50203010": {
    "sub_industry_name": "インタラクティブ・メディアおよびサービス",
    "industry_id": "502030",
    "industry_name": "インタラクティブ・メディアおよびサービス",
    "industry_group_id": "5020",
    "industry_group_name": "メディア・娯楽",
    "sector_id": "50",
    "sector_name": "コミュニケーション・サービス"
  },

"55101010": {
    "sub_industry_name": "電力",
    "industry_id": "551010",
    "industry_name": "電力",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

"55102010": {
    "sub_industry_name": "ガス",
    "industry_id": "551020",
    "industry_name": "ガス",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

"55103010": {
    "sub_industry_name": "総合公益事業",
    "industry_id": "551030",
    "industry_name": "総合公益事業",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

"55104010": {
    "sub_industry_name": "水道",
    "industry_id": "551040",
    "industry_name": "水道",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

"55105010": {
    "sub_industry_name": "独立系発電事業者・エネルギー販売業者",
    "industry_id": "551050",
    "industry_name": "独立系発電事業者・エネルギー販売業者",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

"55105020": {
    "sub_industry_name": "再生エネルギー系発電事業者",
    "industry_id": "551050",
    "industry_name": "独立系発電事業者・エネルギー販売業者",
    "industry_group_id": "5510",
    "industry_group_name": "公益事業",
    "sector_id": "55",
    "sector_name": "公益事業"
  },

/*"60101010": {
    "sub_industry_name": "各種不動産投資信託",
    "industry_id": "601010",
    "industry_name": "各種不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60102510": {
    "sub_industry_name": "工業用不動産投資信託",
    "industry_id": "601025",
    "industry_name": "工業用不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60103010": {
    "sub_industry_name": "ホテル・リゾート不動産投資信託",
    "industry_id": "601030",
    "industry_name": "ホテル・リゾート不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60104010": {
    "sub_industry_name": "オフィス不動産投資信託",
    "industry_id": "601040",
    "industry_name": "オフィス不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60105010": {
    "sub_industry_name": "ヘルスケア不動産投資信託",
    "industry_id": "601050",
    "industry_name": "ヘルスケア不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60106010": {
    "sub_industry_name": "集合住宅用不動産投資信託",
    "industry_id": "601060",
    "industry_name": "住宅用不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60106020": {
    "sub_industry_name": "一戸建て住宅用不動産投資信託",
    "industry_id": "601060",
    "industry_name": "住宅用不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60107010": {
    "sub_industry_name": "店舗用不動産投資信託",
    "industry_id": "601070",
    "industry_name": "店舗用不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60108010": {
    "sub_industry_name": "その他の専門不動産投資信託",
    "industry_id": "601080",
    "industry_name": "専門不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60108020": {
    "sub_industry_name": "トランクルーム不動産投資信託",
    "industry_id": "601080",
    "industry_name": "専門不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60108030": {
    "sub_industry_name": "電波塔不動産投資信託",
    "industry_id": "601080",
    "industry_name": "専門不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60108040": {
    "sub_industry_name": "森林不動産投資信託",
    "industry_id": "601080",
    "industry_name": "専門不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60108050": {
    "sub_industry_name": "データセンター不動産投資信託",
    "industry_id": "601080",
    "industry_name": "専門不動産投資信託",
    "industry_group_id": "6010",
    "industry_group_name": "エクイティ不動産投資信託（REIT）",
    "sector_id": "60",
    "sector_name": "不動産"
  },*/ 

"60201010": {
    "sub_industry_name": "各種不動産事業",
    "industry_id": "602010",
    "industry_name": "不動産管理・開発",
    "industry_group_id": "6020",
    "industry_group_name": "不動産管理・開発",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60201020": {
    "sub_industry_name": "不動産運営会社",
    "industry_id": "602010",
    "industry_name": "不動産管理・開発",
    "industry_group_id": "6020",
    "industry_group_name": "不動産管理・開発",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60201030": {
    "sub_industry_name": "不動産開発",
    "industry_id": "602010",
    "industry_name": "不動産管理・開発",
    "industry_group_id": "6020",
    "industry_group_name": "不動産管理・開発",
    "sector_id": "60",
    "sector_name": "不動産"
  },

"60201040": {
    "sub_industry_name": "不動産サービス",
    "industry_id": "602010",
    "industry_name": "不動産管理・開発",
    "industry_group_id": "6020",
    "industry_group_name": "不動産管理・開発",
    "sector_id": "60",
    "sector_name": "不動産"
  },

  "98101010": {
    "sub_industry_name": "TOKYO PRO MARKET",
    "industry_id": "981010",
    "industry_name": "TOKYO PRO MARKET",
    "industry_group_id": "9810",
    "industry_group_name": "TOKYO PRO MARKET",
    "sector_id": "98",
    "sector_name": "TPM"
  },

  "99101010": {
    "sub_industry_name": "株式以外",
    "industry_id": "991010",
    "industry_name": "株式以外",
    "industry_group_id": "9910",
    "industry_group_name": "株式以外",
    "sector_id": "99",
    "sector_name": "株式以外"
  },

  "99101020": {
    "sub_industry_name": "ETF・ETN",
    "industry_id": "991010",
    "industry_name": "株式以外",
    "industry_group_id": "9910",
    "industry_group_name": "株式以外",
    "sector_id": "99",
    "sector_name": "株式以外"
  },

  "99101030": {
    "sub_industry_name": "投資信託・REIT",
    "industry_id": "991010",
    "industry_name": "株式以外",
    "industry_group_id": "9910",
    "industry_group_name": "株式以外",
    "sector_id": "99",
    "sector_name": "株式以外"
  }
};
