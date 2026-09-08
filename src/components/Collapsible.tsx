import { useState, type ReactNode } from 'react'

export default function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapsible">
      <button className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {subtitle && <span className="collapsible-subtitle">{subtitle}</span>}
          <span className="collapsible-chevron">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      <div className="collapsible-body" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
