import type { Recuperador, Reporte } from '@/types/api'
import type { PrefacturaPdfData } from './pdf'

/** jsPDF pesa bastante: se descarga solo cuando se genera el primer PDF. */
export async function makeCarnetPdf(recuperador: Recuperador): Promise<Blob> {
  return (await import('./pdf')).buildCarnetPdf(recuperador)
}

export async function makeComprobantePdf(reportes: Reporte[]): Promise<Blob> {
  const [{ buildComprobantePdf }, { loadLogo }] = await Promise.all([import('./pdf'), import('./logo')])
  return buildComprobantePdf(reportes, await loadLogo())
}

export async function makePrefacturaPdf(data: PrefacturaPdfData): Promise<Blob> {
  const [{ buildPrefacturaPdf }, { loadLogo }] = await Promise.all([import('./pdf'), import('./logo')])
  return buildPrefacturaPdf(data, await loadLogo())
}
