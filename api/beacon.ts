import {
  DAY_TTL_SECONDS,
  EVENTS,
  LIVE_WINDOW_MS,
  configured,
  dayKey,
  pipeline,
  type Event,
} from "./_store";

export const config = { runtime: "edge" };

/**
 * Counts an action, or just refreshes a session's liveness.
 *
 * What is stored: an integer per event per UTC day, an integer per service id,
 * and an opaque random session token with a timestamp so concurrent sessions
 * can be counted. What is not stored: IP addresses, user agents, referrers,
 * anything identifying, and above all nothing about the drawings themselves —
 * those never leave the machine.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  // nothing to write to: succeed quietly rather than noise up the client
  if (!configured) return new Response(null, { status: 204 });

  let body: { e?: string; s?: string; sid?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(null, { status: 400 });
  }

  const sid = typeof body.sid === "string" ? body.sid.slice(0, 40) : "";
  const event = EVENTS.includes(body.e as Event) ? (body.e as Event) : null;
  if (!sid) return new Response(null, { status: 400 });

  const now = Date.now();
  const commands: (string | number)[][] = [];

  /*
   * One rate limit per session, so a stuck client or a curious visitor with a
   * terminal can't run the counters away. Keyed on the random token the client
   * generated, which means no need to keep anything about who sent it.
   */
  commands.push(["INCR", `rl:${sid}`], ["EXPIRE", `rl:${sid}`, 60]);

  // liveness for the concurrent-sessions figure
  commands.push(
    ["ZADD", "live", now, sid],
    ["ZREMRANGEBYSCORE", "live", 0, now - LIVE_WINDOW_MS * 5],
    ["EXPIRE", "live", 600],
  );

  if (event) {
    const day = dayKey();
    commands.push(
      ["HINCRBY", `d:${day}`, event, 1],
      ["EXPIRE", `d:${day}`, DAY_TTL_SECONDS],
      ["HINCRBY", "total", event, 1],
    );
    // which services people actually reach for is the whole point of this
    if (event === "place" && typeof body.s === "string" && /^[a-z0-9:-]{1,40}$/.test(body.s)) {
      commands.push(["ZINCRBY", "svc", 1, body.s]);
    }
  }

  try {
    const results = await pipeline(commands);
    const hits = Number(results[0] ?? 0);
    if (hits > 120) return new Response(null, { status: 429 });
  } catch {
    // a counter is never worth failing a user's action over
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
}
