import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { prepararEca, prepararRecuperador } from './archivos.service'

vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const pdf = btoa('%PDF-1.7\nsynthetic\n%%EOF')
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXp0AAAAASUVORK5CYII='

describe('transporte de archivos S3', () => {
  const fetchMock = vi.fn()
  const digestMock = vi.fn(async () => new Uint8Array(32).buffer)
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', { subtle: { digest: digestMock } })
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(api.get).mockResolvedValue({ data: { almacenamiento: 's3' } })
    vi.mocked(api.post).mockImplementation(async (path) => ({
      data: path === '/archivos/autorizar'
        ? { id: 'synthetic-id', url: 'https://storage.example.test', fields: { key: 'pendientes/synthetic-id' } }
        : { id: 'synthetic-id' },
    }))
    fetchMock.mockResolvedValue({ ok: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('conserva el modo BD sin subir archivos', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { almacenamiento: 'bd' } })
    const input = { nomEca: 'ECA', direccion: 'Calle', adjuntos: [{ nombre: 'a.pdf', contenido: pdf }] }
    expect(await prepararEca(input)).toBe(input)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('envia bytes directamente a S3 y deja solo referencias en el JSON', async () => {
    const input = { nomEca: 'ECA', direccion: 'Calle', adjuntos: [{ id: 8 }, { nombre: 'a.pdf', contenido: pdf }] }
    expect(await prepararEca(input)).toEqual({ ...input, adjuntos: [{ id: 8 }, { archivo_id: 'synthetic-id' }] })
    expect(api.post).toHaveBeenNthCalledWith(1, '/archivos/autorizar', expect.objectContaining({ uso: 'eca', mime: 'application/pdf', tamano: atob(pdf).length, sha256: expect.stringMatching(/^[A-Za-z0-9+/]{43}=$/) }))
    expect(fetchMock).toHaveBeenCalledWith('https://storage.example.test', expect.objectContaining({ method: 'POST', credentials: 'omit', body: expect.any(FormData) }))
    expect(api.post).toHaveBeenLastCalledWith('/archivos/synthetic-id/confirmar')
    expect(digestMock).toHaveBeenCalledWith('SHA-256', Uint8Array.from(atob(pdf), (char) => char.charCodeAt(0)))
    expect(input.adjuntos[1]).toHaveProperty('contenido', pdf)
  })

  it('reemplaza foto y documento sin enviar base64 al guardar', async () => {
    const result = await prepararRecuperador({
      nombre: 'Synthetic', foto: `data:image/png;base64,${png}`,
      documentos: [{ tipo: 'salud', nombre: 'salud.pdf', contenido: pdf }],
    })
    expect(result).toEqual({ nombre: 'Synthetic', foto_archivo_id: 'synthetic-id', documentos: [{ tipo: 'salud', archivo_id: 'synthetic-id' }] })
    expect(api.post).toHaveBeenCalledWith('/archivos/autorizar', expect.objectContaining({ uso: 'foto', mime: 'image/png', nombre: 'foto.png' }))
  })

  it('omite consultas y cargas cuando no hay archivos nuevos', async () => {
    const input = { nombre: 'Synthetic', documentos: [{ id: 9 }] }
    expect(await prepararRecuperador(input)).toBe(input)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('no oculta fallos ni cambia silenciosamente al modo BD', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(prepararEca({ nomEca: 'ECA', direccion: 'Calle', adjuntos: [{ nombre: 'a.pdf', contenido: pdf }] })).rejects.toThrow('403')
    expect(api.post).not.toHaveBeenCalledWith('/archivos/synthetic-id/confirmar')
  })

  it('propaga errores de confirmacion y configuracion', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(prepararRecuperador({ foto: `data:image/png;base64,${png}` })).rejects.toThrow('storage unavailable')
    vi.mocked(api.get).mockResolvedValue({ data: { almacenamiento: 'desconocido' } })
    await expect(prepararRecuperador({ foto: `data:image/png;base64,${png}` })).rejects.toThrow('Configuracion')
  })
})
