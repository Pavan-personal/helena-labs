/**
 * Seeds realistic demo incidents + a few approved runbooks in the FIRST
 * workspace. Run: pnpm seed
 *
 * Idempotent: skips inserts if we already have 15+ incidents in that workspace.
 */
import postgres from 'postgres';

const DEMO_INCIDENTS = [
  {
    source: 'grafana',
    severity: 'high',
    title: 'Redis primary CPU at 94%, replica lag >30s',
    body:
      'Alert fired at 14:32 UTC on redis-primary-01. CPU pegged, replica lag climbing steadily. Investigating slow log — likely a scan against session:* key space.\n\nTom promoted the replica manually. Original primary rebuilt as replica. Session cache misses spiked briefly during failover but recovered within 90s.',
    channel: 'incidents',
    external_id: 'grafana_alert_redis_cpu_20260415_1432'
  },
  {
    source: 'sentry',
    severity: 'critical',
    title: 'TypeError: Cannot read property total of undefined in checkout',
    body:
      'Regression on the checkout flow. Payload from Stripe webhook has null customer object when guest checkout. Missing null check at api/checkout/finalize.ts:42.\n\nFixed in PR #4218 by adding optional chaining. Deployed 15:47 UTC.',
    channel: 'engineering',
    external_id: 'sentry_issue_5423'
  },
  {
    source: 'slack',
    severity: 'high',
    title: 'Payment webhook timeouts, Stripe retrying',
    body:
      'Multiple reports of pending orders. Stripe dashboard shows webhook responses at 15-20s (should be <2s). Traced to synchronous DB migration running during peak. Killed the migration, drained the queue, backfilled 47 pending charges manually.',
    channel: 'incidents'
  },
  {
    source: 'github',
    severity: 'medium',
    title: 'PR #4218 merged: add coupon null-check fallback',
    body:
      'Repo: acme/checkout-service\nAuthor: tom\nFiles changed: 3\nFixes the TypeError on checkout when coupon lookup returns null.\n\nAdded fallback that treats missing coupon as no-discount instead of throwing.',
    channel: 'acme/checkout-service',
    external_id: 'acme/checkout-service#4218'
  },
  {
    source: 'grafana',
    severity: 'medium',
    title: 'Kafka consumer lag on orders topic, 8min behind',
    body:
      'Consumer group orders-processor falling behind. Restarted the 3 consumers, lag dropped from 8min to <30s in 4 minutes. Root cause: one worker OOM-killed and not restarted by supervisor.',
    channel: 'incidents'
  },
  {
    source: 'grafana',
    severity: 'high',
    title: 'p99 latency spike on /api/search — 3.2s',
    body:
      'Elasticsearch cluster showing high queue depth. Turned out to be a runaway aggregation from an admin dashboard. Added query rate limiter. p99 back to 340ms within 5 minutes.',
    channel: 'incidents'
  },
  {
    source: 'sentry',
    severity: 'medium',
    title: 'RequestTimeoutError on /api/notifications/preferences',
    body:
      'Timeouts against notifications DB. Root cause: index on user_prefs.updated_at got dropped during a manual migration last week and nobody noticed. Rebuilt the index. Queries back to <50ms.',
    channel: 'engineering',
    external_id: 'sentry_issue_5501'
  },
  {
    source: 'slack',
    severity: 'low',
    title: 'DNS flapping on prod-lb-01 for 2 minutes',
    body:
      'Route 53 health check returned intermittent failures 03:12-03:14 UTC. No actual user impact — traffic shifted to prod-lb-02 automatically. Investigating why the check flapped; possibly a bad NAT gateway.',
    channel: 'incidents'
  },
  {
    source: 'grafana',
    severity: 'critical',
    title: 'Database connection pool exhausted on writes-primary',
    body:
      'Pool at 500/500. Long-running analytics query holding connections. Killed the offending session, added connection timeout. Set alerts for pool > 80%.',
    channel: 'incidents'
  },
  {
    source: 'github',
    severity: 'low',
    title: 'PR #4275 merged: bump kafka client to 3.5.1',
    body:
      'Repo: acme/orders-processor\nAuthor: sarah\nFiles changed: 2\nSecurity patch for CVE-2024-XXXX. No behavior changes.',
    channel: 'acme/orders-processor',
    external_id: 'acme/orders-processor#4275'
  },
  {
    source: 'sentry',
    severity: 'high',
    title: 'ImagePull failure on checkout-service-v2.4.1',
    body:
      'ECR credentials rotated last night but the k8s pull secret was not updated. Fixed by refreshing the imagePullSecret. Deployment rolled forward.',
    channel: 'engineering'
  },
  {
    source: 'grafana',
    severity: 'medium',
    title: 'API gateway 5xx rate 2.1% (threshold 1%)',
    body:
      'Alert on api-gateway. Cause traced to a bad deploy of auth-service that returned 500 on missing header instead of 401. Rolled back. Followed up with PR to fix the header path.',
    channel: 'incidents'
  },
  {
    source: 'slack',
    severity: 'medium',
    title: 'Slow query in reporting dashboard blocking writes',
    body:
      'CustomerReport query holding locks on transactions table. Killed the session. Long-term: moved reporting to read replica.',
    channel: 'incidents'
  },
  {
    source: 'sentry',
    severity: 'critical',
    title: 'PagerDuty integration dropped: Cannot POST to /webhook',
    body:
      'PagerDuty webhook endpoint TLS cert expired without renewal. Cert renewed via ACME. Added a monitoring rule for cert expiry <14 days.',
    channel: 'engineering'
  },
  {
    source: 'grafana',
    severity: 'high',
    title: 'Memory leak on notification-worker, OOM at 3h',
    body:
      'Worker OOM every ~3 hours. Traced to a growing Map<userId, PendingBatch> that was never pruned when batches flushed. Added TTL. Deployed. Worker stable for 24h+ afterward.',
    channel: 'incidents'
  }
];

