import { useEffect, useMemo, useRef, useState } from "react";
import type { Config, DayLog, Habit } from "../lib/db";
import { deleteHabit, getLog, putHabit, putLog, reorderHabits } from "../lib/db";
import { useReorder } from "../lib/useReorder";
import {
  addDays,
  daysBetween,
  fromDayKey,
  prettyDate,
  shortDate,
  toDayKey,
  todayKey,
} from "../lib/dates";
import { IconCheck, IconDots, IconPlus, IconTrash } from "./icons";

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
  const [newName, setNewName] = useState("");
  const [pane, setPane] = useState<"today" | "consistency">("today");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PALETTE[0]);

  const today = todayKey();
  const logByDate = useMemo(() => {
    const m = new Map<string, DayLog>();
    for (const l of logs) m.set(l.date, l);
    return m;
  }, [logs]);

  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const reorder = useReorder(
    habits.map((h) => h.id),
    (ids) => reorderHabits(ids).then(reload)
  );

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
    setEditingId(null);
    reload();
  }

  function openEditor(h: Habit) {
    setEditingId((id) => (id === h.id ? null : h.id));
    setEditName(h.name);
    setEditColor(h.color);
  }

  async function saveEdit(h: Habit) {
    await putHabit({ ...h, name: editName.trim() || h.name, color: editColor });
    setEditingId(null);
    toast("Saved");
    reload();
  }

  async function submitAdd() {
    if (!newName.trim()) return;
    await addHabit();
    setAdding(false);
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
      <header className="page-head">
        <div className="page-head-row">
          <h1>Habits</h1>
          {habits.length > 0 && (
            <div className="seg" role="group" aria-label="Habits view">
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
        </div>
        {habits.length > 0 && <p className="sub">{prettyDate(today)}</p>}
      </header>

      {pane === "consistency" && habits.length > 0 ? (
        <HabitMatrix habits={habits} config={config} logByDate={logByDate} />
      ) : (
        <>
          <div className="check-list" ref={(el) => (reorder.containerRef.current = el)}>
            {reorder.orderIds.map((id) => {
              const h = habitById.get(id);
              if (!h) return null;
              const done = !!logByDate.get(today)?.done[h.id];
              const streak = streakOf(h.id);
              const editing = editingId === h.id;
              return (
                <div key={h.id}>
                  <div
                    className={`check-item${done ? " done" : ""}${reorder.dragId === h.id ? " reordering" : ""}`}
                    {...reorder.itemProps(h.id)}
                    onClick={() => {
                      if (reorder.justDragged()) return;
                      toggleToday(h.id);
                    }}
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
                    <button
                      className={`row-kebab${editing ? " open" : ""}`}
                      aria-label={`Edit ${h.name}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(h);
                      }}
                    >
                      <IconDots />
                    </button>
                  </div>

                  {editing && (
                    <div className="habit-editor">
                      <input
                        className="grow"
                        type="text"
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(h)}
                      />
                      <div className="swatches">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            className={`swatch${editColor === c ? " active" : ""}`}
                            style={{ background: c }}
                            aria-label={`Colour ${c}`}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn danger sm" onClick={() => removeHabit(h)}>
                          <span className="row" style={{ gap: 6 }}>
                            <IconTrash style={{ width: 15, height: 15 }} /> Delete
                          </span>
                        </button>
                        <button className="btn primary sm grow" onClick={() => saveEdit(h)}>
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {adding ? (
              <div className="add-row">
                <input
                  className="grow"
                  type="text"
                  autoFocus
                  placeholder="New habit (e.g. Gym, Read 20m)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAdd();
                    if (e.key === "Escape") { setAdding(false); setNewName(""); }
                  }}
                />
                <button className="btn primary sm" onClick={submitAdd} disabled={!newName.trim()}>
                  Add
                </button>
              </div>
            ) : (
              <button className="add-habit" onClick={() => setAdding(true)}>
                <IconPlus style={{ width: 18, height: 18 }} /> Add habit
              </button>
            )}
          </div>

          {habits.length === 0 && !adding && (
            <p className="hint" style={{ textAlign: "center" }}>
              Add a few habits you can hit every day.
            </p>
          )}
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
