import { useEffect, useState } from "react";
import { addDays, daysBetween, fromDayKey, toDayKey } from "../lib/dates";

const MIN_DAYS = 1;
const MAX_DAYS = 3650;

/**
 * Compact period picker: start and end dates, plus a typed "length in days"
 * field. All three stay in sync — type a length and the end date moves; edit a
 * date and the length updates.
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
  const days = Math.max(1, daysBetween(fromDayKey(start), fromDayKey(end)));

  // Local buffer so the field can be briefly empty/partial while typing.
  const [daysText, setDaysText] = useState(String(days));
  useEffect(() => setDaysText(String(days)), [days]);

  function commitDays(text: string) {
    setDaysText(text);
    const n = parseInt(text, 10);
    if (Number.isFinite(n) && n >= MIN_DAYS) {
      onChange(start, toDayKey(addDays(fromDayKey(start), Math.min(n, MAX_DAYS))));
    }
  }

  function setStart(next: string) {
    if (!next) return;
    onChange(next, toDayKey(addDays(fromDayKey(next), days))); // keep the length
  }

  function setEnd(next: string) {
    if (!next) return;
    if (daysBetween(fromDayKey(start), fromDayKey(next)) < 1) return;
    onChange(start, next);
  }

  return (
    <div className="period">
      <div className="period-row">
        <label className="field grow" style={{ marginBottom: 0 }}>
          <span>Start</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field grow" style={{ marginBottom: 0 }}>
          <span>End</span>
          <input
            type="date"
            value={end}
            min={toDayKey(addDays(fromDayKey(start), 1))}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <div className="period-length">
        <span>Length</span>
        <div className="days-field">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DAYS}
            max={MAX_DAYS}
            value={daysText}
            onChange={(e) => commitDays(e.target.value)}
            onBlur={() => setDaysText(String(days))}
            aria-label="Length in days"
          />
          <span className="u">days</span>
        </div>
      </div>
    </div>
  );
}
