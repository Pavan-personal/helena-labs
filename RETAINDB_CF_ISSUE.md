CF on `api.retaindb.com` is blocking Vercel serverless egress with a `Just a moment...` challenge. Same request from my laptop returns 200.

Workspace: `77aa1d7d-a3ae-4dc5-bb92-e07abe81a5f5` | Region: iad1

**Proof 1 - local: HTTP 200**

```
$ curl -X POST https://api.retaindb.com/v1/memory/search \
  -H "Authorization: Bearer wsk_..." \
  -d '{"project":"77aa1d7d-...","query":"memory leak"}'

{"count":1,"latency_ms":80,"similarity":0.54,
 "content":"[INC:b72094bf-...] Memory leak on notification-worker..."}
HTTP 200
```

**Proof 2 - env is loaded on Vercel**

```
$ curl https://helenalabs.vercel.app/api/health
{"env_seen":{"retaindb":true,"btl":true,"supabase":true}}
```

**Proof 3 - from Vercel: falls back to Postgres FTS**

```
event: tool_result
data: {"summary":"1 incident via Postgres FTS","count":1}
```

The raw CF response we captured earlier:

```
[retaindb] /v1/memory/search -> 403 in 34ms
<!DOCTYPE html><title>Just a moment...</title>...cloudflare challenge...
```

Can you allowlist Vercel egress on CF, or share a bypass header?
