import { useState } from "react";
import type { Config } from "../lib/db";
import { setConfig } from "../lib/db";
import { addDays, toDayKey, todayKey } from "../lib/dates";

export default function Setup({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("Summer Lock In");
  const [start, setStart] = useState(todayKey());
  const [end, setEnd] = useState(toDayKey(addDays(new Date(), 75)));

  async function save() {
    if (!title.trim() || !start || !end || end <= start) return;
    const cfg: Config = { title: title.trim(), startDate: start, endDate: end };
    await setConfig(cfg);
    onDone();
  }

  const valid = title.trim() && end > start;

  return (
    <div className="center-screen">
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="count-big" style={{ fontSize: 56 }}>Lock In</div>
          <p className="muted">Set the period you're committing to. You can change this later.</p>
        </div>

        <div className="card">
          <label className="field">
            <span>What are you locking in for?</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            <span>Start date</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>End date</span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </label>

          <div className="row wrap" style={{ marginBottom: 12 }}>
            {[30, 45, 60, 75, 90, 100].map((n) => (
              <button
                key={n}
                className="pill"
                style={{ cursor: "pointer" }}
                onClick={() => setEnd(toDayKey(addDays(new Date(start.replace(/-/g, "/")), n)))}
              >
                {n} days
              </button>
            ))}
          </div>

          <button className="btn primary block" onClick={save} disabled={!valid}>
            Start the countdown
          </button>
        </div>
      </div>
    </div>
  );
}
