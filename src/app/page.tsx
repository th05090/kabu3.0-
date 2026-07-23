import { db } from '@/lib/db';
import { StockTable, StockRow } from '@/features/screener/components/StockTable';
import { StockFilter } from '@/features/screener/components/StockFilter';
import Link from 'next/link';

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || '1', 10);
  const limit = 100;
  const offset = (page - 1) * limit;

  let stocks: StockRow[] = [];
  let totalCount = 0;

  try {
    const countResult = await db.execute('SELECT COUNT(*) as count FROM stocks');
    totalCount = countResult.rows[0].count as number;

    const result = await db.execute({
      sql: 'SELECT * FROM stocks LIMIT ? OFFSET ?',
      args: [limit, offset]
    });
    stocks = JSON.parse(JSON.stringify(result.rows));
  } catch (error) {
    console.error('Failed to fetch stocks', error);
  }

  const totalPages = Math.ceil(totalCount / limit);

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

        <section className="pagination-controls">
          <div className="pagination-info">
            全 {totalCount} 件中 {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} 件目を表示
          </div>
          <div className="pagination-buttons">
            {page > 1 && (
              <Link href={`/?page=${page - 1}`} className="btn">前へ</Link>
            )}
            <span className="page-num">{page} / {totalPages || 1}</span>
            {page < totalPages && (
              <Link href={`/?page=${page + 1}`} className="btn">次へ</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
