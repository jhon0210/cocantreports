import { z } from 'zod'

export const usuarioSchema = z.object({
  nomUser: z.string().trim().min(1, 'Ingresa el nombre').max(100, 'Máximo 100 caracteres'),
  apeUser: z.string().trim().min(1, 'Ingresa el apellido').max(100, 'Máximo 100 caracteres'),
  usuario: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,50}$/, 'Usa 3 a 50 caracteres: letras, números, punto, guion o guion bajo'),
  clave: z
    .string()
    .min(8, 'La clave debe tener al menos 8 caracteres')
    .max(72, 'La clave no puede superar 72 caracteres')
    .regex(/[a-z]/, 'Incluye al menos una minúscula')
    .regex(/[A-Z]/, 'Incluye al menos una mayúscula')
    .regex(/\d/, 'Incluye al menos un número'),
  cedula: z
    .string()
    .trim()
    .regex(/^\d{5,10}$/, 'La cédula debe tener entre 5 y 10 dígitos')
    .refine((v) => Number(v) <= 2_147_483_647, 'La cédula es demasiado grande'),
  id_perfil: z.string().min(1, 'Selecciona el perfil'),
  id_cargo: z.string(),
  id_eca: z.string(),
})

export type UsuarioValues = z.infer<typeof usuarioSchema>

export const editarUsuarioSchema = usuarioSchema.extend({
  clave: z.union([z.literal(''), usuarioSchema.shape.clave]),
})
