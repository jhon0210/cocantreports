/** Proporción 3:4 (vertical) y tamaño de la foto del carnet. Mantiene la imagen liviana (~30-60 KB). */
export const PHOTO_WIDTH = 360
export const PHOTO_HEIGHT = 480

/** Recorta al centro con proporción 3:4, reduce y exporta JPEG como data URL. */
export function toPhotoDataUrl(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): string {
  const targetRatio = PHOTO_WIDTH / PHOTO_HEIGHT
  let sw = sourceWidth
  let sh = sw / targetRatio
  if (sh > sourceHeight) {
    sh = sourceHeight
    sw = sh * targetRatio
  }
  const sx = (sourceWidth - sw) / 2
  const sy = (sourceHeight - sh) / 2

  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_WIDTH
  canvas.height = PHOTO_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function fileToPhotoDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Selecciona una imagen JPG, PNG o WebP')
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máx. 10 MB)')
  const bitmap = await createImageBitmap(file)
  try {
    return toPhotoDataUrl(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}
