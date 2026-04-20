interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  gold?: boolean
}

export default function KpiCard({ label, value, sub, gold }: KpiCardProps) {
  return (
    <div
      className="card p-4 flex flex-col gap-1"
      style={gold ? { borderColor: '#D4AC0D', background: '#FFFBEA' } : undefined}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ color: '#1A2F45' }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: '#5D7A8A' }}>{sub}</p>}
    </div>
  )
}
