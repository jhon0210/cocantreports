import { z } from 'zod'
import { todayISO } from '@/lib/format'

export const MAX_CANTIDAD = 1_000_000
export const MAX_VALOR = 100_000_000

export const cedulaSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(1, 'Ingresa la cédula')
    .regex(/^\d+$/, 'La cédula solo debe contener números')
    .min(5, 'La cédula debe tener al menos 5 dígitos')
    .max(15, 'La cédula no puede superar 15 dígitos'),
})

export type CedulaValues = z.infer<typeof cedulaSchema>

export const reporteSchema = z
  .object({
    tipo: z.enum(['VENTA', 'RECHAZO']).optional(),
    id_eca_macroruta: z.string().optional(),
    id_mat: z.string().min(1, 'Selecciona el código del material'),
    id_eca: z.string().min(1, 'Selecciona la ECA donde vendió'),
    cantidad: z
      .number({ error: 'Ingresa la cantidad vendida' })
      .min(0, 'La cantidad debe ser mayor o igual que 0')
      .max(MAX_CANTIDAD, `La cantidad no puede superar ${MAX_CANTIDAD.toLocaleString('es-CO')} kg`)
      .optional(),
    valor: z
      .number({ error: 'Ingresa el valor unitario' })
      .int('El valor debe ser un número entero')
      .positive('El valor debe ser mayor que 0')
      .max(MAX_VALOR, 'El valor es demasiado alto')
      .optional(),
    rechazo_kg: z
      .number({ error: 'Ingresa la cantidad rechazada' })
      .positive('La cantidad rechazada debe ser mayor que 0')
      .max(MAX_CANTIDAD, `La cantidad no puede superar ${MAX_CANTIDAD.toLocaleString('es-CO')} kg`)
      .optional(),
    FechaVenta: z
      .string()
      .optional()
      .refine((v) => !v || v <= todayISO(), 'La fecha de venta no puede ser futura'),
  })
  .superRefine((v, ctx) => {
    const faltante = (path: 'cantidad' | 'valor' | 'rechazo_kg', message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.tipo === 'RECHAZO') {
      if (v.rechazo_kg === undefined) faltante('rechazo_kg', 'Ingresa la cantidad rechazada')
      return
    }
    if (v.cantidad === undefined) faltante('cantidad', 'Ingresa la cantidad vendida')
    if (v.valor === undefined) faltante('valor', 'Ingresa el valor unitario')
  })

export type ReporteValues = z.infer<typeof reporteSchema>

export const esRechazo = (v: Pick<ReporteValues, 'tipo'>): boolean => v.tipo === 'RECHAZO'