const DEMO_RUNBOOKS = [
  {
    title: 'Redis primary failover',
    content_md:
      '# Redis primary failover\n\n## Symptom\n- Alert: `redis-primary-cpu > 90%` or `replica-lag > 30s`\n- API 5xx spike on session-cache-backed endpoints\n\n## Detection\n1. Check Grafana panel `Redis primary CPU`.\n2. Check replica lag on all replicas.\n\n## Diagnosis steps\n1. `redis-cli -h <primary> --slowlog get 10` — look for SCAN or KEYS commands\n2. Check application logs for session cache misses\n3. Verify replicas are healthy: `redis-cli -h <replica> INFO replication`\n\n## Resolution\n1. Promote a healthy replica: `redis-cli -h <replica> REPLICAOF NO ONE`\n2. Update DNS/route to point at new primary\n3. Rebuild old primary as replica: `redis-cli -h <old> REPLICAOF <new> 6379`\n4. Monitor session cache miss rate for 15 min\n\n## Prevention\n- Add SCAN command rate limiter in application\n- Set replica lag alert threshold to 10s so we catch it earlier\n\n## References\n- Previous incident on 2026-04-15 (Tom promoted replica manually)'
  },
  {
    title: 'Payment webhook timeout under migration load',
    content_md:
      '# Payment webhook timeout under migration load\n\n## Symptom\n- Stripe webhook response times exceed 5s\n- Multiple pending orders reported in support\n\n## Detection\n1. Stripe dashboard → webhook logs → response times\n2. Grafana panel `webhook-response-time` p99\n\n## Diagnosis steps\n1. Check if a DB migration is running: `select * from migrations where finished_at is null`\n2. Check DB connection pool utilization\n3. Query slow log\n\n## Resolution\n1. Kill offending migration if safe\n2. Drain webhook queue\n3. Backfill pending charges manually via `scripts/backfill-charges.mjs`\n4. Requeue any failed webhooks in Stripe dashboard\n\n## Prevention\n- Move migrations to off-peak windows\n- Use online-schema-change tool (pt-osc) for large tables\n- Set explicit migration timeouts'
  },
  {
    title: 'Database connection pool exhaustion',
    content_md:
      '# Database connection pool exhaustion\n\n## Symptom\n- 5xx on write endpoints\n- Grafana `db-pool-used / db-pool-max` above 0.95\n\n## Detection\n1. Grafana panel `writes-primary connections`\n2. Application logs: `SQLSTATE 53300` (too_many_connections)\n\n## Diagnosis steps\n1. `select * from pg_stat_activity where state != \'idle\' order by query_start`\n2. Look for long-running queries (>5min) from analytics or reporting sources\n\n## Resolution\n1. Kill offending sessions: `select pg_terminate_backend(pid)`\n2. Verify pool has recovered\n3. Add row lock timeout to prevent recurrence\n\n## Prevention\n- Move analytics to read replica\n- Enforce `statement_timeout` on the reporting user\n- Alert on pool > 80% (not just when exhausted)'
  }
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require', prepare: false, max: 1 });

  const workspaces =
    await sql`select id, chat_platform, discord_guild_name, slack_team_name from workspaces order by created_at asc limit 1`;
  if (workspaces.length === 0) {
    console.error('No workspace exists yet. Install helena first.');
    process.exit(1);
  }
  const workspaceId = workspaces[0].id;
  console.log(
    `Seeding into workspace ${workspaces[0].discord_guild_name ?? workspaces[0].slack_team_name} (${workspaceId})`
  );

  const [{ count }] =
    await sql`select count(*)::int from incidents where workspace_id = ${workspaceId}`;
  if (count >= DEMO_INCIDENTS.length) {
    console.log(`Workspace already has ${count} incidents. Skipping seed.`);
    await sql.end();
    return;
  }

  console.log(`Inserting ${DEMO_INCIDENTS.length} incidents...`);
  let inserted = 0;
  for (let i = 0; i < DEMO_INCIDENTS.length; i++) {
    const inc = DEMO_INCIDENTS[i];
    // Space them out so recent-list looks right
    const created = new Date(Date.now() - (DEMO_INCIDENTS.length - i) * 3600_000).toISOString();
    await sql`
      insert into incidents (workspace_id, source, severity, external_id, channel, title, body, created_at, updated_at)
      values (${workspaceId}, ${inc.source}, ${inc.severity}, ${inc.external_id ?? null}, ${inc.channel ?? null}, ${inc.title}, ${inc.body}, ${created}, ${created})
    `;
    inserted += 1;
  }
  console.log(`  ${inserted} incidents inserted.`);

  console.log(`Inserting ${DEMO_RUNBOOKS.length} approved runbooks...`);
  let rInserted = 0;
  for (const rb of DEMO_RUNBOOKS) {
    // link to first N incidents
    const linkedIncs =
      await sql`select id from incidents where workspace_id = ${workspaceId} order by created_at desc limit 2`;
    const incIds = linkedIncs.map((r) => r.id);
    await sql`
      insert into runbooks (workspace_id, title, content_md, source_incident_ids, approved_by, approved_at)
      values (${workspaceId}, ${rb.title}, ${rb.content_md}, ${incIds}::uuid[], 'reviewer', now())
    `;
    rInserted += 1;
  }
  console.log(`  ${rInserted} runbooks inserted.`);

  await sql.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
