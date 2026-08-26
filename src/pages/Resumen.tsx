import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ResumenProductoRow, StockBarRow, StockBodegaRow } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

export default function Resumen() {
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [stockBares, setStockBares] = useState<StockBarRow[]>([])
  const [resumen, setResumen] = useState<ResumenProductoRow[]>([])
  const [loading, setLoading] = useState(true)

  async function cargar() {
    setLoading(true)
    const [{ data: bodega }, { data: bares }, { data: res }] = await Promise.all([
      supabase.from('v_stock_bodega').select('*').order('nombre'),
      supabase.from('v_stock_bares').select('*').order('bar_nombre'),
      supabase.from('v_resumen_producto').select('*').order('nombre'),
    ])
    setStockBodega(bodega ?? [])
    setStockBares(bares ?? [])
    setResumen(res ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const totales = useMemo(() => {
    const ingreso = resumen.reduce((acc, r) => acc + r.ingreso_total, 0)
    const costo = resumen.reduce((acc, r) => acc + r.costo_total, 0)
    const ganancia = ingreso - costo
    const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0
    return { ingreso, costo, ganancia, margen }
  }, [resumen])

  const baresAgrupados = useMemo(() => {
    const map = new Map<string, StockBarRow[]>()
    for (const row of stockBares) {
      const list = map.get(row.bar_nombre) ?? []
      list.push(row)
      map.set(row.bar_nombre, list)
    }
    return Array.from(map.entries())
  }, [stockBares])

  if (loading) return <div className="empty-state">Cargando resumen...</div>

  return (
    <div>
      <h2>Resumen del evento</h2>

      <div className="summary-grid">
        <div className="summary-tile">
          <div className="label">Ingreso total</div>
          <div className="value">₡{moneda.format(totales.ingreso)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Costo total</div>
          <div className="value">₡{moneda.format(totales.costo)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Ganancia neta</div>
          <div className={`value ${totales.ganancia >= 0 ? 'positive' : 'negative'}`}>
            ₡{moneda.format(totales.ganancia)}
          </div>
        </div>
        <div className="summary-tile">
          <div className="label">Margen promedio</div>
          <div className="value">{totales.margen.toFixed(1)}%</div>
        </div>
      </div>

      <div className="section-title">Stock en bodega central</div>
      <div className="card">
        {stockBodega.length === 0 ? (
          <div className="empty-state">Sin datos todavía.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {stockBodega.map((s) => (
                <tr key={s.producto_id}>
                  <td>{s.nombre}</td>
                  <td>{s.stock_bodega}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">Stock por bar</div>
      {baresAgrupados.length === 0 ? (
        <div className="card">
          <div className="empty-state">Todavía no hay traslados registrados.</div>
        </div>
      ) : (
        baresAgrupados.map(([nombreBar, filas]) => (
          <div className="card" key={nombreBar}>
            <strong>{nombreBar}</strong>
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.producto_id}>
                    <td>{f.producto_nombre}</td>
                    <td>{f.stock_bar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div className="section-title">Ventas por producto</div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Vendido</th>
              <th>Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={r.producto_id}>
                <td>{r.nombre}</td>
                <td>{r.total_vendido}</td>
                <td>₡{moneda.format(r.ganancia_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
