import { useMemo, useState } from "react";
import type { Config, DayLog, Habit } from "../lib/db";
import { deleteHabit, getLog, putHabit, putLog } from "../lib/db";
import {
  addDays,
  daysBetween,
  fromDayKey,
  prettyDate,
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
          {habits.map((h) => (
            <HabitHeatmap key={h.id} habit={h} config={config} logByDate={logByDate} />
          ))}
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

function HabitHeatmap({
  habit,
  config,
  logByDate,
}: {
  habit: Habit;
  config: Config;
  logByDate: Map<string, DayLog>;
}) {
  const today = fromDayKey(todayKey());
  const start = fromDayKey(config.startDate);
  const end = fromDayKey(config.endDate);

  // Grid runs from the Sunday on/before the start, through this week.
  const gridStart = addDays(start, -start.getDay());
  const gridEnd = addDays(today, 6 - today.getDay());
  const totalDays = daysBetween(gridStart, gridEnd) + 1;
  const weeks: {
    key: string;
    inRange: boolean;
    future: boolean;
    done: boolean;
  }[][] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(gridStart, i);
    const key = toDayKey(d);
    const inRange = daysBetween(start, d) >= 0 && daysBetween(d, end) >= 0;
    const future = daysBetween(today, d) > 0;
    const done = !!logByDate.get(key)?.done[habit.id];
    const col = Math.floor(i / 7);
    if (!weeks[col]) weeks[col] = [];
    weeks[col].push({ key, inRange, future, done });
  }

  const doneCount = weeks.flat().filter((c) => c.done).length;
  const possible = weeks.flat().filter((c) => c.inRange && !c.future).length;

  return (
    <div className="habit-block">
      <div className="habit-head">
        <span className="name">
          <span className="dot-swatch" style={{ background: habit.color }} />
          {habit.name}
        </span>
        <span className="pill">
          {doneCount}/{possible} days
        </span>
      </div>
      <div className="heat-scroll">
        <div className="heat">
          {weeks.map((week, wi) =>
            week.map((cell, di) => (
              <div
                key={`${wi}-${di}`}
                className="cellbox"
                title={cell.key}
                style={{
                  background: cell.done
                    ? habit.color
                    : cell.inRange && !cell.future
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                  opacity: cell.future || !cell.inRange ? 0.3 : 1,
                }}
              />
            ))
          )}
        </div>
      </div>
      <div className="legend">
        <span>Skipped</span>
        <span className="cellbox" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="cellbox" style={{ background: habit.color }} />
        <span>Done</span>
      </div>
    </div>
  );
}
