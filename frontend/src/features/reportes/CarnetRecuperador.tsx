import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { fullName, initials } from '@/lib/format'
import { ESTADO_ACTIVO, type Recuperador } from '@/types/api'

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-[0.9rem] font-medium">{children}</dd>
    </div>
  )
}

function FechaHoraActual() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <time dateTime={now.toISOString()}>{now.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' })}</time>
}

/** Información del recuperador: avatar a la izquierda (foto o iniciales) y datos a la derecha. */
export function CarnetRecuperador({ recuperador: r, eca, macroruta }: { recuperador: Recuperador; eca?: ReactNode; macroruta?: ReactNode }) {
  return (
    <Card className="animate-fade-in overflow-hidden border-primary/30" aria-label={`Carnet de ${fullName(r.nombre, r.apellido)}`}>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex justify-center sm:justify-start">
          <Avatar className="size-20 border-2 border-primary/20 sm:size-24">
            {r.foto && <AvatarImage src={r.foto} alt={`Foto de ${fullName(r.nombre, r.apellido)}`} />}
            <AvatarFallback className="bg-secondary text-2xl font-semibold text-secondary-foreground" aria-label="Sin foto, se muestran las iniciales">
              {initials(r.nombre, r.apellido)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="grid gap-4">
          <Badge className="w-fit tracking-wide">INFORMACIÓN DEL RECUPERADOR</Badge>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
            <Item label="Nombre">{r.nombre}</Item>
            <Item label="Apellido">{r.apellido}</Item>
            <Item label="Cédula">{r.cedula}</Item>
            <Item label="Bancarizado">
              <Badge variant={r.bancarizado ? 'default' : 'outline'}>{r.bancarizado ? 'Sí' : 'No'}</Badge>
            </Item>
            <Item label="Estado">
              <Badge variant={r.estado === ESTADO_ACTIVO ? 'default' : r.estado === 'Fallecido' ? 'destructive' : 'outline'}>{r.estado}</Badge>
            </Item>
            {eca !== undefined && <Item label="ECA">{eca}</Item>}
            {macroruta !== undefined && <Item label="Código y nombre de macroruta">{macroruta}</Item>}
            <Item label="Fecha y hora"><FechaHoraActual /></Item>
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}
