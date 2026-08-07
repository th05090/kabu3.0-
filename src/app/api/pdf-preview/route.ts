import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pdfPath = searchParams.get('path');

  if (!pdfPath) {
    return new NextResponse('PDF path is required', { status: 400 });
  }

  try {
    // Resolve absolute path safely if it's relative
    const absolutePath = path.isAbsolute(pdfPath) 
      ? pdfPath 
      : path.join(process.cwd(), pdfPath);

    if (!fs.existsSync(absolutePath)) {
      return new NextResponse('PDF not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline', // 'inline' tells browser to display it
      },
    });
  } catch (error) {
    console.error('Error serving PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
