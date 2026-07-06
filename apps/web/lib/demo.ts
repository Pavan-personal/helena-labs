/**
 * The dedicated demo tenant id. Used to:
 *   1. Direct anonymous visitors into a pre-seeded workspace
 *   2. Block them from wiring real integrations (Grafana, Sentry, GitHub,
 *      etc.) — those actions require a real Slack/Discord install so we
 *      don't let a random visitor connect their tokens to a shared demo.
 */
export const DEMO_WORKSPACE_ID = 'de11de11-de11-4de1-8de1-de11de11de11';

export function isDemoWorkspace(id: string | null | undefined): boolean {
  return id === DEMO_WORKSPACE_ID;
}
