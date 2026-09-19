import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { DOCS_REGISTRY } from '../../../features/docs/docs_data';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ docs: DOCS_REGISTRY });
    }

    const docItem = DOCS_REGISTRY.find((d) => d.id === id);
    if (!docItem) {
      return NextResponse.json({ error: `Document with ID '${id}' not found` }, { status: 404 });
    }

    const docsDir = path.join(process.cwd(), 'src', 'data', 'docs');
    const filePath = path.join(docsDir, docItem.filename);

    // パストラバーサル防止ガード
    if (!filePath.startsWith(docsDir)) {
      return NextResponse.json({ error: 'Invalid document path' }, { status: 400 });
    }

    const content = await fs.readFile(filePath, 'utf-8');

    return NextResponse.json({
      doc: docItem,
      content,
    });
  } catch (error: any) {
    console.error('Failed to load document:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
