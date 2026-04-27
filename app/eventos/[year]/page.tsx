import EventosAnoClient from './EventosAnoClient'

export default async function EventosAnoPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params
  const ano = parseInt(year, 10)
  return <EventosAnoClient ano={ano} />
}
