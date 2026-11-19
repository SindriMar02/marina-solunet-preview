export async function salesKit() {
  const response = await fetch(new URL('../data/tours.json', import.meta.url))
  if (!response.ok) throw new Error('catalogue_unavailable')
  const rows = await response.json()
  return new Map(rows.filter(row => row.protoId).map(row => [row.protoId, row]))
}
