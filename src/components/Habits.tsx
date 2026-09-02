import { useMemo, useState } from "react";
import type { Config, DayLog, Habit } from "../lib/db";
import { deleteHabit, getLog, putHabit, putLog } from "../lib/db";
import {
  addDays,
  daysBetween,
  fromDayKey,
  prettyDate,
  shortDate,
  toDayKey,
  todayKey,
} from "../lib/dates";
import { IconCheck, IconPlus, IconTrash } from "./icons";

const PALETTE = [
  "#22d3ee", "#34d399", "#f472b6", "#fbbf24",
  "#a78bfa", "#60a5fa", "#fb923c", "#4ade80",
];

export default function Habits({
  config,
  habits,
  logs,
  reload,
  toast,
}: {
  config: Config;
  habits: Habit[];
  logs: DayLog[];
  reload: () => void;
  toast: (m: string) => void;
}) {
  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState("");

  const today = todayKey();
  const logByDate = useMemo(() => {
    const m = new Map<string, DayLog>();
    for (const l of logs) m.set(l.date, l);
    return m;
  }, [logs]);

  async function toggleToday(habitId: string) {
    const existing = (await getLog(today)) ?? { date: today, done: {} };
    const done = { ...existing.done, [habitId]: !existing.done[habitId] };
    if (!done[habitId]) delete done[habitId];
    await putLog({ ...existing, done });
    reload();
  }

  async function addHabit() {
    const name = newName.trim();
    if (!name) return;
    await putHabit({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      color: PALETTE[habits.length % PALETTE.length],
      order: habits.length,
    });
    setNewName("");
    toast("Habit added");
    reload();
  }

  async function removeHabit(h: Habit) {
    if (!confirm(`Delete "${h.name}"? Your logged history stays intact.`)) return;
    await deleteHabit(h.id);
    reload();
  }

  function streakOf(habitId: string): number {
    let s = 0;
    let d = fromDayKey(today);
    // If today isn't done yet, start counting from yesterday so the streak
    // doesn't read 0 all day until you check in.
    if (!logByDate.get(toDayKey(d))?.done[habitId]) d = addDays(d, -1);
    while (logByDate.get(toDayKey(d))?.done[habitId]) {
      s++;
      d = addDays(d, -1);
    }
    return s;
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Habits</h1>
        <button className="btn ghost" onClick={() => setManage((m) => !m)}>
          {manage ? "Done" : "Edit"}
        </button>
      </div>
      <p className="sub">Check in every day. Keep the squares green.</p>

      {habits.length === 0 && !manage && (
        <div className="empty">
          No habits yet.
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setManage(true)}>
              Add your first habit
            </button>
          </div>
        </div>
      )}

      {/* Today's checklist */}
      {habits.length > 0 && !manage && (
        <>
          <h2>Today · {prettyDate(today)}</h2>
          <div className="check-list">
            {habits.map((h) => {
              const done = !!logByDate.get(today)?.done[h.id];
              const streak = streakOf(h.id);
              return (
                <div
                  key={h.id}
                  className={`check-item${done ? " done" : ""}`}
                  onClick={() => toggleToday(h.id)}
                  style={done ? { background: h.color + "22", borderColor: h.color } : undefined}
                >
                  <div
                    className="check-box"
                    style={done ? { background: h.color, borderColor: h.color, color: "#06121a" } : undefined}
                  >
                    <IconCheck />
                  </div>
                  <span className="name">{h.name}</span>
                  {streak > 0 && <span className="streak">🔥 {streak}</span>}
                </div>
              );
            })}
          </div>

          <h2>Consistency</h2>
          <HabitMatrix habits={habits} config={config} logByDate={logByDate} />
        </>
      )}

      {/* Manage view */}
      {manage && (
        <>
          <h2>Your habits</h2>
          <div className="check-list">
            {habits.map((h) => (
              <div className="check-item" key={h.id}>
                <span className="dot-swatch" style={{ background: h.color }} />
                <span className="name">{h.name}</span>
                <button className="icon-btn" onClick={() => removeHabit(h)} style={{ width: 40, height: 40 }}>
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="grow"
                type="text"
                placeholder="New habit (e.g. Gym, Read 20m, No sugar)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHabit()}
              />
              <button className="btn primary" onClick={addHabit} disabled={!newName.trim()}>
                <IconPlus style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p className="hint">Keep it to a handful you can actually hit every day.</p>
          </div>
        </>
      )}
    </div>
  );
}

const PAGE_DAYS = 14; // days shown per page; arrows move between pages

/**
 * A single aggregated grid: one row per habit, each in its own color. A legend
 * names the habits, and the ‹ › arrows page through the period a fortnight at a
 * time so the cells stay large and fill the width — no scrolling.
 */
function HabitMatrix({
  habits,
  config,
  logByDate,
}: {
  habits: Habit[];
  config: Config;
  logByDate: Map<string, DayLog>;
}) {
  const today = fromDayKey(todayKey());
  const todayK = toDayKey(today);
  const start = fromDayKey(config.startDate);
  const end = fromDayKey(config.endDate);

  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  const pageCount = Math.ceil(totalDays / PAGE_DAYS);

  // Default to the page that contains today (the most relevant one).
  const todayIdx = Math.min(totalDays - 1, Math.max(0, daysBetween(start, today)));
  const [page, setPage] = useState(Math.floor(todayIdx / PAGE_DAYS));
  const safePage = Math.min(page, pageCount - 1);

  // Build this page's days, padding the last page so cell widths stay uniform.
  const pageDays = Array.from({ length: PAGE_DAYS }, (_, i) => {
    const idx = safePage * PAGE_DAYS + i;
    if (idx >= totalDays) return null;
    const d = addDays(start, idx);
    const key = toDayKey(d);
    return { key, future: daysBetween(today, d) > 0, isToday: key === todayK };
  });

  const realDays = pageDays.filter(Boolean) as {
    key: string;
    future: boolean;
    isToday: boolean;
  }[];
  const rangeLabel =
    realDays.length > 0
      ? `${shortDate(realDays[0].key)} – ${shortDate(realDays[realDays.length - 1].key)}`
      : "";

  return (
    <div className="card hgrid">
      <div className="hgrid-head">
        <div className="hgrid-legend">
          {habits.map((h) => (
            <span className="hgrid-legend-item" key={h.id}>
              <span className="hgrid-chip" style={{ borderColor: h.color }} />
              {h.name}
            </span>
          ))}
        </div>
        <div className="hgrid-nav">
          <button
            aria-label="Earlier"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage <= 0}
          >
            <Chevron dir="left" />
          </button>
          <button
            aria-label="Later"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>

      <div className="hgrid-rows">
        {habits.map((h) => (
          <div className="hgrid-row" key={h.id}>
            {pageDays.map((d, i) => {
              if (!d) return <i key={`pad-${i}`} className="hgrid-cell pad" />;
              const done = !!logByDate.get(d.key)?.done[h.id];
              return (
                <i
                  key={d.key}
                  className={`hgrid-cell${d.isToday ? " today" : ""}`}
                  title={`${h.name} · ${d.key}`}
                  style={{
                    background: done ? h.color : "transparent",
                    borderColor: done
                      ? h.color
                      : d.future
                      ? h.color + "33"
                      : h.color + "aa",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="hgrid-foot">{rangeLabel}</div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      {dir === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}
