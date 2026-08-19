/**
 * Cache en memoria con TTL para listados grandes (materia prima, proveedores).
 * Evita re-pedir todo al backend cada vez que se navega entre vistas.
 * Las mutaciones (create/update/delete) invalidan el cache correspondiente.
 */
const store = new Map<string, { data: unknown; expiresAt: number }>()

const DEFAULT_TTL_MS = 2 * 60 * 1000 // 2 minutos

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return undefined
  }
  return hit.data as T
}

export function cacheSet(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/** Invalida todas las entradas cuyo key empiece con el prefijo dado. */
export function cacheInvalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
