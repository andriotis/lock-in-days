import { useEffect, useMemo, useRef, useState } from "react";
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
  const [pane, setPane] = useState<"today" | "consistency">("today");

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

      {habits.length > 0 && !manage && (
        <div className="seg seg-full" role="group" aria-label="Habits view" style={{ margin: "12px 0 14px" }}>
          <button
            className={`seg-btn${pane === "today" ? " active" : ""}`}
            onClick={() => setPane("today")}
          >
            Today
          </button>
          <button
            className={`seg-btn${pane === "consistency" ? " active" : ""}`}
            onClick={() => setPane("consistency")}
          >
            Grid
          </button>
        </div>
      )}

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
      {habits.length > 0 && !manage && pane === "today" && (
        <>
          <p className="sub" style={{ margin: "0 0 10px" }}>{prettyDate(today)}</p>
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
        </>
      )}

      {habits.length > 0 && !manage && pane === "consistency" && (
        <HabitMatrix habits={habits} config={config} logByDate={logByDate} />
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

/**
 * A single aggregated grid: one row per habit, each in its own color. A legend
 * names the habits; the strip of days scrolls horizontally — drag (or swipe) to
 * move forward and backward through the period. Opens scrolled to today.
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
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(start, i);
    const key = toDayKey(d);
    return { key, future: daysBetween(today, d) > 0, isToday: key === todayK };
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  // Open scrolled to the most recent day.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [totalDays, habits.length]);

  // Mouse click-drag to pan (touch swipes scroll natively).
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, left: scrollRef.current!.scrollLeft };
    scrollRef.current!.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    scrollRef.current!.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  }
  function endDrag() {
    drag.current = null;
  }

  return (
    <div className="card hgrid">
      <div className="hgrid-legend">
        {habits.map((h) => (
          <span className="hgrid-legend-item" key={h.id}>
            <span className="hgrid-chip" style={{ borderColor: h.color }} />
            {h.name}
          </span>
        ))}
      </div>

      <div
        className="hgrid-scroll"
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="hgrid-rows">
          {habits.map((h) => (
            <div className="hgrid-row" key={h.id}>
              {days.map((d) => {
                const done = !!logByDate.get(d.key)?.done[h.id];
                return (
                  <i
                    key={d.key}
                    className={`gcell${d.isToday ? " today" : ""}`}
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
      </div>

      <div className="hgrid-foot">
        {shortDate(config.startDate)} – {shortDate(config.endDate)} · drag to move · today outlined
      </div>
    </div>
  );
}
