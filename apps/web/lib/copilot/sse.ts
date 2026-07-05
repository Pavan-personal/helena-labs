/**
 * Server-Sent Events writer for the copilot turn endpoint.
 * Every named event lets the client dispatch a different handler.
 */

export type SseEvent =
  | { type: 'status'; kind: string }
  | { type: 'model_switch'; model: string; reason: string }
  | { type: 'tool_call'; id: string; name: string; args: string }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      summary: string;
      count?: number;
      error?: string;
    }
  | { type: 'citation'; kind: 'incident' | 'runbook'; id: string; valid: boolean }
  | {
      type: 'message';
      role: 'assistant';
      markdown: string;
      citations: Array<{ kind: string; id: string; raw: string }>;
      model: string;
      citations_valid: boolean;
      latency_ms: number;
    }
  | { type: 'done'; turnId: string }
  | { type: 'error'; code: string; message: string; recoverable: boolean };

export function encodeSseFrame(evt: SseEvent): string {
  const { type, ...data } = evt as { type: string } & Record<string, unknown>;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function encodeKeepalive(): string {
  return ': keepalive\n\n';
}

/**
 * Convenience wrapper: build a ReadableStream that a Next.js route can
 * return directly. The caller writes events via write() and must call close()
 * to end the stream.
 */
export function createSseStream(): {
  stream: ReadableStream<Uint8Array>;
  write: (evt: SseEvent) => void;
  keepalive: () => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    }
  });

  return {
    stream,
    write(evt: SseEvent) {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(encodeSseFrame(evt)));
      } catch {
        closed = true;
      }
    },
    keepalive() {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(encodeKeepalive()));
      } catch {
        closed = true;
      }
    },
    close() {
      if (closed || !controller) return;
      try {
        controller.close();
      } catch {
        // ignore
      }
      closed = true;
    }
  };
}

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no'
};
