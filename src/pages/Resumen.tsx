import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Collapsible from '../components/Collapsible'
import Modal from '../components/Modal'
import StockBadge from '../components/StockBadge'
import type { MovimientoBarRow, ResumenBarRow, ResumenProductoRow, StockBodegaRow } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

export default function Resumen() {
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [resumenBar, setResumenBar] = useState<ResumenBarRow[]>([])
  const [movimientosBar, setMovimientosBar] = useState<MovimientoBarRow[]>([])
  const [resumen, setResumen] = useState<ResumenProductoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [barDetalle, setBarDetalle] = useState<{
    id: string
    nombre: string
    esCortesia: boolean
  } | null>(null)

  async function cargar() {
    setLoading(true)
    const [{ data: bodega }, { data: bares }, { data: movs }, { data: res }] = await Promise.all([
      supabase.from('v_stock_bodega').select('*').order('nombre'),
      supabase.from('v_resumen_bar').select('*'),
      supabase.from('v_movimientos_bar').select('*').order('producto_nombre'),
      supabase.from('v_resumen_producto').select('*').order('nombre'),
    ])
    setStockBodega(bodega ?? [])
    setResumenBar(bares ?? [])
    setMovimientosBar(movs ?? [])
    setResumen(res ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const baresVenta = useMemo(
    () => resumenBar.filter((b) => !b.es_cortesia).sort((a, b) => b.ingreso_total - a.ingreso_total),
    [resumenBar]
  )
  const baresCortesia = useMemo(() => resumenBar.filter((b) => b.es_cortesia), [resumenBar])

  const totales = useMemo(() => {
    const ingreso = resumen.reduce((acc, r) => acc + r.ingreso_total, 0)
    const costo = resumen.reduce((acc, r) => acc + r.costo_total, 0)
    const ganancia = ingreso - costo
    const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0
    return { ingreso, costo, ganancia, margen }
  }, [resumen])

  const valorRegaladoTotal = useMemo(
    () => baresCortesia.reduce((acc, b) => acc + b.valor_equivalente_total, 0),
    [baresCortesia]
  )

  const detalleFiltrado = useMemo(
    () => (barDetalle ? movimientosBar.filter((m) => m.bar_id === barDetalle.id) : []),
    [movimientosBar, barDetalle]
  )

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
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>
        El costo incluye todo lo consumido (venta y cortesías); el ingreso solo cuenta lo vendido de
        verdad, sin las cortesías.
      </div>

      <Collapsible title="📦 Stock en bodega central" subtitle={`${stockBodega.length} productos`}>
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
                  <td>
                    <StockBadge value={s.stock_bodega} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Collapsible>

      <Collapsible title="🍻 Ventas por bar" subtitle={`${baresVenta.length} bares`}>
        {baresVenta.length === 0 ? (
          <div className="empty-state">Todavía no hay traslados registrados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bar</th>
                <th>Vendido</th>
                <th>Ingreso</th>
                <th>Ganancia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {baresVenta.map((b) => (
                <tr key={b.bar_id}>
                  <td>{b.bar_nombre}</td>
                  <td>{b.total_vendido}</td>
                  <td>₡{moneda.format(b.ingreso_total)}</td>
                  <td>₡{moneda.format(b.ganancia_total)}</td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setBarDetalle({ id: b.bar_id, nombre: b.bar_nombre, esCortesia: false })
                      }
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Collapsible>

      {baresCortesia.length > 0 && (
        <Collapsible
          title="🎁 Cortesías / actividades especiales"
          subtitle={`₡${moneda.format(valorRegaladoTotal)} regalado`}
        >
          <table>
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Entregado</th>
                <th>Valor equivalente</th>
                <th>Costo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {baresCortesia.map((b) => (
                <tr key={b.bar_id}>
                  <td>{b.bar_nombre}</td>
                  <td>{b.total_vendido}</td>
                  <td>₡{moneda.format(b.valor_equivalente_total)}</td>
                  <td>₡{moneda.format(b.costo_total)}</td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setBarDetalle({ id: b.bar_id, nombre: b.bar_nombre, esCortesia: true })
                      }
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
            No suma al ingreso ni a la ganancia del evento — es solo para saber cuánto se regaló y
            qué hubiera valido.
          </div>
        </Collapsible>
      )}

      <Collapsible title="🗂️ Ventas por producto" subtitle={`${resumen.length} productos`}>
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
      </Collapsible>

      {barDetalle && (
        <Modal title={`Detalle · ${barDetalle.nombre}`} onClose={() => setBarDetalle(null)}>
          {detalleFiltrado.length === 0 ? (
            <div className="empty-state">Todavía no hay movimientos en este bar.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Trasladado</th>
                  <th>Devuelto</th>
                  <th>Vendido</th>
                  <th>{barDetalle.esCortesia ? 'Valor equiv.' : 'Ingreso'}</th>
                </tr>
              </thead>
              <tbody>
                {detalleFiltrado.map((m) => (
                  <tr key={m.producto_id}>
                    <td>{m.producto_nombre}</td>
                    <td>{m.total_trasladado}</td>
                    <td>{m.total_devuelto}</td>
                    <td>
                      <StockBadge value={m.vendido} />
                    </td>
                    <td>₡{moneda.format(m.es_cortesia ? m.valor_equivalente : m.ingreso)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>Total</td>
                  <td>
                    ₡
                    {moneda.format(
                      detalleFiltrado.reduce(
                        (acc, m) => acc + (m.es_cortesia ? m.valor_equivalente : m.ingreso),
                        0
                      )
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  )
}
