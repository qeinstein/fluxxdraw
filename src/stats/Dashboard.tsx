import { useCallback, useEffect, useMemo, useState } from "react";
import { PROVIDERS, findService } from "../presets/catalog";

interface Stats {
  configured: boolean;
  message?: string;
  error?: string;
  generatedAt?: string;
  live?: number;
  totals?: Record<string, number>;
  events?: string[];
  days?: ({ date: string } & Record<string, number>)[];
  services?: { id: string; count: number }[];
}

/** The events the daily chart can show, in the order they matter. */
const SERIES = [
  { key: "open", label: "Visits" },
  { key: "place", label: "Services placed" },
  { key: "export", label: "Exports" },
  { key: "save", label: "Saves" },
  { key: "present", label: "Presentations" },
  { key: "text", label: "Text view" },
] as const;

const REFRESH_MS = 15_000;

/** Token comes from the fragment, which browsers don't put in a Referer. */
const token = () => new URLSearchParams(location.hash.slice(1)).get("k") ?? "";

export const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [series, setSeries] = useState<(typeof SERIES)[number]["key"]>("open");

  const load = useCallback(async () => {
    try {
      const key = token();
      const response = await fetch(`/api/stats${key ? `?k=${encodeURIComponent(key)}` : ""}`);
      if (!response.ok) {
        setFailed(
          response.status === 404
            ? "No stats endpoint here. Either it isn't deployed yet, or STATS_TOKEN is set and the #k= fragment is missing or wrong."
            : `The stats endpoint answered ${response.status}.`,
        );
        return;
      }
      setStats((await response.json()) as Stats);
      setFailed(null);
    } catch {
      setFailed("Couldn't reach the stats endpoint.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (failed) return <Shell><p className="note">{failed}</p></Shell>;
  if (!stats) return <Shell><p className="note">Loading…</p></Shell>;

  if (!stats.configured) {
    return (
      <Shell>
        <p className="note">{stats.message}</p>
        <ol className="steps">
          <li>Vercel dashboard → the project → <strong>Storage</strong> → add a Redis store (Upstash's free tier is enough).</li>
          <li>Connect it to this project, which sets <code>KV_REST_API_URL</code> and <code>KV_REST_API_TOKEN</code>.</li>
          <li>Redeploy. Counting starts from that deploy; this page fills in as people use the app.</li>
        </ol>
      </Shell>
    );
  }
  if (stats.error) {
    return <Shell><p className="note">The store is attached but refused the read: {stats.error}</p></Shell>;
  }

  const days = stats.days ?? [];
  const totals = stats.totals ?? {};
  const today = days[days.length - 1] ?? {};
  const windowTotal = days.reduce((sum, day) => sum + (day[series] ?? 0), 0);
  const activeSeries = SERIES.find((s) => s.key === series)!;

  return (
    <Shell generatedAt={stats.generatedAt}>
      <div className="tiles">
        <Tile label="Sessions open now" value={stats.live ?? 0} hint="active in the last minute" live />
        <Tile label="Visits today" value={today.open ?? 0} hint="UTC day" />
        <Tile label="Visits, 14 days" value={days.reduce((s, d) => s + (d.open ?? 0), 0)} />
        <Tile label="Services placed" value={totals.place ?? 0} hint="all time" />
      </div>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>{activeSeries.label} per day</h2>
            <p className="sub">Last {days.length} days, UTC · {windowTotal.toLocaleString()} total</p>
          </div>
          <div className="segmented" role="group" aria-label="Which event to chart">
            {SERIES.map((option) => (
              <button
                key={option.key}
                className={option.key === series ? "active" : ""}
                onClick={() => setSeries(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>
        <DailyChart days={days} field={series} label={activeSeries.label} />
        <details className="table-view">
          <summary>Show the numbers</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                {SERIES.map((s) => (
                  <th scope="col" key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.date}</th>
                  {SERIES.map((s) => (
                    <td key={s.key}>{day[s.key] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>Most-placed services</h2>
            <p className="sub">All time, across every provider</p>
          </div>
        </header>
        <ServiceBars services={stats.services ?? []} />
      </section>

      <p className="footnote">
        Counters only: an event name, sometimes a service id, and a random per-tab token so
        concurrent sessions can be counted. No identifiers, no cookies, and nothing about
        anyone's drawings — those never leave the machine. Clients that ask not to be counted
        aren't, and ad blockers will stop some of the rest, so read these as a floor.
      </p>
    </Shell>
  );
};

const Shell = ({
  children,
  generatedAt,
}: {
  children: React.ReactNode;
  generatedAt?: string;
}) => (
  <main className="page">
    <header className="page-head">
      <h1>FluxxDraw usage</h1>
      {generatedAt && (
        <span className="sub">
          refreshed {new Date(generatedAt).toLocaleTimeString()} · every {REFRESH_MS / 1000}s
        </span>
      )}
    </header>
    {children}
  </main>
);

const Tile = ({
  label,
  value,
  hint,
  live,
}: {
  label: string;
  value: number;
  hint?: string;
  live?: boolean;
}) => (
  <div className="tile">
    <span className="tile-label">
      {live && <span className="pulse" aria-hidden="true" />}
      {label}
    </span>
    <strong className="tile-value">{value.toLocaleString()}</strong>
    {hint && <span className="tile-hint">{hint}</span>}
  </div>
);

const CHART_HEIGHT = 168;
const BAR_RADIUS = 4;
const BAR_GAP = 2;

/**
 * Bars rather than a line: these are counts for discrete days, and a bar says
 * "this day, this many" without implying a value between midnights.
 *
 * One series, so no legend — the heading names it. Only the tallest day carries
 * a printed value; the rest are on hover, which keeps the plot readable.
 */
const DailyChart = ({
  days,
  field,
  label,
}: {
  days: ({ date: string } & Record<string, number>)[];
  field: string;
  label: string;
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const values = days.map((day) => day[field] ?? 0);
  const peak = Math.max(...values, 1);
  const peakIndex = values.indexOf(Math.max(...values));
  const empty = values.every((v) => v === 0);

  const width = 100; // viewBox units; the SVG scales to its box
  const slot = width / Math.max(days.length, 1);
  const barWidth = Math.max(slot - BAR_GAP, 1);

  // just enough headroom for a direct label over the tallest bar
  const top = peak * 1.18;
  const ticks = useMemo(() => {
    const half = Math.max(1, Math.round(peak / 2));
    return [...new Set([0, half, peak])];
  }, [peak]);

  if (empty) {
    return (
      <p className="note empty">
        Nothing counted yet for {label.toLowerCase()}. The chart fills in as the app is used.
      </p>
    );
  }

  return (
    <div className="chart">
      <div className="chart-scale" aria-hidden="true">
        {[...ticks].reverse().map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
            {tick.toLocaleString()}
          </span>
        ))}
      </div>
      <div className="chart-plot">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="chart-svg"
        role="img"
        aria-label={`${label} per day for the last ${days.length} days`}
      >
        {/* recessive gridlines, drawn behind everything */}
        {ticks.map((tick) => {
          const y = CHART_HEIGHT - (tick / top) * CHART_HEIGHT;
          return (
            <line
              key={tick}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              className="grid"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {days.map((day, i) => {
          const value = values[i];
          const height = (value / top) * CHART_HEIGHT;
          const x = i * slot + BAR_GAP / 2;
          const y = CHART_HEIGHT - height;
          return (
            <g key={day.date}>
              <path
                d={barPath(x, y, barWidth, height, BAR_RADIUS)}
                className={`bar ${hover === i ? "bar-hover" : ""}`}
              />
              {/* a hit target taller and wider than the mark */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={CHART_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((current) => (current === i ? null : current))}
              />
            </g>
          );
        })}
      </svg>

        {/*
          * The peak's value in HTML rather than SVG text: the viewBox is
          * stretched horizontally to fill the card, which smears anything drawn
          * inside it. Only the peak is labelled — the rest are on hover.
          */}
        {hover !== peakIndex && values[peakIndex] > 0 && (
          <span
            className="bar-label"
            style={{
              left: `${((peakIndex + 0.5) / days.length) * 100}%`,
              bottom: `${(values[peakIndex] / top) * CHART_HEIGHT + 5}px`,
            }}
          >
            {values[peakIndex].toLocaleString()}
          </span>
        )}

        {hover !== null && (
          <div className="tip" style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}>
            <strong>{values[hover].toLocaleString()}</strong> {label.toLowerCase()}
            <span className="tip-date">{days[hover].date}</span>
          </div>
        )}

      </div>

      {/* outside the plot box, so overlays measure from the baseline not the labels */}
      <div className="chart-axis">
        {days.map((day, i) => (
          <span key={day.date} className={i === peakIndex || i === days.length - 1 ? "" : "faint"}>
            {day.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Rounded at the data end only; the baseline end stays square. */
const barPath = (x: number, y: number, w: number, h: number, r: number) => {
  if (h <= 0) return "";
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    "Z",
  ].join(" ");
};

const ServiceBars = ({ services }: { services: { id: string; count: number }[] }) => {
  if (services.length === 0) {
    return <p className="note empty">No services placed yet.</p>;
  }
  const peak = Math.max(...services.map((s) => s.count), 1);

  return (
    <ul className="bars">
      {services.map((service) => {
        const preset = findService(service.id);
        const provider = preset ? PROVIDERS[preset.provider].name : service.id.split(":")[0];
        return (
          <li key={service.id}>
            <span className="bars-label">
              {preset?.name ?? service.id}
              <span className="bars-meta">{provider}</span>
            </span>
            <span className="bars-track">
              <span className="bars-fill" style={{ width: `${(service.count / peak) * 100}%` }} />
            </span>
            <span className="bars-value">{service.count.toLocaleString()}</span>
          </li>
        );
      })}
    </ul>
  );
};
