import { useEffect, useState } from "react";
import type { Config } from "../lib/db";
import { setConfig, setWallpaper } from "../lib/db";
import { addDays, toDayKey, todayKey } from "../lib/dates";
import PeriodPicker from "./PeriodPicker";
import WallpaperPicker from "./WallpaperPicker";

export default function Setup({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(todayKey());
  const [end, setEnd] = useState(toDayKey(addDays(new Date(), 75)));
  const [wallBlob, setWallBlob] = useState<Blob | null>(null);
  const [wallUrl, setWallUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!wallBlob) {
      setWallUrl(null);
      return;
    }
    const url = URL.createObjectURL(wallBlob);
    setWallUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [wallBlob]);

  async function save() {
    const cfg: Config = {
      title: title.trim() || "Lock In",
      startDate: start,
      endDate: end,
    };
    await setConfig(cfg);
    if (wallBlob) await setWallpaper(wallBlob);
    onDone();
  }

  const valid = end > start;

  return (
    <div className="app">
      {/* Live wallpaper preview behind the setup card */}
      <div
        className="wallpaper"
        style={wallUrl ? { backgroundImage: `url(${wallUrl})` } : undefined}
      />
      <div className="scrim" />

      <div className="center-screen">
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div className="hero-title">Lock In</div>
            <p className="muted">
              Set the stretch you're committing to. Make it yours.
            </p>
          </div>

          <div className="card">
            <label className="field">
              <span>What are you locking in for?</span>
              <input
                type="text"
                value={title}
                placeholder="e.g. Summer Cut, Exam Season"
                onChange={(e) => setTitle(e.target.value)}
                maxLength={40}
              />
            </label>

            <div className="divider" />

            <PeriodPicker
              start={start}
              end={end}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />

            <div className="divider" />

            <span className="field-label">Background</span>
            <WallpaperPicker
              previewUrl={wallUrl}
              onPick={setWallBlob}
              onClear={() => setWallBlob(null)}
            />

            <button
              className="btn primary block"
              onClick={save}
              disabled={!valid}
              style={{ marginTop: 18 }}
            >
              Start the countdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
