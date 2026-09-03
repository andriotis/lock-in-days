import { useEffect, useMemo, useRef, useState } from "react";
import type { Photo } from "../lib/db";
import { deletePhotos, putPhoto, reorderPhotos } from "../lib/db";
import { prettyDate, shortDate, todayKey } from "../lib/dates";
import { IconCamera, IconFlipH, IconPlay, IconTrash } from "./icons";
import { useReorder } from "../lib/useReorder";

const TARGET_W = 1080;
const TARGET_H = 1440; // 3:4 portrait — a consistent frame for the compilation

export default function PhotoCapture({
  photos,
  reload,
  toast,
}: {
  photos: Photo[];
  reload: () => void;
  toast: (m: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghost, setGhost] = useState(0.4); // ghost overlay opacity
  const [slideshow, setSlideshow] = useState(false);
  const [pane, setPane] = useState<"camera" | "gallery">("camera");

  // Gallery: batch-select + drag reorder.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const reorder = useReorder(
    photos.map((p) => p.id),
    (ids) => reorderPhotos(ids).then(reload)
  );

  // Mirror (selfie flip). On by default (the usual selfie feel); flip icon
  // toggles it since the "right" orientation varies by device. Persisted.
  const [mirror, setMirror] = useState(() => localStorage.getItem("camMirror") !== "0");
  useEffect(() => {
    localStorage.setItem("camMirror", mirror ? "1" : "0");
  }, [mirror]);

  // Self-timer: gives you time to step back into a full-body frame.
  const [timerSec, setTimerSec] = useState(10);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  }
  useEffect(() => clearTimer, []);

  function onShutter() {
    if (countdown !== null) {
      clearTimer(); // tapping again cancels the countdown
      return;
    }
    if (timerSec === 0) {
      capture();
      return;
    }
    setCountdown(timerSec);
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearTimer();
          capture();
          return null;
        }
        return c - 1;
      });
    }, 1000);
  }

  // Newest photo (by capture time) becomes the alignment ghost for the next
  // shot — regardless of any manual gallery reordering.
  const lastPhoto = photos.length
    ? photos.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
    : null;

  // Build object URLs for the gallery + ghost, and revoke them on change.
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of photos) map.set(p.id, URL.createObjectURL(p.blob));
    return map;
  }, [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  async function start() {
    setError(null);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Selfie (front) camera only.
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e) {
      setError(
        "Camera unavailable. Grant camera permission, and note that the camera only works over HTTPS or on localhost."
      );
      setReady(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }

  // Only run the camera while the Camera pane is showing.
  useEffect(() => {
    if (pane === "camera") start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane]);

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d")!;

    // object-fit: cover — crop the source to the 3:4 target.
    const srcRatio = v.videoWidth / v.videoHeight;
    const dstRatio = TARGET_W / TARGET_H;
    let sx = 0, sy = 0, sw = v.videoWidth, sh = v.videoHeight;
    if (srcRatio > dstRatio) {
      sw = v.videoHeight * dstRatio;
      sx = (v.videoWidth - sw) / 2;
    } else {
      sh = v.videoWidth / dstRatio;
      sy = (v.videoHeight - sh) / 2;
    }
    // Flip the saved frame to match the preview only when Mirror is on.
    if (mirror) {
      ctx.translate(TARGET_W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.9)
    );
    if (!blob) return;

    const now = Date.now();
    await putPhoto({
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      date: todayKey(),
      blob,
      w: TARGET_W,
      h: TARGET_H,
      createdAt: now,
      order: now, // default order = chronological
    });
    toast("Photo saved");
    reload();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} photo${selected.size > 1 ? "s" : ""}?`)) return;
    await deletePhotos([...selected]);
    exitSelect();
    reload();
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Photos</h1>
        <div className="seg" role="group" aria-label="Photos view">
          <button
            className={`seg-btn${pane === "camera" ? " active" : ""}`}
            onClick={() => setPane("camera")}
          >
            Camera
          </button>
          <button
            className={`seg-btn${pane === "gallery" ? " active" : ""}`}
            onClick={() => setPane("gallery")}
          >
            Gallery · {photos.length}
          </button>
        </div>
      </div>
      <p className="sub" style={{ margin: "6px 0 12px" }}>{prettyDate(todayKey())}</p>

      {pane === "camera" ? (
       <>
      <div className="cam-wrap">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className={mirror ? "mirror" : undefined} />

        {lastPhoto && ghost > 0 && (
          <img
            className="cam-ghost"
            src={urls.get(lastPhoto.id)}
            alt=""
            style={{ opacity: ghost }}
          />
        )}

        {lastPhoto && (
          <div className="cam-badge">
            <span className="cam-tag">👻 ghost on</span>
          </div>
        )}

        {countdown !== null && (
          <div className="cam-countdown" onClick={clearTimer}>
            <span key={countdown}>{countdown}</span>
            <small>tap to cancel</small>
          </div>
        )}
      </div>

      {error && <p className="hint" style={{ color: "#ff9a9a" }}>{error}</p>}

      {lastPhoto && (
        <label className="field" style={{ marginTop: 14 }}>
          <span>Ghost overlay strength · {Math.round(ghost * 100)}%</span>
          <input
            type="range"
            min={0}
            max={0.85}
            step={0.05}
            value={ghost}
            onChange={(e) => setGhost(Number(e.target.value))}
          />
        </label>
      )}

      <div className="cam-controls">
        <div className="cam-options">
          <div className="timer-select" role="group" aria-label="Self-timer">
            {[
              { v: 0, l: "Off" },
              { v: 3, l: "3s" },
              { v: 10, l: "10s" },
            ].map((o) => (
              <button
                key={o.v}
                className={`timer-chip${timerSec === o.v ? " active" : ""}`}
                onClick={() => setTimerSec(o.v)}
                disabled={countdown !== null}
              >
                {o.l}
              </button>
            ))}
          </div>
          <button
            className={`opt-toggle${mirror ? " active" : ""}`}
            onClick={() => setMirror((m) => !m)}
            disabled={countdown !== null}
            aria-pressed={mirror}
            aria-label="Flip image left-to-right"
            title="Flip image left-to-right"
          >
            <IconFlipH />
          </button>
        </div>
        <button
          className={`shutter${countdown !== null ? " counting" : ""}`}
          onClick={onShutter}
          disabled={!ready && countdown === null}
          aria-label={countdown !== null ? "Cancel timer" : "Capture"}
        />
        <p className="hint" style={{ margin: 0, textAlign: "center" }}>
          {countdown !== null
            ? "Get into frame…"
            : timerSec > 0
            ? `${timerSec}s timer — tap, then step back into frame`
            : "Tap to capture"}
        </p>
      </div>
        </>
      ) : (
        <>
      {photos.length > 0 && (
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          {selectMode ? (
            <>
              <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
                {selected.size} selected
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn danger sm"
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                >
                  <span className="row" style={{ gap: 6 }}>
                    <IconTrash style={{ width: 15, height: 15 }} /> Delete
                  </span>
                </button>
                <button className="btn ghost sm" onClick={exitSelect}>Done</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn ghost sm" onClick={() => setSelectMode(true)}>
                Select
              </button>
              {photos.length > 1 && (
                <button className="btn ghost sm" onClick={() => setSlideshow(true)}>
                  <span className="row" style={{ gap: 6 }}>
                    <IconPlay style={{ width: 16, height: 16 }} /> Play
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="empty">
          <IconCamera style={{ width: 32, height: 32, opacity: 0.5 }} />
          <p>No photos yet. Take your day-one shot.</p>
        </div>
      ) : (
        <div className="gallery" ref={(el) => (reorder.containerRef.current = el)}>
          {reorder.orderIds.map((id) => {
            const p = photoById.get(id);
            if (!p) return null;
            const isSel = selected.has(id);
            return (
              <div
                className={`cell${reorder.dragId === id ? " reordering" : ""}${
                  selectMode && isSel ? " selected" : ""
                }`}
                key={id}
                {...(selectMode ? {} : reorder.itemProps(id))}
                onClick={() => {
                  if (selectMode) toggleSelect(id);
                  else if (reorder.justDragged()) return;
                }}
              >
                <img src={urls.get(id)} alt={p.date} loading="lazy" draggable={false} />
                <div className="d">{shortDate(p.date)}</div>
                {selectMode && (
                  <span className={`sel-badge${isSel ? " on" : ""}`}>
                    {isSel ? "✓" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {photos.length > 1 && !selectMode && (
        <p className="hint" style={{ textAlign: "center" }}>
          Hold and drag to reorder · Select to delete
        </p>
      )}
        </>
      )}

      {slideshow && (
        <Slideshow
          photos={photos}
          urls={urls}
          onClose={() => setSlideshow(false)}
        />
      )}
    </div>
  );
}

function Slideshow({
  photos,
  urls,
  onClose,
}: {
  photos: Photo[];
  urls: Map<string, string>;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [fps, setFps] = useState(4);

  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % photos.length), 1000 / fps);
    return () => clearInterval(id);
  }, [fps, photos.length]);

  const p = photos[i];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.94)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 20,
      }}
    >
      <img
        src={urls.get(p.id)}
        alt={p.date}
        style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 16 }}
      />
      <div className="cam-tag">{shortDate(p.date)} · {i + 1}/{photos.length}</div>
      <div className="row" onClick={(e) => e.stopPropagation()} style={{ width: "min(360px,90%)" }}>
        <span className="muted" style={{ fontSize: 13 }}>Speed</span>
        <input
          className="grow"
          type="range"
          min={1}
          max={12}
          step={1}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        />
        <span className="muted" style={{ fontSize: 13, width: 48 }}>{fps} fps</span>
      </div>
      <button className="btn" onClick={onClose}>Close</button>
    </div>
  );
}
