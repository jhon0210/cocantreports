import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Field, describedBy } from '@/components/common/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { recuperadoresService } from '@/services/recuperadores.service'
import type { Recuperador } from '@/types/api'
import { cedulaSchema, type CedulaValues } from './schemas'

interface BuscarRecuperadorCardProps {
  onFound: (recuperador: Recuperador) => void
  onNotFound: () => void
}

export function BuscarRecuperadorCard({ onFound, onNotFound }: BuscarRecuperadorCardProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CedulaValues>({ resolver: zodResolver(cedulaSchema), defaultValues: { cedula: '' } })

  const onSubmit = async ({ cedula }: CedulaValues) => {
    try {
      onFound(await recuperadoresService.getByCedula(cedula))
    } catch (error) {
      onNotFound()
      toast.error(
        getErrorStatus(error) === 404 ? `No se encontró un recuperador con la cédula ${cedula}.` : getErrorMessage(error),
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscar Recuperador</CardTitle>
        <CardDescription>Consulta al recuperador por su cédula antes de cargar la venta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Field id="cedula-busqueda" label="Cédula del recuperador" error={errors.cedula?.message} required>
              <Input
                id="cedula-busqueda"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej: 1090000001"
                aria-invalid={!!errors.cedula}
                aria-describedby={describedBy('cedula-busqueda', errors.cedula?.message)}
                {...register('cedula')}
              />
            </Field>
          </div>
          <Button type="submit" disabled={isSubmitting} className="sm:mt-[1.625rem]">
            <Search /> {isSubmitting ? 'Buscando…' : 'Buscar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
