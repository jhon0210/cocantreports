import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, fullName } from '@/lib/format'
import type { Recuperador } from '@/types/api'
import { calcularEdad } from './caracterizacion'

const EMPTY = '—'
const yesNo = (value: boolean | undefined): string => (value === undefined ? EMPTY : value ? 'Sí' : 'No')
const text = (value: string | number | undefined | null): string => (value === undefined || value === null || value === '' ? EMPTY : String(value))
const withDetail = (value: string | undefined, detail: string | undefined): string => (value && detail ? `${value}: ${detail}` : text(value))
const list = (items: string[] | undefined, other: string | undefined, otherKey: string): string => {
  if (!items?.length) return EMPTY
  return items.map((item) => (item === otherKey && other ? `${item}: ${other}` : item)).join(', ')
}

type Row = [label: string, value: string]

function sections(r: Recuperador): Array<[title: string, rows: Row[]]> {
  const c = r.caracterizacion ?? {}
  const edad = c.fecha_nacimiento ? calcularEdad(c.fecha_nacimiento) : null
  return [
    [
      '1. Información general del registro',
      [
        ['Fecha de inscripción', formatDate(c.fecha_inscripcion ?? r.FechaRegistro)],
        ['Lugar', text(c.lugar)],
        ['Código único de registro', text(r.codigo_registro)],
        ['Estado', r.estado],
        ['Organización', c.pertenece_organizacion ? [c.organizacion_nombre, c.organizacion_nit && `NIT ${c.organizacion_nit}`].filter(Boolean).join(' · ') : yesNo(c.pertenece_organizacion)],
      ],
    ],
    [
      '2. Identificación del reciclador de oficio',
      [
        ['Nombres y apellidos', fullName(r.nombre, r.apellido)],
        ['Tipo de documento', withDetail(c.tipo_documento, c.tipo_documento_otro)],
        ['Número de documento', r.cedula],
        ['Fecha de nacimiento', c.fecha_nacimiento ? `${formatDate(c.fecha_nacimiento)}${edad === null ? '' : ` (${edad} años)`}` : EMPTY],
        ['Género', text(c.genero)],
        ['Grupo sanguíneo / RH', text(c.rh)],
        ['Dirección de residencia', text(c.direccion)],
        ['Barrio / Vereda', text(c.barrio)],
        ['Comuna / Localidad', text(c.comuna)],
        ['Estrato', text(c.estrato)],
        ['Teléfono / Celular', text(c.telefono)],
      ],
    ],
    [
      '3. Caracterización socioeconómica y enfoque diferencial',
      [
        ['Estado civil', text(c.estado_civil)],
        ['Nivel educativo', text(c.nivel_educativo)],
        ['Pertenencia étnica', text(c.pertenencia_etnica)],
        ['Discapacidad', c.discapacidad ? withDetail('Sí', c.discapacidad_tipo) : yesNo(c.discapacidad)],
        ['Víctima del conflicto', c.victima_conflicto ? `Sí · RUV: ${yesNo(c.ruv)}` : yesNo(c.victima_conflicto)],
        ['Afiliación a salud', text(c.salud)],
        ['Bancarizado', yesNo(r.bancarizado)],
        [
          'Núcleo familiar',
          [
            ['Total', c.dependientes_total],
            ['Menores', c.dependientes_menores],
            ['Adultos mayores', c.dependientes_adultos_mayores],
            ['Con discapacidad', c.dependientes_discapacidad],
          ]
            .filter(([, n]) => n !== undefined)
            .map(([label, n]) => `${label}: ${n}`)
            .join(' · ') || EMPTY,
        ],
      ],
    ],
    [
      '4. Actividad de aprovechamiento',
      [
        ['Experiencia', c.experiencia_anios === undefined ? EMPTY : `${c.experiencia_anios} años`],
        ['Jornada habitual', text(c.jornada)],
        ['Lugar principal', text(c.lugar_recoleccion)],
        ['MicroRuta', text(c.microruta)],
        ['Dirección inicial', text(c.microruta_direccion_inicial)],
        ['Dirección final', text(c.microruta_direccion_final)],
        ['Transporte y herramientas', list(c.transporte, c.transporte_otro, 'Otro')],
        ['Uso de EPP', text(c.epp)],
        ['Materiales recuperados', list(c.materiales, c.materiales_otros, 'Otros')],
      ],
    ],
    ['5. Declaración y autorización', [['Autoriza el tratamiento de datos', yesNo(c.autoriza_datos)]]],
  ]
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="border-b border-dashed pb-2 text-sm font-semibold">{title}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

interface RecuperadorDetalleProps {
  recuperador: Recuperador | null
  onClose: () => void
}

/** Consulta, en solo lectura, de toda la información registrada del recuperador. */
export function RecuperadorDetalle({ recuperador, onClose }: RecuperadorDetalleProps) {
  return (
    <Dialog open={!!recuperador} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        {recuperador && (
          <>
            <DialogHeader className="pr-6">
              <DialogTitle>{fullName(recuperador.nombre, recuperador.apellido)}</DialogTitle>
              <DialogDescription>
                {recuperador.caracterizacion
                  ? 'Información del formato de inscripción y caracterización.'
                  : 'Registrado antes del formato de caracterización: edita al recuperador para completarlo.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5">
              {sections(recuperador).map(([title, rows]) => (
                <Section key={title} title={title}>
                  {rows.map(([label, value]) => (
                    <div key={label} className={value.length > 60 ? 'sm:col-span-2' : undefined}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium break-words">{value}</dd>
                    </div>
                  ))}
                </Section>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
