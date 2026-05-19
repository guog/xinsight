export interface FilterableEndpoint {
  id: string
  name?: string
  path?: string
  method?: string
  description?: string
}

export function filterEndpoints<T extends FilterableEndpoint>(endpoints: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return endpoints
  return endpoints.filter(
    (ep) =>
      (ep.name ?? "").toLowerCase().includes(q) ||
      (ep.path ?? "").toLowerCase().includes(q) ||
      (ep.method ?? "").toLowerCase().includes(q) ||
      (ep.description ?? "").toLowerCase().includes(q),
  )
}
