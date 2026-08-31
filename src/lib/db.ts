// A tiny promise-based IndexedDB wrapper. Everything the app stores lives here,
// on-device, private to this browser. No server, no accounts.
//
// Object stores:
//   kv       -> generic key/value (app config lives under key "config")
//   habits   -> habit definitions            (keyPath: id)
//   logs     -> per-day data                 (keyPath: date)   { date, weight?, done{habitId:true} }
//   photos   -> progress photos as blobs      (keyPath: id)     { id, date, blob, w, h }

const DB_NAME = "lock-in-days";
const DB_VERSION = 1;

export interface Config {
  title: string;
  startDate: string; // DayKey
  endDate: string; // DayKey
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface DayLog {
  date: string; // DayKey (primary key)
  weight?: number; // stored in whatever unit `Config`-free; unit is a UI concern
  done: Record<string, boolean>; // habitId -> completed
}

export interface Photo {
  id: string;
  date: string; // DayKey
  blob: Blob;
  w: number;
  h: number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("habits"))
        db.createObjectStore("habits", { keyPath: "id" });
      if (!db.objectStoreNames.contains("logs"))
        db.createObjectStore("logs", { keyPath: "date" });
      if (!db.objectStoreNames.contains("photos")) {
        const s = db.createObjectStore("photos", { keyPath: "id" });
        s.createIndex("byDate", "date");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function getAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

// ---- Config ----------------------------------------------------------------

export function getConfig(): Promise<Config | undefined> {
  return tx<Config | undefined>("kv", "readonly", (s) => s.get("config"));
}

export async function setConfig(cfg: Config): Promise<void> {
  await tx("kv", "readwrite", (s) => s.put(cfg, "config"));
}

// ---- Wallpaper (personal background) ---------------------------------------

export function getWallpaper(): Promise<Blob | undefined> {
  return tx<Blob | undefined>("kv", "readonly", (s) => s.get("wallpaper"));
}

export async function setWallpaper(blob: Blob): Promise<void> {
  await tx("kv", "readwrite", (s) => s.put(blob, "wallpaper"));
}

export async function clearWallpaper(): Promise<void> {
  await tx("kv", "readwrite", (s) => s.delete("wallpaper"));
}

// ---- Habits ----------------------------------------------------------------

export function getHabits(): Promise<Habit[]> {
  return getAll<Habit>("habits").then((h) =>
    h.sort((a, b) => a.order - b.order)
  );
}

export async function putHabit(h: Habit): Promise<void> {
  await tx("habits", "readwrite", (s) => s.put(h));
}

export async function deleteHabit(id: string): Promise<void> {
  await tx("habits", "readwrite", (s) => s.delete(id));
}

// ---- Day logs --------------------------------------------------------------

export function getLogs(): Promise<DayLog[]> {
  return getAll<DayLog>("logs");
}

export function getLog(date: string): Promise<DayLog | undefined> {
  return tx<DayLog | undefined>("logs", "readonly", (s) => s.get(date));
}

export async function putLog(log: DayLog): Promise<void> {
  await tx("logs", "readwrite", (s) => s.put(log));
}

// ---- Photos ----------------------------------------------------------------

export function getPhotos(): Promise<Photo[]> {
  return getAll<Photo>("photos").then((p) =>
    p.sort((a, b) => a.createdAt - b.createdAt)
  );
}

export async function putPhoto(p: Photo): Promise<void> {
  await tx("photos", "readwrite", (s) => s.put(p));
}

export async function deletePhoto(id: string): Promise<void> {
  await tx("photos", "readwrite", (s) => s.delete(id));
}

// ---- Backup / restore ------------------------------------------------------

export interface Backup {
  version: number;
  exportedAt: string;
  config?: Config;
  wallpaper?: string; // data URL
  habits: Habit[];
  logs: DayLog[];
  photos: { id: string; date: string; createdAt: number; dataUrl: string }[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportBackup(): Promise<Backup> {
  const [config, wallpaper, habits, logs, photos] = await Promise.all([
    getConfig(),
    getWallpaper(),
    getHabits(),
    getLogs(),
    getPhotos(),
  ]);
  const encodedPhotos = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      date: p.date,
      createdAt: p.createdAt,
      dataUrl: await blobToDataUrl(p.blob),
    }))
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    config,
    wallpaper: wallpaper ? await blobToDataUrl(wallpaper) : undefined,
    habits,
    logs,
    photos: encodedPhotos,
  };
}

export async function importBackup(b: Backup): Promise<void> {
  if (b.config) await setConfig(b.config);
  if (b.wallpaper) await setWallpaper(await dataUrlToBlob(b.wallpaper));
  for (const h of b.habits ?? []) await putHabit(h);
  for (const l of b.logs ?? []) await putLog(l);
  for (const p of b.photos ?? []) {
    const blob = await dataUrlToBlob(p.dataUrl);
    const bmp = await createImageBitmap(blob).catch(() => null);
    await putPhoto({
      id: p.id,
      date: p.date,
      blob,
      w: bmp?.width ?? 0,
      h: bmp?.height ?? 0,
      createdAt: p.createdAt,
    });
    bmp?.close();
  }
}
