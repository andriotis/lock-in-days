import { useEffect, useReducer, useRef, useState } from "react";

/**
 * Long-press-then-drag reordering for a list or grid of items identified by
 * `ids`. A quick tap/swipe is left alone (so tapping still toggles and the page
 * still scrolls); pressing and holding ~220ms lifts an item, after which moving
 * reorders live and releasing commits the new order.
 *
 * Attach `containerRef` to the wrapping element, spread `itemProps(id)` on each
 * item, render in `orderIds`, and style the lifted item via `dragId`.
 */
export function useReorder(ids: string[], commit: (ids: string[]) => void) {
  const orderRef = useRef<string[]>(ids);
  const [, force] = useReducer((c) => c + 1, 0);
  const setOrder = (next: string[]) => {
    orderRef.current = next;
    force();
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const startPt = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Keep local order in sync with props when we're not mid-drag.
  useEffect(() => {
    if (dragRef.current == null) orderRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  function moveWhileDragging(e: PointerEvent) {
    if (dragRef.current == null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && (el.closest("[data-rid]") as HTMLElement | null);
    const overId = over?.getAttribute("data-rid");
    if (!overId || overId === dragRef.current) return;
    const prev = orderRef.current;
    const from = prev.indexOf(dragRef.current);
    const to = prev.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = [...prev];
    next.splice(from, 1);
    next.splice(to, 0, dragRef.current);
    setOrder(next);
  }

  function endDrag() {
    window.removeEventListener("pointermove", moveWhileDragging);
    window.removeEventListener("pointerup", endDrag);
    if (dragRef.current != null) {
      didDrag.current = true;
      commit(orderRef.current);
      dragRef.current = null;
      setDragId(null);
      window.setTimeout(() => (didDrag.current = false), 60);
    }
  }

  function lift(id: string) {
    dragRef.current = id;
    setDragId(id);
    navigator.vibrate?.(12);
    window.addEventListener("pointermove", moveWhileDragging);
    window.addEventListener("pointerup", endDrag);
  }

  function onPointerDown(id: string, e: React.PointerEvent) {
    startPt.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => lift(id), 220);
    const cancelMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startPt.current.x;
      const dy = ev.clientY - startPt.current.y;
      if (dragRef.current == null && Math.hypot(dx, dy) > 10) cleanup();
    };
    const cleanup = () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      window.removeEventListener("pointermove", cancelMove);
      window.removeEventListener("pointerup", cleanup);
    };
    window.addEventListener("pointermove", cancelMove);
    window.addEventListener("pointerup", cleanup);
  }

  // Block page scrolling only while an item is actually lifted.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (dragRef.current != null) e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  return {
    orderIds: orderRef.current,
    dragId,
    containerRef,
    itemProps: (id: string) => ({
      "data-rid": id,
      onPointerDown: (e: React.PointerEvent) => onPointerDown(id, e),
    }),
    /** True right after a drag, so a click handler can skip its tap action. */
    justDragged: () => didDrag.current,
  };
}
