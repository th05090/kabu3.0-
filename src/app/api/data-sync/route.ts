import { NextResponse } from 'next/server';
import { syncJQuants } from '@/lib/jquants';

export const dynamic = 'force-dynamic';

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const sendEvent = (data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          isClosed = true;
          console.log("Client disconnected or stream closed.");
        }
      };

      try {
        const onProgress = (msg: string) => {
          sendEvent({ type: 'progress', message: msg });
        };

        const result = await syncJQuants(onProgress);

        if (result.success) {
          sendEvent({ type: 'done', message: 'Sync completed successfully' });
        } else {
          sendEvent({ type: 'error', message: result.error });
        }
      } catch (error: any) {
        console.error('API Error:', error);
        sendEvent({ type: 'error', message: error.message });
      } finally {
        if (!isClosed) {
          try {
            controller.close();
          } catch (e) {}
        }
      }
    },
    cancel() {
      console.log("Stream canceled by client");
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
