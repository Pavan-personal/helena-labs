import { getServerClient, searchIncidents, listIncidents } from '@helena/db';

/**
 * Copilot tool definitions in OpenAI function-calling format.
 * These are what the model sees.
 */
export const TOOL_DEFS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_incidents',
      description:
        "Full-text search the workspace's incident memory. Use for any question that mentions a symptom, service, error string, or time window. Returns up to 10 incidents ranked by relevance. Always call this before answering any 'has this happened before' or 'what do we know about X' question.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "Natural language or keyword query, e.g. 'redis oom checkout'"
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical', 'any'],
            default: 'any'
          },
          limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_incident',
      description:
        'Fetch full record for one incident: title, body, source, severity, timestamps. Call after search_incidents when you need details to cite.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Incident UUID or 8-char prefix' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_recent_incidents',
      description:
        "List the N most recent incidents. Optionally filter by source (slack, grafana, sentry, github, generic) or severity. Use for 'what's happening now' or 'anything from Grafana in the last hour'.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
          source: {
            type: 'string',
            enum: ['slack', 'grafana', 'sentry', 'github', 'generic', 'manual', 'any'],
            default: 'any'
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical', 'any'],
            default: 'any'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_runbook',
      description: 'Fetch a published runbook by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_runbooks',
      description: 'List published runbooks in the workspace. Useful when the user asks what runbooks exist.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }
];

interface ToolContext {
  workspaceId: string;
}

/**
 * Dispatch a tool call to the correct implementation. Returns a plain JSON
 * object that will be sent back to the model as tool_result content.
 * Never throws; failures return { error: '...' } so the model can adapt.
 */
export async function dispatchTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { error: 'invalid arguments (not JSON)' };
  }

  try {
    switch (name) {
      case 'search_incidents':
        return await toolSearchIncidents(ctx, args);
      case 'get_incident':
        return await toolGetIncident(ctx, args);
      case 'list_recent_incidents':
        return await toolListRecent(ctx, args);
      case 'get_runbook':
        return await toolGetRunbook(ctx, args);
      case 'list_runbooks':
        return await toolListRunbooks(ctx, args);
      default:
        return { error: `unknown tool: ${name}` };
    }
  } catch (e) {
    return {
      error: `tool ${name} failed: ${e instanceof Error ? e.message : 'unknown'}`
    };
  }
}

async function toolSearchIncidents(ctx: ToolContext, args: Record<string, unknown>) {
  const query = String(args.query ?? '').trim();
  const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
  const severity = String(args.severity ?? 'any');
  if (!query) return { error: 'query is required' };

  const rows = await searchIncidents(ctx.workspaceId, query, limit);
  const filtered =
    severity === 'any' ? rows : rows.filter((r) => r.severity === severity);

  return {
    count: filtered.length,
    incidents: filtered.slice(0, limit).map((r) => ({
      id: r.id.slice(0, 8),
      full_id: r.id,
      title: r.title,
      source: r.source,
      severity: r.severity,
      channel: r.channel,
      created_at: r.created_at,
      excerpt: (r.body ?? '').slice(0, 400)
    }))
  };
}

async function toolGetIncident(ctx: ToolContext, args: Record<string, unknown>) {
  const idInput = String(args.id ?? '').trim();
  if (!idInput) return { error: 'id is required' };

  const db = getServerClient();
  let { data } = await db
    .from('incidents')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', idInput)
    .maybeSingle();

  if (!data && idInput.length < 32) {
    // `.like` on UUID column requires a ::text cast Supabase JS can't emit;
    // fall back to a workspace-scoped scan + prefix match in JS.
    const { data: scan } = await db
      .from('incidents')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500);
    const rows = (scan ?? []) as Array<{ id: string }>;
    const prefix = idInput.toLowerCase();
    const hit = rows.find((r) => r.id.toLowerCase().startsWith(prefix));
    data = hit ? (hit as unknown as typeof data) : null;
  }

  if (!data) return { error: 'incident not found', looked_up: idInput };

  const row = data as {
    id: string;
    title: string;
    body: string;
    source: string;
    severity: string;
    external_id: string | null;
    channel: string | null;
    extracted_json: unknown;
    screenshot_captions: string[] | null;
    created_at: string;
  };

  return {
    id: row.id.slice(0, 8),
    full_id: row.id,
    title: row.title,
    body: row.body,
    source: row.source,
    severity: row.severity,
    external_id: row.external_id,
    channel: row.channel,
    extracted: row.extracted_json,
    screenshot_captions: row.screenshot_captions,
    created_at: row.created_at
  };
}

async function toolListRecent(ctx: ToolContext, args: Record<string, unknown>) {
  const limit = Math.min(25, Math.max(1, Number(args.limit) || 10));
  const source = String(args.source ?? 'any');
  const severity = String(args.severity ?? 'any');

  const rows = await listIncidents(ctx.workspaceId, {
    source: source === 'any' ? undefined : (source as never),
    severity: severity === 'any' ? undefined : (severity as never),
    limit
  });

  return {
    count: rows.length,
    incidents: rows.map((r) => ({
      id: r.id.slice(0, 8),
      full_id: r.id,
      title: r.title,
      source: r.source,
      severity: r.severity,
      created_at: r.created_at
    }))
  };
}

async function toolGetRunbook(ctx: ToolContext, args: Record<string, unknown>) {
  const id = String(args.id ?? '').trim();
  if (!id) return { error: 'id is required' };
  const db = getServerClient();
  let { data } = await db
    .from('runbooks')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', id)
    .maybeSingle();
  if (!data && id.length < 32) {
    // UUID column + Supabase `.like` needs ::text cast the client can't emit.
    const { data: scan } = await db
      .from('runbooks')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .limit(200);
    const rows = (scan ?? []) as Array<{ id: string }>;
    const prefix = id.toLowerCase();
    const hit = rows.find((r) => r.id.toLowerCase().startsWith(prefix));
    data = hit ? (hit as unknown as typeof data) : null;
  }
  if (!data) return { error: 'runbook not found' };
  const row = data as { id: string; title: string; content_md: string; approved_by: string };
  return {
    id: row.id.slice(0, 8),
    full_id: row.id,
    title: row.title,
    content: row.content_md,
    approved_by: row.approved_by
  };
}

async function toolListRunbooks(ctx: ToolContext, args: Record<string, unknown>) {
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 10));
  const db = getServerClient();
  const { data } = await db
    .from('runbooks')
    .select('id, title, approved_by, approved_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('approved_at', { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    approved_by: string;
    approved_at: string;
  }>;
  return {
    count: rows.length,
    runbooks: rows.map((r) => ({
      id: r.id.slice(0, 8),
      full_id: r.id,
      title: r.title,
      approved_by: r.approved_by,
      approved_at: r.approved_at
    }))
  };
}
