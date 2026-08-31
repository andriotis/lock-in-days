import { useRef, useState } from "react";
import type { Config } from "../lib/db";
import { exportBackup, importBackup, setConfig } from "../lib/db";

export default function Settings({
  config,
  onClose,
  reload,
  toast,
}: {
  config: Config;
  onClose: () => void;
  reload: () => void;
  toast: (m: string) => void;
}) {
  const [title, setTitle] = useState(config.title);
  const [start, setStart] = useState(config.startDate);
  const [end, setEnd] = useState(config.endDate);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!title.trim() || end <= start) return;
    await setConfig({ title: title.trim(), startDate: start, endDate: end });
    toast("Saved");
    reload();
    onClose();
  }

  async function doExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lock-in-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  async function doImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importBackup(data);
      toast("Backup restored");
      reload();
      onClose();
    } catch {
      toast("Could not read that backup file");
    }
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>

      <h2>Lock-in period</h2>
      <div className="card">
        <label className="field">
          <span>Title</span>
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
        <button className="btn primary block" onClick={save} disabled={!title.trim() || end <= start}>
          Save changes
        </button>
      </div>

      <h2>Your data</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Everything lives on this device only. Export a backup regularly — clearing
          your browser data or switching phones will otherwise lose it.
        </p>
        <div className="row wrap">
          <button className="btn" onClick={doExport}>Export backup (.json)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore backup</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
      </div>

      <p className="hint" style={{ textAlign: "center", marginTop: 20 }}>
        Lock In Days · local-first · v0.1
      </p>
    </div>
  );
}
