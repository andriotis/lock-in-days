import type { ReactNode } from "react";
import type { Config } from "../lib/db";
import { daysBetween, fromDayKey, prettyDate, todayKey } from "../lib/dates";
import { quoteForDay } from "../lib/quotes";

export default function Countdown({
  config,
  photoCount,
  loggedDays,
}: {
  config: Config;
  photoCount: number;
  loggedDays: number;
}) {
  const today = fromDayKey(todayKey());
  const start = fromDayKey(config.startDate);
  const end = fromDayKey(config.endDate);

  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.min(total, Math.max(0, daysBetween(start, today)));
  const remaining = Math.max(0, daysBetween(today, end));
  const started = daysBetween(start, today) >= 0;
  const finished = remaining === 0 && daysBetween(today, end) <= 0;

  const pct = Math.round((elapsed / total) * 100);

  return (
    <div className="screen">
      <h1>{config.title}</h1>
      <p className="sub">
        {prettyDate(config.startDate)} → {prettyDate(config.endDate)}
      </p>

      <div className="card count-hero">
        <ProgressRing fraction={started ? elapsed / total : 0}>
          {!started ? (
            <>
              <div className="count-big">{Math.abs(daysBetween(today, start))}</div>
              <div className="count-label">days until it begins</div>
            </>
          ) : finished ? (
            <>
              <div className="count-big">✓</div>
              <div className="count-label">complete</div>
            </>
          ) : (
            <>
              <div className="count-big">{remaining}</div>
              <div className="count-label">
                {remaining === 1 ? "day" : "days"} remaining
              </div>
            </>
          )}
        </ProgressRing>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Day {Math.min(elapsed + (started ? 1 : 0), total)} of {total} · {pct}%
          through
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <b>{elapsed}</b>
          <span>days done</span>
        </div>
        <div className="stat">
          <b>{loggedDays}</b>
          <span>days logged</span>
        </div>
        <div className="stat">
          <b>{photoCount}</b>
          <span>photos</span>
        </div>
      </div>

      <DailyQuote />
    </div>
  );
}

function ProgressRing({
  fraction,
  children,
}: {
  fraction: number;
  children: ReactNode;
}) {
  const size = 240;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));

  return (
    <div className="count-ring">
      <svg className="ring" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className="ring-prog"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="count-center">{children}</div>
    </div>
  );
}

function DailyQuote() {
  const q = quoteForDay(todayKey());
  return (
    <div className="card quote">
      <div className="quote-head">
        <span className="quote-mark">“</span>
        <span className="pill">Daily · {q.tag}</span>
      </div>
      <blockquote>{q.text}</blockquote>
      <cite>— {q.author}</cite>
    </div>
  );
}
