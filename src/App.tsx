import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Config, DayLog, Habit, Photo } from "./lib/db";
import { getConfig, getHabits, getLogs, getPhotos, getWallpaper } from "./lib/db";
import Countdown from "./components/Countdown";
import PhotoCapture from "./components/PhotoCapture";
import Weight from "./components/Weight";
import Habits from "./components/Habits";
import Setup from "./components/Setup";
import Settings from "./components/Settings";
import {
  IconCamera,
  IconGear,
  IconGrid,
  IconScale,
  IconTimer,
} from "./components/icons";

type Tab = "countdown" | "photos" | "weight" | "habits" | "settings";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [config, setConfigState] = useState<Config | undefined>();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tab, setTab] = useState<Tab>("countdown");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const wallpaperUrlRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const [c, h, l, p, wall] = await Promise.all([
      getConfig(),
      getHabits(),
      getLogs(),
      getPhotos(),
      getWallpaper(),
    ]);
    setConfigState(c);
    setHabits(h);
    setLogs(l);
    setPhotos(p);

    // Swap the wallpaper object URL, revoking the previous one.
    if (wallpaperUrlRef.current) URL.revokeObjectURL(wallpaperUrlRef.current);
    const nextUrl = wall ? URL.createObjectURL(wall) : null;
    wallpaperUrlRef.current = nextUrl;
    setWallpaperUrl(nextUrl);

    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 1800);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="wallpaper" />
        <div className="scrim" />
        <div className="center-screen">
          <div className="hero-title" style={{ opacity: 0.55 }}>Lock In</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return <Setup onDone={reload} />;
  }

  const loggedDays = new Set(
    logs
      .filter((l) => l.weight != null || Object.keys(l.done).length > 0)
      .map((l) => l.date)
  ).size;

  return (
    <div className="app">
      <div
        className="wallpaper"
        style={wallpaperUrl ? { backgroundImage: `url(${wallpaperUrl})` } : undefined}
      />
      <div className="scrim" />

      {tab === "countdown" && (
        <Countdown config={config} photoCount={photos.length} loggedDays={loggedDays} />
      )}
      {tab === "photos" && (
        <PhotoCapture photos={photos} reload={reload} toast={toast} />
      )}
      {tab === "weight" && <Weight logs={logs} reload={reload} toast={toast} />}
      {tab === "habits" && (
        <Habits config={config} habits={habits} logs={logs} reload={reload} toast={toast} />
      )}
      {tab === "settings" && (
        <Settings config={config} wallpaperUrl={wallpaperUrl} reload={reload} toast={toast} />
      )}

      <nav className="tabbar">
        <TabButton active={tab === "countdown"} onClick={() => setTab("countdown")} label="Countdown">
          <IconTimer />
        </TabButton>
        <TabButton active={tab === "photos"} onClick={() => setTab("photos")} label="Photos">
          <IconCamera />
        </TabButton>
        <TabButton active={tab === "weight"} onClick={() => setTab("weight")} label="Weight">
          <IconScale />
        </TabButton>
        <TabButton active={tab === "habits"} onClick={() => setTab("habits")} label="Habits">
          <IconGrid />
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} label="Settings">
          <IconGear />
        </TabButton>
      </nav>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button className={`tab${active ? " active" : ""}`} onClick={onClick}>
      {children}
      {label}
    </button>
  );
}
