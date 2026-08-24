/**
 * Minimal Redis-over-HTTP client for the counters behind /uqnautmfluxx.
 *
 * Deliberately dependency-free: the Upstash REST API is a POST with a JSON
 * array of command arguments, so a fetch is the whole client. It accepts either
 * the variable names Vercel's KV integration sets or Upstash's own, and reports
 * "not configured" rather than throwing when neither is present — the site has
 * to keep working with no store attached.
 */

const url =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const token =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const configured = Boolean(url && token);

type Command = (string | number)[];

/** Runs commands in one round trip. Returns a result per command, in order. */
export const pipeline = async (commands: Command[]): Promise<unknown[]> => {
  if (!configured || commands.length === 0) return [];
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands.map((c) => c.map(String))),
  });
  if (!response.ok) throw new Error(`store ${response.status}`);
  const payload = (await response.json()) as ({ result?: unknown; error?: string })[];
  return payload.map((entry) => {
    if (entry.error) throw new Error(entry.error);
    return entry.result;
  });
};

/** UTC day key, so buckets don't shift with whoever is looking. */
export const dayKey = (offsetDays = 0): string => {
  const date = new Date(Date.now() - offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
};

/** Events the beacon will record. Anything else is dropped. */
export const EVENTS = ["open", "place", "export", "save", "present", "text"] as const;
export type Event = (typeof EVENTS)[number];

/** A live session counts for a minute; the client pings every thirty seconds. */
export const LIVE_WINDOW_MS = 60_000;

/** Daily buckets are kept for six weeks, enough for the trend and no more. */
export const DAY_TTL_SECONDS = 42 * 86_400;
