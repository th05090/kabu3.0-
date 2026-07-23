import { db } from '@/lib/db';
import { StockTable, StockRow } from '@/features/screener/components/StockTable';
import { StockFilter } from '@/features/screener/components/StockFilter';

export default async function Home() {
  // DBからデータを取得し、Client Component に渡せるよう Plain Object に変換（シリアライズ）
  let stocks: StockRow[] = [];
  try {
    const result = await db.execute('SELECT * FROM stocks');
    // NOTE: @libsql/client の返す row は内部プロパティを持つため、JSONを経由して完全なPlain Object化する
    stocks = JSON.parse(JSON.stringify(result.rows));
  } catch (error) {
    console.error('Failed to fetch stocks', error);
  }

  return (
    <main className="page-main">
      {/* 将来的に左側にグローバルメニューが入る想定 */}
      
      <div className="screener-content-wrapper">
        <header className="page-header">
          <h1>kabu3.0 - スクリーナー</h1>
        </header>

        {/* フィルタは上部に配置 */}
        <section className="screener-top-filter">
          <StockFilter />
        </section>
        
        <section className="screener-table-section">
          <StockTable data={stocks} />
        </section>
      </div>
    </main>
  );
}
