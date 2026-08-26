import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Bar, Producto, StockBodegaRow, TipoProducto } from '../lib/types'

export default function Traslado() {
  const { session } = useAuth()
  const [bares, setBares] = useState<Bar[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [tipo, setTipo] = useState<TipoProducto>('alcoholica')
  const [barId, setBarId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function cargar() {
    const [{ data: baresData }, { data: productosData }, { data: stockData }] = await Promise.all([
      supabase.from('bares').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('v_stock_bodega').select('*'),
    ])
    setBares(baresData ?? [])
    setProductos(productosData ?? [])
    setStockBodega(stockData ?? [])
    if (baresData && baresData.length > 0) setBarId((prev) => prev || baresData[0].id)
  }

  useEffect(() => {
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

  const stockDisponible = stockBodega.find((s) => s.producto_id === productoId)?.stock_bodega ?? 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barId || !productoId || cantidad <= 0) return
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('traslados').insert({
      bar_id: barId,
      producto_id: productoId,
      cantidad,
      usuario_id: session?.user.id,
    })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo guardar: ' + error.message })
    } else {
      setMsg({ type: 'success', text: 'Traslado registrado.' })
      setCantidad(1)
      cargar()
    }
  }

  return (
    <div>
      <h2>Trasladar a un bar</h2>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="bar">Bar destino</label>
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
          <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Stock en bodega: {stockDisponible}
          </div>
        </div>

        <div className="field">
          <label htmlFor="cantidad">Cantidad a trasladar</label>
          <div className="qty-stepper">
            <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
              −
            </button>
            <input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
            />
            <button type="button" onClick={() => setCantidad((c) => c + 1)}>
              +
            </button>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={saving || !barId || !productoId}>
          {saving ? 'Guardando...' : 'Guardar traslado'}
        </button>
      </form>
    </div>
  )
}
