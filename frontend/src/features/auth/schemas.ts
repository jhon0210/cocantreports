import { z } from 'zod'

export const loginSchema = z.object({
  usuario: z.string().trim().min(1, 'Ingresa tu usuario').max(50, 'Máximo 50 caracteres'),
  clave: z.string().min(1, 'Ingresa tu clave').max(72, 'Máximo 72 caracteres'),
})

export type LoginValues = z.infer<typeof loginSchema>
