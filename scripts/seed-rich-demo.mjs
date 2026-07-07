/**
 * Rich demo seed: 60 incidents + 10 runbooks spread across the last 12 months,
 * mixed across all 5 sources (slack, discord, grafana, sentry, github). Also
 * mirrors every incident into RetainDB so the Copilot's hybrid retrieval sees
 * it immediately.
 *
 * Themes are intentional so the Copilot has patterns to reason about:
 *   - Redis: connection pool, CPU, OOM (5 incidents across 6 months)
 *   - Checkout/Stripe: webhook, timeouts, null customers (7)
 *   - Notification-worker: OOM every 3h (4)
 *   - Auth: OAuth token expiry, JWT drift (5)
 *   - Deploy failures: build, container pull, migration (8)
 *   - DB: connection exhaustion, slow queries, index missing (7)
 *   - API gateway: 5xx spikes, rate limit, cert renewal (5)
 *   - Kafka: consumer lag, rebalance loop (4)
 *   - CDN: cache invalidation, origin timeout (3)
 *   - Cron: skipped runs, DST bug, timeout (4)
 *   - Recent (last 30 days): 8 fresh incidents
 *
 * Run:
 *   DATABASE_URL="postgres://..." RETAINDB_API_KEY="wsk_..." \
 *     node scripts/seed-rich-demo.mjs <workspace_id>
 */
import postgres from 'postgres';

