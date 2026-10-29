import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Field, describedBy } from '@/components/common/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { homeFor } from '@/lib/permissions'
import { login } from '@/services/auth.service'
import { loginSchema, type LoginValues } from './schemas'

export function LoginForm() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { usuario: '', clave: '' } })

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    try {
      const { user } = await login(values.usuario, values.clave)
      toast.success(`Bienvenido, ${user.nomUser}`)
      navigate(homeFor(user.perfil), { replace: true })
    } catch (error) {
      const status = getErrorStatus(error)
      const message =
        status === 401 ? 'Usuario o clave incorrectos.' : status === 429 ? 'Demasiados intentos. Espera un minuto.' : getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Field id="usuario" label="Usuario" error={errors.usuario?.message}>
        <Input
          id="usuario"
          autoComplete="username"
          autoFocus
          placeholder="Nombre de usuario"
          className="h-9"
          aria-invalid={!!errors.usuario}
          aria-describedby={describedBy('usuario', errors.usuario?.message)}
          {...register('usuario')}
        />
      </Field>

      <Field id="clave" label="Clave" error={errors.clave?.message}>
        <div className="relative">
          <Input
            id="clave"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Clave"
            className="h-9 pr-10"
            aria-invalid={!!errors.clave}
            aria-describedby={describedBy('clave', errors.clave?.message)}
            {...register('clave')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-9 text-muted-foreground hover:bg-transparent"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="mt-1 w-full font-semibold" disabled={isSubmitting}>
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
