/**
 * Counts a handful of actions, so the roadmap can be driven by what people
 * actually reach for rather than by guesswork.
 *
 * What leaves the browser: an event name, sometimes a service id like
 * "aws:s3", and a random token that exists only in this tab's memory so
 * concurrent sessions can be counted. Nothing else — no identifiers, no
 * storage, and never any part of a drawing. Drawings stay on the machine;
 * that is the whole point of the app and a usage chart doesn't outrank it.
 *
 * Every failure is silent and permanent: if the endpoint isn't there, the app
 * stops trying rather than retrying into a void.
 */

export type AnalyticsEvent = "open" | "place" | "export" | "save" | "present" | "text";

const HEARTBEAT_MS = 30_000;

/** In memory only — a refresh is a new session, and nothing is left behind. */
const session = Math.random().toString(36).slice(2, 14);

const optedOut =
  typeof navigator !== "undefined" &&
  (navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/*
 * Local development is not traffic. Skipping it keeps a morning of hacking out
 * of the real figures, and there's no function to answer on a dev server
 * anyway — every send would just be a 404 in the console.
 */
const local =
  typeof location !== "undefined" &&
  (["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname) ||
    location.hostname.endsWith(".local"));

let enabled = !optedOut && !local && typeof fetch !== "undefined";

const send = (payload: Record<string, string>) => {
  if (!enabled) return;
  const body = JSON.stringify({ ...payload, sid: session });
  // keepalive so a beacon sent on the way out still lands
  fetch("/api/beacon", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  })
    .then((response) => {
      // 404 means no function deployed; 429 means we're being too chatty
      if (response.status === 404 || response.status === 429) enabled = false;
    })
    .catch(() => {
      enabled = false;
    });
};

export const track = (event: AnalyticsEvent, subject?: string) => {
  send(subject ? { e: event, s: subject } : { e: event });
};

/**
 * Starts the session: one "open", then a quiet ping while the tab is in front,
 * which is what makes a concurrent-sessions figure possible without a socket.
 */
export const startAnalytics = () => {
  if (!enabled) return;
  track("open");

  let timer: number | undefined;
  const beat = () => {
    if (document.visibilityState === "visible") send({});
  };
  const start = () => {
    window.clearInterval(timer);
    timer = window.setInterval(beat, HEARTBEAT_MS);
  };

  start();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beat();
  });
};
