import { useRef } from "react";
import { fileToScaledBlob } from "../lib/image";

/**
 * Lets the user pick a personal background photo. The parent owns the current
 * wallpaper (as an object URL for preview) and receives a processed Blob to
 * store, or null to clear.
 */
export default function WallpaperPicker({
  previewUrl,
  onPick,
  onClear,
}: {
  previewUrl: string | null;
  onPick: (blob: Blob) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    const blob = await fileToScaledBlob(file);
    onPick(blob);
  }

  return (
    <div className="wall-picker">
      <button
        type="button"
        className="wall-drop"
        onClick={() => fileRef.current?.click()}
        style={
          previewUrl
            ? { backgroundImage: `url(${previewUrl})` }
            : undefined
        }
      >
        {!previewUrl && (
          <span className="wall-drop-label">
            <PhotoGlyph />
            Add a background photo
          </span>
        )}
        {previewUrl && <span className="wall-drop-change">Change</span>}
      </button>

      {previewUrl && (
        <button type="button" className="btn ghost sm" onClick={onClear}>
          Remove background
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  );
}

function PhotoGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M21 16l-5-5-4 4-2-2-7 7" />
    </svg>
  );
}
