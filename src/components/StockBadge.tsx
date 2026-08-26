export default function StockBadge({ value }: { value: number }) {
  if (value < 0) {
    return (
      <span style={{ color: 'var(--danger)', fontWeight: 700 }} title="El stock quedó negativo: revisá los movimientos, probablemente falta una entrada o hay un traslado de más.">
        ⚠️ {value} · revisar
      </span>
    )
  }
  if (value === 0) {
    return <span style={{ color: 'var(--text-muted)' }}>0 · agotado</span>
  }
  return <span>{value}</span>
}
