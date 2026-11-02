import { act, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { LectorCodigoBarras } from './LectorCodigoBarras'

// Función simple (no vi.fn) para que vitest no registre como no manejada la promesa rechazada.
let respuesta: (codigo: string) => Promise<unknown> = () => Promise.resolve(null)
const consultas: string[] = []
vi.mock('@/services/recuperadores.service', () => ({
  recuperadoresService: { getByCodigo: (codigo: string) => { consultas.push(codigo); return respuesta(codigo) } },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const teclear = (texto: string) => {
  for (const key of texto) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}
const enter = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

describe('Lector de código de barras', () => {
  beforeEach(() => {
    consultas.length = 0
    respuesta = () => Promise.resolve(null)
  })

  it('consulta al recuperador al leer el código (ráfaga rápida + Enter)', async () => {
    const recuperador = { id_recuperador: 3 }
    respuesta = () => Promise.resolve(recuperador)
    const onFound = vi.fn()
    render(<LectorCodigoBarras onFound={onFound} onNotFound={vi.fn()} />)
    act(() => { teclear('48291037'); enter() })
    await waitFor(() => expect(onFound).toHaveBeenCalledWith(recuperador))
    expect(consultas).toEqual(['48291037'])
  })

  it('no consulta lo escrito lentamente a mano', () => {
    vi.useFakeTimers()
    try {
      render(<LectorCodigoBarras onFound={vi.fn()} onNotFound={vi.fn()} />)
      for (const key of '48291037') {
        act(() => { vi.advanceTimersByTime(300); window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })
      }
      act(() => { enter(); vi.advanceTimersByTime(500) })
      expect(consultas).toEqual([])
      expect(screen.getByTestId('lector-codigo-barras')).toHaveTextContent('Usa el lector')
    } finally {
      vi.useRealTimers()
    }
  })

  it('avisa cuando el código no corresponde a ningún recuperador', async () => {
    respuesta = () => Promise.reject(new AxiosError('No encontrado', 'ERR_BAD_REQUEST', undefined, undefined, { status: 404 } as AxiosResponse))
    const onNotFound = vi.fn()
    render(<LectorCodigoBarras onFound={vi.fn()} onNotFound={onNotFound} />)
    act(() => { teclear('99999999'); enter() })
    await waitFor(() => expect(onNotFound).toHaveBeenCalled())
    expect(screen.getByTestId('lector-codigo-barras')).toHaveTextContent('No hay un recuperador con el código 99999999')
  })
})
