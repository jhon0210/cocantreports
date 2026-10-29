import logoUrl from '@/assets/logo-in-situ-gahia.png'

export interface PdfLogo {
  dataUrl: string
  width: number
  height: number
}

let cached: Promise<PdfLogo | null> | null = null

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar el logo'))
    image.src = src
  })
}

/** Carga el logo recortando el espacio en blanco que lo rodea, para que ocupe bien el encabezado del PDF. */
async function readLogo(): Promise<PdfLogo> {
  const image = await loadImage(logoUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el logo')
  ctx.drawImage(image, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 16 && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < 0) return { dataUrl: canvas.toDataURL('image/png'), width, height }
  const crop = document.createElement('canvas')
  crop.width = maxX - minX + 1
  crop.height = maxY - minY + 1
  crop.getContext('2d')?.drawImage(canvas, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return { dataUrl: crop.toDataURL('image/png'), width: crop.width, height: crop.height }
}

/** Devuelve null si el logo no se puede cargar: el comprobante se genera igual, sin logo. */
export function loadLogo(): Promise<PdfLogo | null> {
  cached ??= readLogo().catch(() => {
    cached = null
    return null
  })
  return cached
}
