import { useEffect, useMemo, useState } from "react";
import type { DayLog } from "../lib/db";
import { getLog, putLog } from "../lib/db";
import { shortDate, todayKey } from "../lib/dates";

type Unit = "kg" | "lb";

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

  async function save() {
    const num = parseFloat(value);
    if (!isFinite(num) || num <= 0) return;
    const existing = (await getLog(today)) ?? { date: today, done: {} };
    await putLog({ ...existing, weight: num });
    toast("Weight logged");
    reload();
  }

  const latest = series.length ? series[series.length - 1].weight : null;
  const first = series.length ? series[0].weight : null;
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

      {series.length >= 2 && (
        <div className="stat-row">
          <div className="stat">
            <b>{latest}</b>
            <span>current ({unit})</span>
          </div>
          <div className="stat">
            <b style={{ color: delta != null && delta < 0 ? "var(--good)" : delta != null && delta > 0 ? "var(--warn)" : undefined }}>
              {delta != null ? (delta > 0 ? "+" : "") + delta.toFixed(1) : "—"}
            </b>
            <span>net change</span>
          </div>
          <div className="stat">
            <b>{series.length}</b>
            <span>entries</span>
          </div>
        </div>
      )}

      <h2>Trend</h2>
      {series.length < 2 ? (
        <div className="empty">Log at least two days to see your trend line.</div>
      ) : (
        <div className="card">
          <Chart data={series} unit={unit} />
        </div>
      )}
    </div>
  );
}

function Chart({
  data,
  unit,
}: {
  data: { date: string; weight: number }[];
  unit: string;
}) {
  const W = 320;
  const H = 180;
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
  min -= range * 0.1;
  max += range * 0.1;

  const x = (i: number) =>
    padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = (w: number) =>
    padT + (1 - (w - min) / (max - min)) * (H - padT - padB);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.weight).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} ` +
    data.map((d, i) => `L ${x(i).toFixed(1)} ${y(d.weight).toFixed(1)}`).join(" ") +
    ` L ${x(data.length - 1).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  const yTicks = [max, (max + min) / 2, min];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.28" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line className="grid-line" x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
          <text className="axis-text" x={4} y={y(t) + 3}>
            {t.toFixed(0)}
          </text>
        </g>
      ))}

      <path className="area" d={areaPath} />
      <path className="line" d={linePath} />

      {data.map((d, i) =>
        // avoid clutter: show a dot only for the last point on long series
        data.length <= 40 || i === data.length - 1 ? (
          <circle key={i} className="dot" cx={x(i)} cy={y(d.weight)} r={data.length <= 40 ? 2.5 : 3.5} />
        ) : null
      )}

      <text className="axis-text" x={padL} y={H - 6}>
        {shortDate(data[0].date)}
      </text>
      <text className="axis-text" x={W - padR} y={H - 6} textAnchor="end">
        {shortDate(data[data.length - 1].date)}
      </text>
      <text className="axis-text" x={W - padR} y={padT} textAnchor="end">
        {unit}
      </text>
    </svg>
  );
}
