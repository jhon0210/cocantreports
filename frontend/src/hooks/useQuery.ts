import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '@/lib/errors'

export interface QueryResult<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Carga datos de una función asíncrona al montar y expone `reload`. Ignora respuestas de componentes desmontados. */
export function useQuery<T>(fetcher: () => Promise<T>, enabled = true): QueryResult<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  const mounted = useRef(true)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (mounted.current) setData(result)
    } catch (e) {
      if (mounted.current) setError(getErrorMessage(e, 'No se pudieron cargar los datos'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { data, loading, error, reload }
}
