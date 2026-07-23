import * as dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import * as zlib from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// 環境変数の読み込み (.env.local)
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.JQUANTS_API_KEY;
if (!API_KEY) {
  console.error('Error: JQUANTS_API_KEY is not set in .env.local');
  process.exit(1);
}

const db = createClient({
  url: 'file:local.db',
});

const BASE_URL = 'https://api.jquants.com';

// 共通のフェッチ関数
async function fetchJQuants(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': API_KEY!,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

// 署名付きダウンロードURLを取得してストリーム処理する関数
async function downloadAndProcessCsv(downloadUrl: string, onRow: (row: any) => Promise<void>) {
  console.log(`Downloading file...`);
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  if (!res.body) throw new Error('No body in response');

  // Web API の ReadableStream を Node の stream.Readable に変換
  const nodeStream = Readable.fromWeb(res.body as any);

  // Gunzip ストリームを作成
  const unzipStream = zlib.createGunzip();

  // CSV パーサーストリームを作成 (ヘッダー行ありと仮定)
  const csvStream = parse({
    columns: true,
    skip_empty_lines: true,
  });

  // レコードごとの処理
  let count = 0;
  csvStream.on('readable', async () => {
    let row;
    while ((row = csvStream.read()) !== null) {
      count++;
      if (count % 10000 === 0) {
        console.log(`Processed ${count} rows...`);
      }
      // ここで1行ずつ処理 (本番ではバッチインサートが望ましいが今回は簡略化)
      try {
        await onRow(row);
      } catch (err) {
        console.error('Error processing row:', row, err);
      }
    }
  });

  // パイプラインで繋ぐ: Fetch Response -> Gunzip -> CSV Parse
  await pipeline(nodeStream, unzipStream, csvStream);
  console.log(`Finished processing ${count} rows.`);
}

async function main() {
  console.log('--- J-Quants Bulk Data Sync Started ---');

  try {
    // 1. Bulk List を取得 (例として /equities/master)
    // ※V2のドキュメント等に沿ってエンドポイントを調整
    // ここでは構造を確認するためのダミー実装に近い形にしています
    console.log('Fetching bulk list...');
    const listRes = await fetchJQuants('/v2/bulk/list?endpoint=equities/master');
    console.log('Bulk list response:', JSON.stringify(listRes, null, 2));

    console.log('--- Sync Completed Successfully ---');
  } catch (error) {
    console.error('Data Sync Failed:', error);
  }
}

main();
