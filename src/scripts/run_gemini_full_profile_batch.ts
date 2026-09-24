import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { db } from '../lib/db';
import { GICS_DICTIONARY } from '../data/gics_dictionary';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const CHUNK_SIZE = 5;
const PROGRESS_FILE = path.resolve(process.cwd(), 'scratch/gemini_profile_batch_progress.json');

// 進捗ファイルの読み書き
function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return new Set(data.processedTickers || []);
    } catch (e) {
      console.warn('進捗ファイルの読み込みに失敗しました。新規作成します。');
    }
  }
  return new Set();
}

function saveProgress(processedSet: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    processedCount: processedSet.size,
    processedTickers: Array.from(processedSet)
  }, null, 2), 'utf-8');
}

// DB実行のリトライヘルパー（SQLITE_BUSY対策）
async function executeWithRetry(query: { sql: string; args?: any[] }, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.execute(query);
    } catch (err: any) {
      if ((err.code === 'SQLITE_BUSY' || err.message?.includes('locked')) && attempt < maxRetries) {
        const waitMs = 500 * attempt;
        console.warn(`  [DBビジー検知] ロック解除待機中 (${waitMs}ms)...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

// バックアップテーブル作成
async function ensureBackups() {
  console.log('--- データベースのバックアップを確認/作成中 ---');
  await executeWithRetry({ sql: 'PRAGMA journal_mode = WAL;' });
  await executeWithRetry({ sql: 'PRAGMA busy_timeout = 10000;' });
  await executeWithRetry({
    sql: `
      CREATE TABLE IF NOT EXISTS equities_master_backup AS 
      SELECT * FROM equities_master
    `
  });
  await executeWithRetry({
    sql: `
      CREATE TABLE IF NOT EXISTS stocks_backup AS 
      SELECT * FROM stocks
    `
  });
  console.log('  => equities_master_backup / stocks_backup 準備完了');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('【エラー】GEMINI_API_KEY が設定されていません。');
    process.exit(1);
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  console.log(`=== Gemini 全上場企業プロファイル＆GICS一括刷新バッチ ===`);
  console.log(`使用モデル: ${modelName}`);

  // CLI引数パース (--limit 10 など)
  const args = process.argv.slice(2);
  let limit: number | null = null;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    console.log(`[制限モード] 最大処理件数: ${limit} 件`);
  }

  await ensureBackups();

  // 1. GICS全分類の読み込み（コード＋セクター名＋サブ産業名）
  const gicsPath = path.resolve(process.cwd(), 'src/data/gics_categories.json');
  const gicsCategories = JSON.parse(fs.readFileSync(gicsPath, 'utf-8'));
  let gicsDefinitionText = "【GICS 業種コード定義リスト (コード: [セクター] サブ産業名)】\n";
  for (const cat of gicsCategories) {
    const sec = GICS_DICTIONARY[cat.sub_industry_id]?.sector_name || 'その他';
    gicsDefinitionText += `${cat.sub_industry_id}: [${sec}] ${cat.category_name}\n`;
  }

  // 2. 一般事業会社（TPM 98番台、株式以外 99番台 除外）を取得
  const targetQuery = `
    SELECT ticker, name, industry, summary, main_segment, gics_sub_industry_id 
    FROM equities_master 
    WHERE (gics_sub_industry_id IS NULL OR (gics_sub_industry_id NOT LIKE '98%' AND gics_sub_industry_id NOT LIKE '99%'))
    ORDER BY ticker ASC
  `;
  const targetsRes = await db.execute(targetQuery);
  const allTargets = targetsRes.rows;
  console.log(`DB内の一般事業会社（対象）: 全 ${allTargets.length} 社`);

  // Gemini生成済み（詳細な説明文が生成され、「記載なし」を含まない企業）をスキップ対象とする
  const processedSet = new Set<string>();
  for (const t of allTargets) {
    const seg = String(t.main_segment || '');
    if (seg && seg !== '{}' && seg !== 'null' && !seg.includes('"description":"記載なし"')) {
      processedSet.add(String(t.ticker));
    }
  }
  console.log(`Gemini生成済み（スキップ対象）: ${processedSet.size} 社`);

  // 未処理リストの作成
  let remaining = allTargets.filter(t => !processedSet.has(String(t.ticker)));
  if (limit !== null) {
    remaining = remaining.slice(0, limit);
  }
  console.log(`今回の実行対象（旧データ残存企業）: ${remaining.length} 社\n`);

  if (remaining.length === 0) {
    console.log('すべての対象企業の処理が完了しています。');
    return;
  }

  const promptSystem = `あなたは世界的格付機関および株式市場アナリストと同等の高度な業界分析スキルを持つGICS分類エキスパートです。
以下の日本上場企業各社について、最新のビジネスモデル、主力セグメント、キーワード、および最も合致するGICS分類を詳細に分析してください。

【重要な判定原則】
1. 思考プロセス（CoT）の言語化: 各企業の「最新の主力事業、代表的な製品・サービス名、主な収益源」を100〜150文字程度で簡潔明瞭に要約（summary）してください。
2. 主従関係の厳格な見極め: 探索的な新規事業や微小な副業キーワードに惑わされず、売上・営業利益の大半を稼ぎ出している本業の実態を最優先してください。
3. プラットフォームと小売の区別: 自社仕入れ販売か、マッチング・配送仲介プラットフォームかを区別してください。
4. 小売りの細分化: 食品スーパー等で売上の大半が食品である場合は「食品小売り（30101030）」に分類してください。

【GICS 業種コード定義リスト】
${gicsDefinitionText}`;

  let successCount = 0;
  let failCount = 0;
  const totalChunks = Math.ceil(remaining.length / CHUNK_SIZE);
  const startTimeTotal = Date.now();

  for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = remaining.slice(i, i + CHUNK_SIZE);
    const chunkTickers = chunk.map(c => String(c.ticker));
    const chunkNames = chunk.map(c => `${c.ticker} ${c.name}`).join(', ');

    console.log(`[${chunkIndex}/${totalChunks}] 処理開始: ${chunkNames}`);

    let companyContextText = "【分析対象企業】\n";
    for (const c of chunk) {
      companyContextText += `- [コード: ${c.ticker}] 企業名: ${c.name}, 東証業種: ${c.industry}\n`;
    }

    const promptUser = `${companyContextText}

【出力要件】
上記 ${chunk.length} 社の全社について、以下の形式のJSON配列のみを出力してください。Markdown記法や解説文は含めないでください。
[
  {
    "ticker": "銘柄コード",
    "name": "企業名",
    "summary": "企業の事業概要（100〜150文字程度。最新の主力事業、代表的な製品・サービス名、収益源を投資家向けに具体的かつ簡潔明瞭に記載）",
    "main_segment": {
      "segment": "最大収益セグメント名",
      "description": "主力事業の内容と売上・利益の柱としての具体的な説明"
    },
    "sub_segments": [
      {
        "segment": "サブ事業セグメント名",
        "description": "サブ事業の具体的な事業内容"
      }
    ],
    "theme_keywords": "投資・ビジネス上の機能的価値を表す主要キーワード（カンマ区切りで5〜8個程度。代表的サービス名や技術名を含む）",
    "gics_sub_industry_id": "8桁のGICSコード",
    "reason": "このGICS分類を選定した論理的理由（売上・収益の柱との整合性）"
  }
]`;

    let chunkSuccess = false;
    let results: any[] = [];

    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const fullPrompt = `${promptSystem}\n\n${promptUser}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`  [試行 ${attempt}/8] APIエラー (${response.status}): ${errText.slice(0, 100)}...`);
          await new Promise(r => setTimeout(r, 6000 * attempt));
          continue;
        }

        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('APIのレスポンスが空でした');

        results = JSON.parse(rawText);
        if (!Array.isArray(results)) throw new Error('結果が配列形式ではありませんでした');

        chunkSuccess = true;
        break;
      } catch (err: any) {
        console.warn(`  [試行 ${attempt}/8] エラー/タイムアウト: ${err.message}`);
        await new Promise(r => setTimeout(r, 6000 * attempt));
      }
    }

    if (chunkSuccess && results.length > 0) {
      for (const item of results) {
        const ticker = String(item.ticker).trim();
        const rawGicsCode = String(item.gics_sub_industry_id || '').trim();
        let finalGicsCode = rawGicsCode;
        if (finalGicsCode === '50204010') finalGicsCode = '50201040'; // Publishing旧コード補正
        let dictEntry = GICS_DICTIONARY[finalGicsCode];

        if (!dictEntry) {
          // 元のDBに有効なGICSがあればそれを採用
          const original = allTargets.find(t => String(t.ticker) === ticker);
          if (original?.gics_sub_industry_id && GICS_DICTIONARY[String(original.gics_sub_industry_id)]) {
            finalGicsCode = String(original.gics_sub_industry_id);
            dictEntry = GICS_DICTIONARY[finalGicsCode];
            console.log(`  [自動救済] ${ticker}: Geminiコード(${rawGicsCode})を既存コード(${finalGicsCode})で補正保存`);
          } else {
            console.warn(`  [スキップ警告] 無効なGICSコードが返されました: ${ticker} -> ${rawGicsCode}`);
            continue;
          }
        }

        const sectorName = dictEntry.sector_name;
        const summary = String(item.summary || '').trim();
        const mainSegStr = item.main_segment ? JSON.stringify(item.main_segment) : "{}";
        const subSegsStr = item.sub_segments && Array.isArray(item.sub_segments) ? JSON.stringify(item.sub_segments) : "[]";
        const keywords = String(item.theme_keywords || '').trim();
        const reason = String(item.reason || '').trim();

        // equities_master 更新
        await executeWithRetry({
          sql: `
            UPDATE equities_master 
            SET summary = ?, 
                main_segment = ?, 
                sub_segments = ?, 
                theme_keywords = ?, 
                gics_sub_industry_id = ?, 
                theme = ?, 
                gics_audit_status = 'OK', 
                gics_audit_reason = ? 
            WHERE ticker = ?
          `,
          args: [summary, mainSegStr, subSegsStr, keywords, finalGicsCode, sectorName, reason, ticker]
        });

        // stocks 同期更新
        await executeWithRetry({
          sql: `UPDATE stocks SET gics_sub_industry_id = ? WHERE ticker = ?`,
          args: [finalGicsCode, ticker]
        });

        // sepa_metrics 同期更新
        await executeWithRetry({
          sql: `UPDATE sepa_metrics SET gics_sub_industry_id = ? WHERE ticker = ?`,
          args: [finalGicsCode, ticker]
        });

        processedSet.add(ticker);
        successCount++;
      }

      saveProgress(processedSet);
      console.log(`  => バッチ ${chunkIndex} 完了 (成功累計: ${successCount}社)`);
    } else {
      console.error(`  => バッチ ${chunkIndex} 失敗: スキップして次へ進みます`);
      failCount += chunk.length;
    }

    // レート制限（15 RPM）厳格遵守のため各バッチ間隔を4秒空ける (60s / 15 req = 4s)
    if (i + CHUNK_SIZE < remaining.length) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  const elapsedTotalMin = ((Date.now() - startTimeTotal) / 1000 / 60).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`=== バッチ処理完了 ===`);
  console.log(`総所要時間: ${elapsedTotalMin} 分`);
  console.log(`更新成功: ${successCount} 社`);
  console.log(`更新失敗/スキップ: ${failCount} 社`);
  console.log(`進捗ファイル総記録数: ${processedSet.size} 社`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
