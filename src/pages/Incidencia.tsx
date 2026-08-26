import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Bar, MotivoIncidencia, Producto, TipoProducto } from '../lib/types'

const MOTIVOS: MotivoIncidencia[] = ['Rotura', 'Pérdida', 'Cortesía', 'Otro']

export default function Incidencia() {
  const { session } = useAuth()
  const [bares, setBares] = useState<Bar[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tipo, setTipo] = useState<TipoProducto>('alcoholica')
  const [barId, setBarId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState<MotivoIncidencia>(MOTIVOS[0])
  const [observaciones, setObservaciones] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [{ data: baresData }, { data: productosData }] = await Promise.all([
        supabase.from('bares').select('*').eq('activo', true).order('nombre'),
        supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      ])
      setBares(baresData ?? [])
      setProductos(productosData ?? [])
      if (baresData && baresData.length > 0) setBarId(baresData[0].id)
    }
    cargar()
  }, [])

  const productosFiltrados = useMemo(
    () => productos.filter((p) => p.tipo === tipo),
    [productos, tipo]
  )

  useEffect(() => {
    if (productosFiltrados.length > 0 && !productosFiltrados.some((p) => p.id === productoId)) {
      setProductoId(productosFiltrados[0].id)
    }
  }, [productosFiltrados, productoId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barId || !productoId || cantidad <= 0) return
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('incidencias').insert({
      bar_id: barId,
      producto_id: productoId,
      cantidad,
      motivo,
      observaciones: observaciones || null,
      usuario_id: session?.user.id,
    })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo guardar: ' + error.message })
    } else {
      setMsg({ type: 'success', text: 'Incidencia registrada.' })
      setCantidad(1)
      setObservaciones('')
    }
  }

  return (
    <div>
      <h2>Reportar incidencia</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -8 }}>
        Solo para casos puntuales: se rompió, se perdió, o se regaló suelto en un bar que
        normalmente sí vende. No hace falta anotar cada trago vendido — eso se calcula solo con
        el traslado y la devolución final.
      </p>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="bar">Bar</label>
          <select id="bar" value={barId} onChange={(e) => setBarId(e.target.value)} required>
            {bares.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="type-toggle">
          <button
            type="button"
            className={tipo === 'alcoholica' ? 'active' : ''}
            onClick={() => setTipo('alcoholica')}
          >
            🍺 Alcohólica
          </button>
          <button
            type="button"
            className={tipo === 'sin_alcohol' ? 'active' : ''}
            onClick={() => setTipo('sin_alcohol')}
          >
            🥤 Sin alcohol
          </button>
        </div>

        <div className="field">
          <label htmlFor="producto">Producto</label>
          <select
            id="producto"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            required
          >
            {productosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="cantidad">Cantidad</label>
          <div className="qty-stepper">
            <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
              −
            </button>
            <input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad === 0 ? '' : cantidad}
              onChange={(e) => {
                const v = e.target.value
                setCantidad(v === '' ? 0 : Math.max(0, Math.trunc(Number(v)) || 0))
              }}
              onBlur={() => setCantidad((c) => (c <= 0 ? 1 : c))}
            />
            <button type="button" onClick={() => setCantidad((c) => c + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="motivo">Motivo</label>
          <select
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoIncidencia)}
          >
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="observaciones">Observaciones (opcional)</label>
          <textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <button
          className="btn-primary"
          type="submit"
          disabled={saving || !barId || !productoId || cantidad <= 0}
        >
          {saving ? 'Guardando...' : 'Guardar incidencia'}
        </button>
      </form>
    </div>
  )
}
