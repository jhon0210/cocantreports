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

export const reporteSchema = z.object({
  id_eca_macroruta: z.string().optional(),
  id_mat: z.string().min(1, 'Selecciona el código del material'),
  id_eca: z.string().min(1, 'Selecciona la ECA donde vendió'),
  cantidad: z
    .number({ error: 'Ingresa la cantidad vendida' })
    .min(0, 'La cantidad debe ser mayor o igual que 0')
    .max(MAX_CANTIDAD, `La cantidad no puede superar ${MAX_CANTIDAD.toLocaleString('es-CO')} kg`),
  valor: z
    .number({ error: 'Ingresa el valor unitario' })
    .int('El valor debe ser un número entero')
    .positive('El valor debe ser mayor que 0')
    .max(MAX_VALOR, 'El valor es demasiado alto'),
  FechaVenta: z
    .string()
    .optional()
    .refine((v) => !v || v <= todayISO(), 'La fecha de venta no puede ser futura'),
})

export type ReporteValues = z.infer<typeof reporteSchema>
