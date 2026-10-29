import logoCocjant from '@/assets/logo-cocjant.png'
import logoGahia from '@/assets/logo-in-situ-gahia.png'
import { fullName, initials } from '@/lib/format'
import type { Recuperador } from '@/types/api'

const WIDTH = 1000
const HEIGHT = 1540
const DARK = '#002e24'
const GREEN = '#00693e'
const GOLD = '#b7a522'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar una imagen del carnet. Intenta generarlo de nuevo.'))
    image.src = src
  })
}

/** Solo se recorta el emblema de cada logo, pues el texto institucional va en el centro del carnet. */
function emblem(image: HTMLImageElement, x: number, y: number, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el logo del carnet')
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] > 245 && pixels.data[i + 1] > 245 && pixels.data[i + 2] > 245) pixels.data[i + 3] = 0
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

function pattern(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 14
  for (let row = -1; row < 7; row++) {
    for (let column = -1; column < 5; column++) {
      ctx.save()
      ctx.translate(column * 290 + (row % 2) * 95, row * 260)
      ctx.rotate(((column + row) % 4) * Math.PI / 2 + Math.PI / 12)
      for (let offset = 0; offset < 130; offset += 35) {
        ctx.beginPath()
        ctx.moveTo(-135 + offset, 170 - offset)
        ctx.lineTo(-135 + offset, -130 + offset)
        ctx.lineTo(155 - offset, -130 + offset)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

export async function renderCarnet(r: Recuperador): Promise<HTMLCanvasElement> {
  const [cocjant, gahia, foto] = await Promise.all([
    loadImage(logoCocjant),
    loadImage(logoGahia),
    r.foto ? loadImage(r.foto) : Promise.resolve(null),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo dibujar el carnet')

  const shape = (path: string, color: string) => {
    ctx.fillStyle = color
    ctx.fill(new Path2D(path))
  }
  const text = (
    value: string,
    y: number,
    size: number,
    color: string,
    maxWidth = 900,
    font = 'Arial',
    x = WIDTH / 2,
    style: { weight?: 'normal' | 'bold'; outline?: string; outlineWidth?: number } = {},
  ) => {
    ctx.save()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    let fitted = size
    const weight = style.weight ?? 'bold'
    ctx.font = `${weight} ${fitted}px "${font}"`
    while (ctx.measureText(value).width > maxWidth && fitted > 10) {
      fitted--
      ctx.font = `${weight} ${fitted}px "${font}"`
    }
    if (style.outline) {
      ctx.strokeStyle = style.outline
      ctx.lineWidth = style.outlineWidth ?? 4
      ctx.lineJoin = 'round'
      ctx.strokeText(value, x, y)
    }
    ctx.fillText(value, x, y)
    ctx.restore()
  }

  ctx.fillStyle = DARK
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  shape('M0 1140 Q110 1450 370 1540 H0 Z', GOLD)
  shape('M0 1490 Q640 1620 1000 1330 V1540 H0 Z', GREEN)

  const white = new Path2D('M0 450 Q500 900 1000 600 V1040 Q840 1410 500 1390 Q160 1370 0 1110 Z')
  ctx.fillStyle = '#ffffff'
  ctx.fill(white)
  ctx.save()
  ctx.clip(white)
  pattern(ctx, '#ededed')
  ctx.restore()

  shape('M0 0 H1000 V725 Q530 1070 150 695 Q40 590 0 450 Z', GREEN)
  shape('M625 760 Q870 645 1000 370 V650 Q820 770 625 760 Z', GOLD)
  const top = new Path2D('M0 0 H1000 V400 Q850 750 600 830 Q200 940 0 450 Z')
  ctx.fillStyle = DARK
  ctx.fill(top)
  ctx.save()
  ctx.clip(top)
  pattern(ctx, '#00977d')
  ctx.restore()

  ctx.save()
  ctx.shadowColor = '#64736c'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 5
  ctx.shadowOffsetY = 6
  text('PROYECTO', 165, 80, '#ffffff', 660, 'Arial', WIDTH / 2, { outline: '#c1ccc6', outlineWidth: 5 })
  text('IN SITU GAHIA', 267, 122, '#ffffff', 920, 'Arial', WIDTH / 2, { outline: '#c1ccc6', outlineWidth: 5 })
  ctx.restore()

  const photoX = 500
  const photoY = 582
  const radius = 262
  ctx.save()
  ctx.beginPath()
  ctx.arc(photoX, photoY, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#e7eee9'
  ctx.fillRect(photoX - radius, photoY - radius, radius * 2, radius * 2)
  if (foto) {
    const side = Math.min(foto.naturalWidth, foto.naturalHeight)
    ctx.drawImage(foto, (foto.naturalWidth - side) / 2, (foto.naturalHeight - side) / 2, side, side, photoX - radius, photoY - radius, radius * 2, radius * 2)
  } else {
    text(initials(r.nombre, r.apellido), photoY + 50, 140, GREEN, 420)
  }
  ctx.restore()

  ctx.drawImage(emblem(cocjant, 140, 45, 360, 355), 60, 860, 190, 188)
  ctx.drawImage(emblem(gahia, 145, 45, 355, 490), 772, 845, 180, 248)
  text('Corporación Cívica', 946, 46, GREEN, 510, 'Arial', 510)
  text('Juventudes de Antioquia', 992, 46, GREEN, 510, 'Arial', 510)
  text('-ESP-', 1042, 47, GREEN)
  text('"Porque amamos la vida, defendemos la paz"', 1082, 23, '#222222', 535)
  text('Nit. 811.010.632 - 6', 1111, 25, '#222222')

  text(fullName(r.nombre, r.apellido).toUpperCase(), 1157, 47, GREEN, 900, 'Arial')
  ctx.fillStyle = GOLD
  ctx.fillRect(130, 1180, 740, 9)
  text('OPERARIO RECICLADOR', 1246, 52, '#111111', 850, 'Arial Narrow', WIDTH / 2, { weight: 'normal' })
  const tipo = r.caracterizacion?.tipo_documento
  const tipoLabel = tipo === 'CC' ? 'C.C.' : tipo === 'Otro' ? r.caracterizacion?.tipo_documento_otro ?? 'Documento' : tipo ?? 'Documento'
  const documento = r.cedula.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  text(`${tipoLabel}: ${documento}`, 1307, 43, GREEN, 880)
  text(`RH: ${r.caracterizacion?.rh ?? 'No registrado'}`, 1356, 39, GREEN, 880)
  text('-ARRI-', 1435, 47, '#ffffff', 850, 'Impact')
  text('ASOCIACIÓN DE RECICLADORES Y RECUPERADORES INFORMALES', 1480, 32, '#ffffff', 900, 'Arial Narrow', WIDTH / 2, { outline: '#34866b', outlineWidth: 7 })
  return canvas
}