const workspaceId = process.argv[2];
if (!workspaceId) {
  console.error('Usage: node scripts/seed-rich-demo.mjs <workspace_id>');
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL;
const retainKey = process.env.RETAINDB_API_KEY;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Real day-in-month picker so timestamps look organic.
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// severity, source, channel, title, body, days_ago
const INCIDENTS = [
  // REDIS THEME
  [ 'high', 'grafana', 'incidents',
    'Redis primary CPU at 94%, replica lag >30s',
    'redis-primary-01 CPU pegged. Traced to a KEYS "session:*" scan from an internal admin panel. Tom promoted replica. Rebuilt original as replica. Session cache misses spiked briefly then recovered.\n\nAction items: banned KEYS in production, replaced with SCAN cursors.',
    340 ],
  [ 'critical', 'grafana', 'incidents',
    'Redis connection pool exhausted on writes-primary',
    'Node pool at 100/100 for 4m. Payment writes stalled → 502s at checkout. Bumped max_connections to 200, killed idle connections older than 60s. Long term: switch to pgbouncer for redis-adjacent workers.',
    287 ],
  [ 'high', 'sentry', 'engineering',
    'redis.exceptions.ConnectionError: Too many connections',
    'Surge from notification-worker after DB migration deploy. 3,200 events in 12m. Rolled back deploy, connections normalized. Real fix: connection pool per worker, not global.',
    212 ],
  [ 'medium', 'grafana', 'incidents',
    'Redis OOM on cache-cluster-02',
    'Evictions hit maxmemory-policy allkeys-lru limits. Traced to unbounded feature-flag cache. Added TTL of 30m. Memory usage back to 40%.',
    167 ],
  [ 'high', 'slack', 'oncall',
    'Redis replica out of sync during promo campaign',
    'Black-friday-style spike overwhelmed the async replica. Lag climbed to 4 minutes. Promoted replica manually, added connection pool warmup for future campaigns.',
    92 ],

  // CHECKOUT / STRIPE
  [ 'critical', 'sentry', 'engineering',
    'TypeError: Cannot read property total of undefined in checkout',
    'Regression on checkout flow. Stripe webhook payload has null customer object when guest checkout. Missing null check at api/checkout/finalize.ts:42.\n\nFixed in PR #4218 with optional chaining. Deployed 15:47 UTC.',
    294 ],
  [ 'high', 'sentry', 'engineering',
    'Stripe webhook signature verification failing intermittently',
    'Started after Stripe rotated our webhook secret. Old and new secret both valid for 24h. Configured stripe library to accept both during rotation window.',
    221 ],
  [ 'medium', 'grafana', 'incidents',
    'Payment webhook timeout, Stripe took 8.2s to acknowledge',
    'Downstream idempotency check running full table scan when new. Added covering index (stripe_event_id, created_at). p99 back to 320ms.',
    189 ],
  [ 'high', 'slack', 'incidents',
    'Refund flow broken after Stripe API v2026-04 upgrade',
    'refund.create response shape changed. status field moved from top-level to charge.status. 47 refunds queued and failed. Ran manual reconciliation script, comped affected customers.',
    148 ],
  [ 'critical', 'sentry', 'engineering',
    'Duplicate charges: idempotency key collision on retry storm',
    '11 customers double-charged during a 4m retry loop. Root cause: our idempotency key derived from timestamp+userId, collided under concurrent retries. Now includes SHA of full request body. Refunds issued same day.',
    102 ],
  [ 'medium', 'sentry', 'engineering',
    'RequestTimeoutError on /api/notifications/preferences',
    'p95 climbed from 200ms to 3.2s over 2h. Traced to N+1 on user preferences fetch. Added dataloader batching. p95 back to 180ms.',
    38 ],

  // NOTIFICATION-WORKER OOM
  [ 'high', 'grafana', 'incidents',
    'Memory leak on notification-worker, OOM at 3h',
    'Worker OOM every ~3 hours. Traced to a growing Map<userId, PendingBatch> that was never pruned when batches flushed. Added TTL and explicit clear. Worker stable for 24h+ afterward.',
    2 ],
  [ 'medium', 'sentry', 'engineering',
    'notification-worker unhandled rejection: undefined batch',
    'Race condition between batch flush and shutdown signal. Guard added around batch access after SIGTERM.',
    76 ],
  [ 'high', 'grafana', 'incidents',
    'notification-worker queue depth > 50k for 8 minutes',
    'Push notifications for iOS delayed. APNS returned 429 during rate limit. Backed off to 100/s, batch throughput restored.',
    134 ],
  [ 'low', 'slack', 'oncall',
    'notification-worker restarts every 3h on staging',
    'Same OOM pattern as prod incident from last week. Fix already merged, staging just needed a redeploy.',
    5 ],

  // AUTH / OAUTH
  [ 'critical', 'sentry', 'engineering',
    'JWT signature verification failing across auth-service',
    'Clock drift between auth-service and edge nodes crossed 60s threshold. NTP sync failed silently on 3 edge nodes. Ran ntpdate manually, monitoring added.',
    276 ],
  [ 'high', 'sentry', 'engineering',
    'Google OAuth callback returning 500 for users with .co.uk emails',
    'Regex validating email domain was too strict. Fixed with proper RFC-5322-ish check, added tests for multi-part TLDs.',
    198 ],
  [ 'medium', 'grafana', 'incidents',
    'Auth service p99 latency > 2s during login spike',
    'bcrypt work factor set too high (14) after a security review. Dropped to 12 for existing users, kept 14 for new. p99 back to 400ms.',
    155 ],
  [ 'high', 'sentry', 'engineering',
    'Session tokens expiring 15 minutes early',
    'Cache TTL and JWT exp drifted. Cache was rounding down, JWT rounding up. Aligned to same second-truncated timestamp.',
    88 ],
  [ 'critical', 'slack', 'oncall',
    'All SSO logins failing: SAML certificate expired',
    'No expiry monitoring on the SAML cert. Rotated in emergency, added 30-day pre-expiry alert.',
    31 ],

  // DEPLOY / GITHUB
  [ 'high', 'github', 'incidents',
    'Deployment failure: checkout-service-v2.4.1',
    'ImagePull backoff: private registry auth failed. Docker Hub returned 401. Rotated registry creds via GitHub org secret, redeployed successfully.',
    280 ],
  [ 'medium', 'github', 'incidents',
    'PR #4275 merged: bump kafka client to 3.5.1',
    'Routine dependency update. Kafka rebalance latency improved by 40% in staging load test.',
    5 ],
  [ 'critical', 'github', 'incidents',
    'Deployment rollback: web-frontend v3.11.0 → v3.10.4',
    'Client bundle grew from 340KB to 890KB after tree-shake regression in bundler config. TTFB doubled on mobile. Reverted immediately, real fix in v3.10.5.',
    241 ],
  [ 'high', 'github', 'incidents',
    'Migration lock timeout on prod DB during deploy',
    'Long-running SELECT held share lock. Migration waited 5m, then rolled back. Added kill-conflicting-connections=true to migrator config, migrations complete in <10s now.',
    203 ],
  [ 'medium', 'github', 'incidents',
    'PR #4102 merged: feature flag for new checkout UI',
    'Rolling out to 5% of traffic. GrowthBook integrated. Monitoring conversion delta.',
    45 ],
  [ 'high', 'github', 'incidents',
    'Deployment stuck: kubernetes rollout not progressing',
    'New pods stuck ContainerCreating for 12m. Node ran out of ephemeral storage. Drained node, expanded PV, retried. Root cause: log rotation cron broken.',
    112 ],
  [ 'low', 'github', 'incidents',
    'PR #4310 merged: add health probe to notification-worker',
    'Kubernetes was killing pods that were mid-batch. Health probe now exposes /healthz that returns OK during active batches.',
    3 ],
  [ 'critical', 'github', 'incidents',
    'Rollback: auth-service v5.2.0 broke session refresh',
    'v5.2.0 changed refresh token format. Old clients kept trying to refresh with old format → mass logouts. Rolled back, then shipped v5.2.1 with dual-format support.',
    76 ],

  // DB
  [ 'critical', 'grafana', 'incidents',
    'Database connection pool exhausted on writes-primary',
    'Every workers pool hit ceiling simultaneously. Root cause: forgotten connection.commit() in analytics writer after v2.1 deploy. Rolled back v2.1, released hotfix v2.1.1 later.',
    3 ],
  [ 'high', 'grafana', 'incidents',
    'Slow query in reporting dashboard blocking writes',
    'Analytics dashboard ran SELECT * from events without partition pruning. Locked writes for 8m. Added query timeout of 30s to reporting user, killed the runaway.',
    3 ],
  [ 'medium', 'sentry', 'engineering',
    'PostgresError: duplicate key value violates unique constraint',
    'Concurrent inserts for the same user_email during race. Added ON CONFLICT DO NOTHING; also fixed the race in upstream form validation.',
    167 ],
  [ 'high', 'grafana', 'incidents',
    'DB replica lag climbed to 12 minutes overnight',
    'Nightly full-table VACUUM held locks. Switched to VACUUM (analyze, index_cleanup off) and staggered per-table. Lag never crossed 30s afterward.',
    128 ],
  [ 'medium', 'slack', 'incidents',
    'Missing index caused full scan on user_events',
    'Support query "find all events for user X" took 40s. Added (user_id, created_at desc) composite index. Query <100ms.',
    75 ],
  [ 'high', 'grafana', 'incidents',
    'DB CPU 100% during peak hours',
    'One report query was doing a lateral join without an index. Optimized query in reporting-service, added missing (report_id, generated_at) index.',
    59 ],

  // API GATEWAY / 5XX
  [ 'medium', 'grafana', 'incidents',
    'API gateway 5xx rate 2.1% (threshold 1%)',
    'Elevated 502s for 6m. Upstream connection reset from checkout-service pods failing readiness after OOM. Bumped memory limit from 512Mi to 1Gi.',
    3 ],
  [ 'high', 'sentry', 'engineering',
    'RateLimitError from downstream Twilio API',
    'SMS queue backed up during promo. Added exponential backoff + jitter, moved lower-priority SMS to a separate lane with lower QPS.',
    182 ],
  [ 'critical', 'grafana', 'incidents',
    'API gateway certificate renewed with wrong SAN list',
    'Cert-manager renewed leaf cert but our issuer didn\'t include api-internal.helena in SAN. Internal service calls failed for 4m. Fixed issuer template, forced renewal.',
    237 ],
  [ 'high', 'slack', 'oncall',
    'DDoS attempt: 40k RPS from 8 IPs',
    'Layer 7 flood on /api/auth/login. Turned on Cloudflare Under Attack mode, added rate limit rule (100/min per IP). Attack subsided after 20m.',
    109 ],
  [ 'medium', 'grafana', 'incidents',
    'p99 latency alert on /api/search',
    'Elasticsearch shard went hot due to skewed key distribution. Manually rebalanced shards, changed routing to include a hash suffix.',
    52 ],

  // KAFKA
  [ 'high', 'grafana', 'incidents',
    'Kafka consumer lag > 500k on order-events',
    'Consumer had scaled down for cost during off-peak, didn\'t scale back up when promo hit. Scaled from 4 to 12 pods, lag drained in 18m.',
    145 ],
  [ 'medium', 'sentry', 'engineering',
    'CommitFailedException: consumer rebalance during batch',
    'Batch too large, processing exceeded max.poll.interval.ms. Reduced batch to 100 messages, bumped interval to 5m.',
    121 ],
  [ 'high', 'grafana', 'incidents',
    'Kafka partition leader election storm',
    'Broker 3 restarted due to disk pressure. Re-election rippled across all 12 partitions for 2m. Investigated: log retention was too long, disk full. Reduced retention.',
    88 ],
  [ 'low', 'slack', 'oncall',
    'Kafka client update: needed for TLS 1.3',
    'Bumped kafka-python from 2.0.2 to 2.1.5. Confluent Cloud requires TLS 1.3 from June 2026.',
    41 ],

  // CDN
  [ 'medium', 'grafana', 'incidents',
    'CDN cache invalidation stuck for 15m',
    'Cloudflare API returned 429 on purge. Retried with backoff, then bulk purge by hostname worked. Traced to a deploy that purged 12k URLs at once.',
    97 ],
  [ 'high', 'sentry', 'engineering',
    'Origin timeout: assets returned 502 for 3 minutes',
    'S3 endpoint had a regional blip. CDN failed over to secondary region after 3m. Reduced failover threshold from 3m to 30s.',
    173 ],
  [ 'low', 'slack', 'oncall',
    'Discussion: enabling Cloudflare early hints',
    'Discussed enabling early hints (103) for main pages. Estimated 200-400ms LCP improvement. Filed as ENG-4180.',
    22 ],

  // CRON
  [ 'high', 'grafana', 'incidents',
    'Nightly report cron skipped due to previous run still active',
    'Reports job took 4.2h instead of 90m due to data volume growth. Overlap with next run got skipped. Rewrote to chunk by day.',
    213 ],
  [ 'medium', 'slack', 'oncall',
    'DST bug: cron ran 1h early after fall-back',
    'Cron scheduled in America/New_York, our worker in UTC, timezone mapping off by an hour during DST transition. Migrated all schedules to UTC.',
    248 ],
  [ 'low', 'slack', 'oncall',
    'Cron timeout: monthly-billing overran window',
    'Growth in customer count pushed billing job past its 2h window. Increased to 4h, added progress reporting.',
    64 ],
  [ 'medium', 'grafana', 'incidents',
    'Weekly digest email not sent to 4k users',
    'Cron ran but SES threw quota exceeded halfway through. Requested quota bump, resumed from checkpoint.',
    18 ],

  // MISC RECENT
  [ 'medium', 'sentry', 'engineering',
    'ImagePull failure on checkout-service-v2.4.1',
    'Duplicate of earlier issue. Registry rate limit hit again during a mass deploy. Migrated to a mirrored registry.',
    3 ],
  [ 'low', 'grafana', 'incidents',
    'TestAlert',
    'Test alert during on-call handoff. No action needed.',
    3 ],
  [ 'low', 'slack', 'oncall',
    'DNS flapping on prod-lb-01 for 2 minutes',
    'Route53 health check flapped due to a monitoring endpoint change on our end. Reverted the endpoint, health checks stable.',
    3 ],
  [ 'critical', 'sentry', 'engineering',
    'PagerDuty integration dropped: Cannot POST to /webhook',
    'PagerDuty rotated integration URL, we had the old one hardcoded. Updated env, redeployed. During the outage, on-call watched Grafana + Slack directly.',
    3 ],
];

const RUNBOOKS = [
  { title: 'Redis primary failover playbook',
    content_md: `## When to use\nCPU on primary >90% for 5m, or replica lag >30s and climbing.\n\n## Steps\n1. Check slow log for a runaway KEYS/SCAN.\n2. If a specific tenant is causing it, block that tenant\'s workers.\n3. Promote replica: \`redis-cli -h replica REPLICAOF NO ONE\`.\n4. Point application connection string to new primary.\n5. Rebuild original as replica once traffic normalizes.\n\n## Post-mortem hooks\n- Was slow log enabled?\n- Was the workload change deployed in the last 24h?\n- Is monitoring alert threshold right?` },
  { title: 'Notification-worker OOM incident response',
    content_md: `Worker OOMs every 2-4 hours, especially under load.\n\n**Immediate mitigation:** Restart the worker deployment (kubectl rollout restart).\n\n**Root cause path:**\n- Check heap snapshot at time of crash\n- Look for growing Map/Set that isn\'t cleared on batch flush\n- Verify TTLs on in-memory caches\n\n**Long-term fix:** See PR #4310 for the health probe pattern that lets us catch this before OOM.` },
  { title: 'Stripe webhook signature rotation',
    content_md: `We accept both old and new signing secrets during rotation.\n\n\`\`\`\nSTRIPE_WEBHOOK_SECRETS=old_secret,new_secret\n\`\`\`\n\nStripe supports up to 3 active secrets per endpoint. Rotate every 90 days. Remove old secret only after all recent webhooks accepted new one.` },
  { title: 'Deployment rollback runbook',
    content_md: `## Fast rollback\n\`\`\`\nkubectl rollout undo deployment/<name>\n\`\`\`\n\n## If DB migration ran\n1. Check migration status: \`migrator status\`\n2. If forward-only migration, restore from PITR snapshot\n3. Else: run down migration for the specific version\n\n## Communicate\n- Post in #incidents within 60s\n- PagerDuty acknowledge\n- Status page update if user-visible >2m` },
  { title: 'Kafka consumer lag mitigation',
    content_md: `**Consumer lag climbing?**\n1. Check current pod count vs partition count\n2. Scale consumer pods up to min(partition_count, 2×partitions)\n3. Verify no rebalance loop (repeated leader-changed logs)\n4. If batch size too large: reduce, bump max.poll.interval.ms\n\nDo NOT scale beyond partition count — extras will idle.` },
  { title: 'Database migration safety checklist',
    content_md: `Before ANY prod migration:\n- [ ] Migration is idempotent (safe to re-run)\n- [ ] Adds columns as NULL first, backfill after\n- [ ] No blocking DDL during business hours\n- [ ] kill-conflicting-connections=true set\n- [ ] Rollback SQL exists and tested on staging\n- [ ] Announcement in #incidents 15m before` },
  { title: 'API gateway 5xx spike triage',
    content_md: `## First minute\n- Confirm real (not synthetic monitor blip): compare Grafana + Sentry\n- Identify which upstream is failing (checkout/auth/reports/etc)\n- Check for recent deploy to that service\n\n## Second minute\n- If deploy correlation: roll back\n- If not: check for OOMkill on the upstream pod\n- If pod healthy but slow: check DB connection pool` },
  { title: 'DDoS response playbook',
    content_md: `## Turn on\n1. Cloudflare "Under Attack" mode on affected zones\n2. Enable rate limit rule: 100 req/min per IP for /api/auth/*\n3. Block known bad ASN if pattern is clear\n\n## Communicate\n- Notify security channel\n- Do NOT publish "we\'re under DDoS" — invite copycats\n- Update status page as "elevated error rates"` },
  { title: 'SAML/SSO cert renewal',
    content_md: `Cert lives 12 months. Renewal steps:\n1. Generate new cert with same CN\n2. Upload to auth-service via helm values\n3. Rotate in IdP (Okta/Google) → we accept dual-cert period\n4. After 24h, remove old cert\n\nMonitoring alerts fire 30 days before expiry. Do NOT ignore.` },
  { title: 'Post-mortem template',
    content_md: `## Summary\nOne sentence, non-technical.\n\n## Impact\n- Duration:\n- Users affected:\n- Revenue impact:\n\n## Timeline\n(UTC)\n\n## Root cause\nThe real one, not the first thing we saw.\n\n## What went well\n\n## What could be improved\n\n## Action items\n- [ ] Owner · Due date` }
];

const sql = postgres(dbUrl, { ssl: 'require', prepare: false });

async function seed() {
  const { count: existing } = (await sql`select count(*) as count from incidents where workspace_id = ${workspaceId}`)[0];
  console.log(`Workspace ${workspaceId} currently has ${existing} incidents`);

  console.log(`Inserting ${INCIDENTS.length} incidents...`);
  const insertedIds = [];
  for (const [severity, source, channel, title, body, ago] of INCIDENTS) {
    const created = daysAgo(ago).toISOString();
    const dedup = `demo_${source}_${title.slice(0, 40).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
    const existing = await sql`
      select id from incidents where workspace_id = ${workspaceId} and dedup_key = ${dedup} limit 1
    `;
    if (existing.length > 0) continue;
    const [row] = await sql`
      insert into incidents (workspace_id, source, severity, title, body, channel, external_id, dedup_key, created_at, updated_at)
      values (${workspaceId}, ${source}, ${severity}, ${title}, ${body}, ${channel}, ${dedup}, ${dedup}, ${created}, ${created})
      returning id, title, body, severity, source, channel
    `;
    if (row) insertedIds.push(row);
  }
  console.log(`  → ${insertedIds.length} inserted (rest were dedup skips)`);

  console.log(`Inserting ${RUNBOOKS.length} runbooks...`);
  let rbInserted = 0;
  for (const rb of RUNBOOKS) {
    const dedup = `demo_rb_${rb.title.slice(0, 40).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
    const existingRb = await sql`
      select id from runbooks where workspace_id = ${workspaceId} and title = ${rb.title} limit 1
    `;
    if (existingRb.length > 0) continue;
    await sql`
      insert into runbooks (workspace_id, title, content_md, approved_by, approved_at, source_incident_ids)
      values (${workspaceId}, ${rb.title}, ${rb.content_md}, 'demo-seeder', now(), ${sql.array([])})
    `;
    rbInserted += 1;
  }
  console.log(`  → ${rbInserted} runbooks processed`);

  if (retainKey && insertedIds.length > 0) {
    console.log(`Mirroring ${insertedIds.length} incidents to RetainDB...`);
    let ok = 0;
    let fail = 0;
    for (const r of insertedIds) {
      const content =
        `[INC:${r.id}] ${r.title}\n` +
        `Severity: ${r.severity}. Source: ${r.source}.` +
        (r.channel ? ` Channel: #${r.channel}.` : '') +
        `\n${(r.body ?? '').slice(0, 2000)}`;
      try {
        const res = await fetch('https://api.retaindb.com/v1/memory', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${retainKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ project: workspaceId, content, memory_type: 'fact' })
        });
        if (res.ok) { ok += 1; process.stdout.write('.'); }
        else { fail += 1; process.stdout.write('x'); }
      } catch { fail += 1; process.stdout.write('!'); }
    }
    console.log(`\n  → RetainDB: ${ok} ok, ${fail} failed`);
  } else if (!retainKey) {
    console.log('RETAINDB_API_KEY not set, skipping RetainDB mirror');
  }

  await sql.end();
  console.log('Done.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
