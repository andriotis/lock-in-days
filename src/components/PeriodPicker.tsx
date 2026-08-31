import { addDays, daysBetween, fromDayKey, toDayKey } from "../lib/dates";

const MIN_DAYS = 7;
const MAX_DAYS = 365;

/**
 * Two-column period picker: dates on the left, a vertical "timer" slider on the
 * right that sets the duration. Dragging the slider moves the end date; editing
 * a date snaps the slider to match.
 */
export default function PeriodPicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const days = Math.min(
    MAX_DAYS,
    Math.max(MIN_DAYS, daysBetween(fromDayKey(start), fromDayKey(end)))
  );

  function setDays(n: number) {
    onChange(start, toDayKey(addDays(fromDayKey(start), n)));
  }

  function setStart(next: string) {
    if (!next) return;
    // Keep the same duration when the start moves.
    onChange(next, toDayKey(addDays(fromDayKey(next), days)));
  }

  function setEnd(next: string) {
    if (!next) return;
    const s = fromDayKey(start);
    const e = fromDayKey(next);
    const d = daysBetween(s, e);
    if (d < 1) return; // end must be after start
    onChange(start, next);
  }

  const weeks = Math.round(days / 7);

  return (
    <div className="period">
      <div className="period-dates">
        <label className="field">
          <span>Start</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>End</span>
          <input
            type="date"
            value={end}
            min={toDayKey(addDays(fromDayKey(start), 1))}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <div className="period-slider">
        <div className="period-readout">
          <b>{days}</b>
          <span>days</span>
        </div>
        <input
          className="vrange"
          type="range"
          min={MIN_DAYS}
          max={MAX_DAYS}
          step={1}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Lock-in length in days"
        />
        <span className="period-weeks">{weeks}w</span>
      </div>
    </div>
  );
}
