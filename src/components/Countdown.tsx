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
        {!started ? (
          <>
            <div className="count-big">{Math.abs(daysBetween(today, start))}</div>
            <div className="count-label">days until it begins</div>
          </>
        ) : finished ? (
          <>
            <div className="count-big">✓</div>
            <div className="count-label">locked in. period complete</div>
          </>
        ) : (
          <>
            <div className="count-big">{remaining}</div>
            <div className="count-label">
              {remaining === 1 ? "day" : "days"} remaining
            </div>
          </>
        )}

        <div className="progress" aria-label={`${pct}% complete`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
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

      <div className="card" style={{ marginTop: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {finished
            ? "You made it to the end of your lock-in. Time to look back at how far you've come."
            : started
            ? `Stay on it. Every checked box and every photo is proof you showed up today.`
            : "Your countdown is set. Show up on day one."}
        </p>
      </div>

      <DailyQuote />
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
