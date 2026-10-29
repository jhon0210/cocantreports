import { Recycle } from 'lucide-react'

export function HomePage() {
  return (
    <section aria-label="Bienvenido a Cocjant" className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-5 py-4">
      <div className="flex w-full max-w-3xl flex-col items-center px-4 text-center">
        <span className="mb-7 flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/10 sm:size-28">
          <Recycle className="size-12 sm:size-14" aria-hidden="true" />
        </span>
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-primary sm:text-4xl">CORPORACIÓN CIVICA JUVENTUDES DE ANTIOQUIA</h1>
        <p className="mt-5 text-lg font-medium text-foreground sm:text-xl">Porque amamos la vida, defendemos la paz</p>
        <p className="mt-3 text-base font-semibold text-muted-foreground sm:text-lg">NIT 811.010.632 - 6</p>
      </div>
    </section>
  )
}
