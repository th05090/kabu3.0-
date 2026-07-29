import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    // We want to force re-classification for all stocks or just missing ones.
    // Since this is a bulk "sync/reclassify" button, we might want to clear gics_sub_industry_id first,
    // or the script could be modified to re-classify everything.
    // For now, we will run a small script to clear the IDs and then run the classification batch.
    
    // We run it as a detached child process so the API returns immediately.
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'run_gics_classification.ts');
    
    // Clear the IDs first via sqlite
    const { createClient } = await import('@libsql/client');
    const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
    await db.execute('UPDATE equities_master SET gics_sub_industry_id = NULL');
    
    console.log("Triggering background classification batch...");
    
    const child = spawn('npx', ['tsx', scriptPath], {
      detached: true,
      stdio: 'ignore', // Let it run entirely in the background
      cwd: process.cwd(),
      shell: true // Needed on Windows to resolve npx
    });
    
    child.unref(); // Don't keep the event loop alive

    return NextResponse.json({ success: true, message: 'Batch re-classification started in the background.' });
  } catch (error: any) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
