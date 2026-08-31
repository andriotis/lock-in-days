// Downscale a picked image file to a sensible size before we store it, so a
// 5 MB camera photo doesn't bloat IndexedDB. Returns a JPEG blob.
export async function fileToScaledBlob(
  file: Blob,
  maxDim = 1600,
  quality = 0.82
): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  return blob ?? file;
}
