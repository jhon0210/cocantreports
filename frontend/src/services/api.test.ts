import type { InternalAxiosRequestConfig } from 'axios'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthResponse, Usuario } from '@/types/api'

const user: Usuario = {
  id_user: 1, nomUser: 'Olga', apeUser: 'Op', usuario: 'operario1', cedula: 1, id_perfil: 3, perfil: 'Operario', id_cargo: 1, cargo: 'c', id_eca: null, eca: null, activo: true,
}

const authResponse = (token: string): AuthResponse => ({ access_token: token, token_type: 'Bearer', expires_in: 900, user })

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response = { data, status, statusText: String(status), headers: {}, config }
  return status >= 200 && status < 300
    ? Promise.resolve(response)
    : Promise.reject(Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, config, response }))
}

describe('interceptor de Axios', () => {
  const calls: Array<{ url: string; auth?: string }> = []
  const originalAdapter = api.defaults.adapter

  beforeEach(() => {
    calls.length = 0
    useAuthStore.setState({ status: 'authenticated', accessToken: 'viejo', user })
  })

  afterAll(() => {
    api.defaults.adapter = originalAdapter
  })

  it('adjunta el access token a cada petición', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: config.headers.get('Authorization') as string })
      return reply(config, 200, [])
    }
    await api.get('/materiales')
    expect(calls[0].auth).toBe('Bearer viejo')
  })

  it('ante un 401 hace refresh una sola vez y reintenta con el nuevo token', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: config.headers.get('Authorization') as string })
      if (config.url === '/auth/refresh') return reply(config, 200, authResponse('nuevo'))
      return config.headers.get('Authorization') === 'Bearer nuevo' ? reply(config, 200, ['ok']) : reply(config, 401)
    }
    const res = await api.get('/reportes')
    expect(res.data).toEqual(['ok'])
    expect(calls.map((c) => c.url)).toEqual(['/reportes', '/auth/refresh', '/reportes'])
    expect(useAuthStore.getState().accessToken).toBe('nuevo')
  })

  it('peticiones simultáneas con 401 comparten un único refresh', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: config.headers.get('Authorization') as string })
      if (config.url === '/auth/refresh') return reply(config, 200, authResponse('nuevo'))
      return config.headers.get('Authorization') === 'Bearer nuevo' ? reply(config, 200, []) : reply(config, 401)
    }
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1)
  })

  it('si el refresh falla cierra la sesión y no entra en bucle', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: config.headers.get('Authorization') as string })
      return reply(config, 401)
    }
    await expect(api.get('/reportes')).rejects.toBeDefined()
    expect(calls.map((c) => c.url)).toEqual(['/reportes', '/auth/refresh'])
    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('un 401 en el login no intenta refresh', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: undefined })
      return reply(config, 401)
    }
    await expect(api.post('/auth/login', {})).rejects.toBeDefined()
    expect(calls).toHaveLength(1)
  })

  it('no reintenta más de una vez la misma petición', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ url: config.url!, auth: undefined })
      return config.url === '/auth/refresh' ? reply(config, 200, authResponse('nuevo')) : reply(config, 401)
    }
    await expect(api.get('/reportes')).rejects.toBeDefined()
    expect(calls.filter((c) => c.url === '/reportes')).toHaveLength(2)
  })
})
