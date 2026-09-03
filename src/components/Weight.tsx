import { useEffect, useMemo, useState } from "react";
import type { DayLog } from "../lib/db";
import { getLog, putLog } from "../lib/db";
import { addDays, fromDayKey, shortDate, toDayKey, todayKey } from "../lib/dates";

type Unit = "kg" | "lb";
type Point = { date: string; weight: number; smooth: number };

// Range presets (days). 0 = all.
const RANGES: { label: string; days: number }[] = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "All", days: 0 },
];

/** Centered moving average — the smoothed trend line without the daily noise. */
function movingAverage(vals: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return vals.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < vals.length) {
        sum += vals[j];
        n++;
      }
    }
    return sum / n;
  });
}

function smoothWindowFor(days: number): number {
  if (days === 7) return 3;
  if (days === 30) return 7;
  if (days === 90) return 9;
  return 11; // All
}

export default function Weight({
  logs,
  reload,
  toast,
}: {
  logs: DayLog[];
  reload: () => void;
  toast: (m: string) => void;
}) {
  const [unit, setUnit] = useState<Unit>(
    () => (localStorage.getItem("weightUnit") as Unit) || "lb"
  );
  const [value, setValue] = useState("");
  const [rangeDays, setRangeDays] = useState(90);

  const today = todayKey();
  const todaysLog = logs.find((l) => l.date === today);

  useEffect(() => {
    setValue(todaysLog?.weight != null ? String(todaysLog.weight) : "");
  }, [todaysLog?.weight]);

  useEffect(() => {
    localStorage.setItem("weightUnit", unit);
  }, [unit]);

  const series = useMemo(
    () =>
      logs
        .filter((l) => typeof l.weight === "number")
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((l) => ({ date: l.date, weight: l.weight as number })),
    [logs]
  );

  // Smooth over the full history so the visible window has proper context at
  // its left edge, then slice to the chosen range.
  const points: Point[] = useMemo(() => {
    const smooth = movingAverage(
      series.map((s) => s.weight),
      smoothWindowFor(rangeDays)
    );
    return series.map((s, i) => ({ ...s, smooth: smooth[i] }));
  }, [series, rangeDays]);

  const visible: Point[] = useMemo(() => {
    if (rangeDays === 0 || points.length === 0) return points;
    const anchor = fromDayKey(points[points.length - 1].date);
    const cutoff = toDayKey(addDays(anchor, -(rangeDays - 1)));
    return points.filter((p) => p.date >= cutoff);
  }, [points, rangeDays]);

  async function save() {
    const num = parseFloat(value);
    if (!isFinite(num) || num <= 0) return;
    const existing = (await getLog(today)) ?? { date: today, done: {} };
    await putLog({ ...existing, weight: num });
    toast("Weight logged");
    reload();
  }

  // Stats reflect the visible window so each zoom level tells its own story.
  const latest = visible.length ? visible[visible.length - 1].weight : null;
  const first = visible.length ? visible[0].weight : null;
  const delta = latest != null && first != null ? latest - first : null;

  return (
    <div className="screen">
      <h1>Weight</h1>
      <p className="sub">Log it once a day. Watch the trend, not the day-to-day noise.</p>

      <div className="card">
        <div className="row" style={{ gap: 10 }}>
          <div className="grow">
            <input
              type="number"
              inputMode="decimal"
              placeholder={`Today's weight (${unit})`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <button
            className="pill"
            onClick={() => setUnit((u) => (u === "kg" ? "lb" : "kg"))}
            title="Toggle unit"
            style={{ cursor: "pointer" }}
          >
            {unit}
          </button>
          <button className="btn primary" onClick={save} disabled={!value}>
            Save
          </button>
        </div>
        {todaysLog?.weight != null && (
          <p className="hint">Today logged at {todaysLog.weight} {unit}. Saving overwrites it.</p>
        )}
      </div>

      {visible.length >= 2 && (
        <div className="stat-row">
          <div className="stat">
            <b>{latest}</b>
            <span>current ({unit})</span>
          </div>
          <div className="stat">
            <b style={{ color: delta != null && delta < 0 ? "#7ee787" : delta != null && delta > 0 ? "#ffd479" : undefined }}>
              {delta != null ? (delta > 0 ? "+" : "") + delta.toFixed(1) : "—"}
            </b>
            <span>change</span>
          </div>
          <div className="stat">
            <b>{visible.length}</b>
            <span>days shown</span>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginTop: 26, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Trend</h2>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.days}
              className={`seg-btn${rangeDays === r.days ? " active" : ""}`}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {series.length < 2 ? (
        <div className="empty">Log at least two days to see your trend line.</div>
      ) : visible.length < 2 ? (
        <div className="empty">Not enough data in this range — try a wider one.</div>
      ) : (
        <div className="card">
          <Chart data={visible} unit={unit} />
          <div className="chart-legend">
            <span><i className="sw-raw" /> Daily</span>
            <span><i className="sw-trend" /> Trend</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Chart({ data, unit }: { data: Point[]; unit: string }) {
  const W = 320;
  const H = 190;
  const padL = 34;
  const padR = 8;
  const padT = 12;
  const padB = 22;

  const weights = data.map((d) => d.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  min -= range * 0.12;
  max += range * 0.12;

  const n = data.length;
  const x = (i: number) => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (w: number) => padT + (1 - (w - min) / (max - min)) * (H - padT - padB);

  const rawPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.weight).toFixed(1)}`)
    .join(" ");
  const smoothPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.smooth).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} ` +
    data.map((d, i) => `L ${x(i).toFixed(1)} ${y(d.smooth).toFixed(1)}`).join(" ") +
    ` L ${x(n - 1).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  const yTicks = [max, (max + min) / 2, min];
  const yDecimals = max - min < 6 ? 1 : 0;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line className="grid-line" x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
          <text className="axis-text" x={4} y={y(t) + 3}>
            {t.toFixed(yDecimals)}
          </text>
        </g>
      ))}

      <path className="area" d={areaPath} />
      <path className="line-raw" d={rawPath} />
      <path className="line" d={smoothPath} />

      {/* dot on the latest actual reading */}
      <circle className="dot" cx={x(n - 1)} cy={y(data[n - 1].weight)} r={3.2} />

      <text className="axis-text" x={padL} y={H - 6}>
        {shortDate(data[0].date)}
      </text>
      <text className="axis-text" x={W - padR} y={H - 6} textAnchor="end">
        {shortDate(data[n - 1].date)}
      </text>
      <text className="axis-text" x={W - padR} y={padT} textAnchor="end">
        {unit}
      </text>
    </svg>
  );
}
