import { useEffect, useMemo, useRef, useState } from "react";
import type { DayLog } from "../lib/db";
import { getLog, putLog } from "../lib/db";
import { fromDayKey, prettyDate, shortDate, todayKey } from "../lib/dates";

type Unit = "kg" | "lb";
type Point = { date: string; weight: number; smooth: number; day: number };
type View = { start: number; end: number }; // in day-numbers

// Chart viewBox geometry, shared by the renderer and the gesture math.
const VBW = 320;
const VBH = 190;
const PADL = 34;
const PADR = 8;
const PADT = 12;
const PADB = 22;
const MIN_SPAN = 3; // days — closest zoom

const MS_PER_DAY = 86_400_000;
const dayNumber = (key: string) => Math.round(fromDayKey(key).getTime() / MS_PER_DAY);

const RANGES: { label: string; days: number }[] = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "All", days: 0 },
];

/** Centered moving average — the smoothed trend without the daily noise. */
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

// Smoothing widens as you zoom out so the trend stays readable at any scale.
function smoothWindowFor(span: number): number {
  const w = Math.round(span / 12);
  return Math.max(3, Math.min(13, w % 2 === 0 ? w + 1 : w));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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

  const domainStart = series.length ? dayNumber(series[0].date) : 0;
  const domainEnd = series.length ? dayNumber(series[series.length - 1].date) : 0;
  const totalSpan = Math.max(1, domainEnd - domainStart);

  // Continuous view window (in day-numbers). Source of truth is the ref; state
  // mirrors it for rendering.
  const [view, setViewState] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const setView = (v: View) => {
    viewRef.current = v;
    setViewState(v);
  };

  // Initialise / re-clamp the view when the data domain changes.
  useEffect(() => {
    if (series.length < 2) {
      setView({ start: domainStart, end: domainEnd });
      return;
    }
    const cur = viewRef.current;
    if (!cur) {
      const span = Math.min(totalSpan, 89); // default ~3 months
      setView({ start: domainEnd - span, end: domainEnd });
    } else {
      const span = clamp(cur.end - cur.start, MIN_SPAN, totalSpan);
      const start = clamp(cur.start, domainStart, domainEnd - span);
      setView({ start, end: start + span });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainStart, domainEnd, series.length]);

  const span = view ? view.end - view.start : totalSpan;

  const points: Point[] = useMemo(() => {
    const smooth = movingAverage(series.map((s) => s.weight), smoothWindowFor(span));
    return series.map((s, i) => ({
      ...s,
      smooth: smooth[i],
      day: dayNumber(s.date),
    }));
  }, [series, span]);

  const visible = useMemo(
    () => (view ? points.filter((p) => p.day >= view.start - 0.5 && p.day <= view.end + 0.5) : points),
    [points, view]
  );

  async function save() {
    const num = parseFloat(value);
    if (!isFinite(num) || num <= 0) return;
    const existing = (await getLog(today)) ?? { date: today, done: {} };
    await putLog({ ...existing, weight: num });
    toast("Weight logged");
    reload();
  }

  const latest = visible.length ? visible[visible.length - 1].weight : null;
  const firstV = visible.length ? visible[0].weight : null;
  const delta = latest != null && firstV != null ? latest - firstV : null;

  function applyPreset(days: number) {
    if (days === 0) {
      setView({ start: domainStart, end: domainEnd });
    } else {
      const s = clamp(domainEnd - (days - 1), domainStart, domainEnd - MIN_SPAN);
      setView({ start: s, end: domainEnd });
    }
  }

  const activeDays = (() => {
    if (!view) return -1;
    if (view.start <= domainStart + 0.5 && view.end >= domainEnd - 0.5) return 0;
    const atEnd = Math.abs(view.end - domainEnd) < 0.5;
    const match = RANGES.find((r) => r.days > 0 && Math.abs(r.days - 1 - span) < 0.5);
    return atEnd && match ? match.days : -1;
  })();

  return (
    <div className="screen">
      <h1>Weight</h1>
      <p className="sub">{prettyDate(today)}</p>

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
              className={`seg-btn${activeDays === r.days ? " active" : ""}`}
              onClick={() => applyPreset(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {series.length < 2 || !view ? (
        <div className="empty">Log at least two days to see your trend line.</div>
      ) : (
        <div className="card">
          <ZoomChart
            points={points}
            view={view}
            setView={setView}
            domainStart={domainStart}
            domainEnd={domainEnd}
            totalSpan={totalSpan}
            unit={unit}
          />
          <div className="chart-legend">
            <span><i className="sw-raw" /> Daily</span>
            <span><i className="sw-trend" /> Trend</span>
            <span className="chart-hint">pinch / scroll to zoom · drag to pan</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoomChart({
  points,
  view,
  setView,
  domainStart,
  domainEnd,
  totalSpan,
  unit,
}: {
  points: Point[];
  view: View;
  setView: (v: View) => void;
  domainStart: number;
  domainEnd: number;
  totalSpan: number;
  unit: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>()); // pointerId -> clientX
  const anchors = useRef<{ view: View; pts: { id: number; day: number; x: number }[] }>({
    view,
    pts: [],
  });

  // Live refs so the natively-bound wheel handler always sees current values.
  const viewLive = useRef(view);
  viewLive.current = view;
  const domainLive = useRef({ domainStart, domainEnd, totalSpan });
  domainLive.current = { domainStart, domainEnd, totalSpan };

  const plotW = VBW - PADL - PADR;

  // clientX -> day-number under a given view, using the container geometry.
  function dayAt(clientX: number, v: View) {
    const rect = boxRef.current!.getBoundingClientRect();
    const scale = rect.width / VBW;
    const leftEdge = rect.left + PADL * scale;
    const f = (clientX - leftEdge) / (plotW * scale);
    return v.start + f * (v.end - v.start);
  }
  function fracAt(clientX: number) {
    const rect = boxRef.current!.getBoundingClientRect();
    const scale = rect.width / VBW;
    const leftEdge = rect.left + PADL * scale;
    return (clientX - leftEdge) / (plotW * scale);
  }

  function clampView(start: number, sp: number): View {
    const d = domainLive.current;
    const s2 = clamp(sp, MIN_SPAN, d.totalSpan);
    let st = start;
    if (st + s2 > d.domainEnd) st = d.domainEnd - s2;
    if (st < d.domainStart) st = d.domainStart;
    return { start: st, end: st + s2 };
  }

  // Re-seat gesture anchors whenever the set of active pointers changes.
  function reseat() {
    const v = view;
    anchors.current = {
      view: v,
      pts: [...pointers.current.entries()].map(([id, x]) => ({ id, day: dayAt(x, v), x })),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    reseat();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const active = [...pointers.current.keys()];
    const base = anchors.current;

    if (active.length >= 2) {
      // Pinch: keep the two anchored day-values under the two fingers.
      const [ia, ib] = active;
      const xa = pointers.current.get(ia)!;
      const xb = pointers.current.get(ib)!;
      const aA = base.pts.find((p) => p.id === ia);
      const aB = base.pts.find((p) => p.id === ib);
      if (!aA || !aB) return;
      const fa = fracAt(xa);
      const fb = fracAt(xb);
      if (Math.abs(fb - fa) < 1e-4) return;
      let sp = (aB.day - aA.day) / (fb - fa);
      sp = clamp(Math.abs(sp), MIN_SPAN, totalSpan);
      const start = aA.day - fa * sp;
      setView(clampView(start, sp));
    } else if (active.length === 1) {
      // Pan: keep the anchored day-value under the finger, span fixed.
      const id = active[0];
      const x = pointers.current.get(id)!;
      const a = base.pts.find((p) => p.id === id);
      if (!a) return;
      const sp = base.view.end - base.view.start;
      const f = fracAt(x);
      const start = a.day - f * sp;
      setView(clampView(start, sp));
    }
  }
  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    reseat();
  }

  // Wheel must be a non-passive native listener so we can preventDefault and
  // stop the page from scrolling while zooming.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewLive.current;
      const anchorDay = dayAt(e.clientX, v);
      const f = fracAt(e.clientX);
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      const sp = clamp((v.end - v.start) * factor, MIN_SPAN, domainLive.current.totalSpan);
      setView(clampView(anchorDay - f * sp, sp));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- render ----
  const vis = points.filter((p) => p.day >= view.start - 0.5 && p.day <= view.end + 0.5);
  const weights = (vis.length >= 2 ? vis : points).map((d) => d.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;

  const x = (day: number) => PADL + ((day - view.start) / (view.end - view.start)) * plotW;
  const y = (w: number) => PADT + (1 - (w - min) / (max - min)) * (VBH - PADT - PADB);

  const line = (sel: (p: Point) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.day).toFixed(1)} ${y(sel(p)).toFixed(1)}`).join(" ");
  const rawPath = line((p) => p.weight);
  const smoothPath = line((p) => p.smooth);
  const areaPath =
    `M ${x(points[0].day).toFixed(1)} ${(VBH - PADB).toFixed(1)} ` +
    points.map((p) => `L ${x(p.day).toFixed(1)} ${y(p.smooth).toFixed(1)}`).join(" ") +
    ` L ${x(points[points.length - 1].day).toFixed(1)} ${(VBH - PADB).toFixed(1)} Z`;

  const yTicks = [max, (max + min) / 2, min];
  const yDecimals = max - min < 6 ? 1 : 0;
  const last = vis.length ? vis[vis.length - 1] : points[points.length - 1];
  const startKey = vis.length ? vis[0].date : points[0].date;
  const endKey = vis.length ? vis[vis.length - 1].date : points[points.length - 1].date;

  return (
    <div
      ref={boxRef}
      className="zoom-box"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <svg className="chart" viewBox={`0 0 ${VBW} ${VBH}`}>
        <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="plotClip">
            <rect x={PADL} y={PADT - 4} width={plotW} height={VBH - PADT - PADB + 4} />
          </clipPath>
        </defs>

        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line className="grid-line" x1={PADL} y1={y(t)} x2={VBW - PADR} y2={y(t)} />
            <text className="axis-text" x={4} y={y(t) + 3}>
              {t.toFixed(yDecimals)}
            </text>
          </g>
        ))}

        <g clipPath="url(#plotClip)">
          <path className="area" d={areaPath} />
          <path className="line-raw" d={rawPath} />
          <path className="line" d={smoothPath} />
          <circle className="dot" cx={x(last.day)} cy={y(last.weight)} r={3.2} />
        </g>

        <text className="axis-text" x={PADL} y={VBH - 6}>{shortDate(startKey)}</text>
        <text className="axis-text" x={VBW - PADR} y={VBH - 6} textAnchor="end">{shortDate(endKey)}</text>
        <text className="axis-text" x={VBW - PADR} y={PADT} textAnchor="end">{unit}</text>
      </svg>
    </div>
  );
}
