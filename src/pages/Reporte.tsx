import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { generarExcel } from '../lib/exportExcel'
import StockBadge from '../components/StockBadge'
import Collapsible from '../components/Collapsible'
import type { ResumenBarRow, ResumenProductoRow, StockBodegaRow } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

export default function Reporte() {
  const navigate = useNavigate()
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [resumenBar, setResumenBar] = useState<ResumenBarRow[]>([])
  const [resumen, setResumen] = useState<ResumenProductoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [{ data: bodega }, { data: bares }, { data: res }] = await Promise.all([
        supabase.from('v_stock_bodega').select('*').order('nombre'),
        supabase.from('v_resumen_bar').select('*'),
        supabase.from('v_resumen_producto').select('*').order('nombre'),
      ])
      setStockBodega(bodega ?? [])
      setResumenBar(bares ?? [])
      setResumen(res ?? [])
      setLoading(false)
    }
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

  async function handleExportarExcel() {
    setExportando(true)
    try {
      await generarExcel({ stockBodega, resumenBar, resumen })
    } catch (e) {
      alert('No se pudo generar el Excel: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setExportando(false)
    }
  }

  if (loading) return <div className="empty-state">Cargando reporte...</div>

  return (
    <div className="reporte">
      <div className="reporte-actions no-print">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          ← Volver
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          🖨️ Guardar como PDF
        </button>
        <button className="btn-secondary" onClick={handleExportarExcel} disabled={exportando}>
          {exportando ? 'Generando...' : '📊 Descargar Excel'}
        </button>
      </div>

      <div className="reporte-band">
        <h1>🍻 Inventario Fiesta</h1>
        <p className="reporte-subtitulo">Reporte de cierre del evento</p>
        <p className="reporte-fecha">Generado el {new Date().toLocaleString('es-CR')}</p>
      </div>

      <div className="reporte-body">
        <div className="reporte-summary">
          <div className="reporte-tile">
            <span>Ingreso total</span>
            <strong>₡{moneda.format(totales.ingreso)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Costo total</span>
            <strong>₡{moneda.format(totales.costo)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Ganancia neta</span>
            <strong>₡{moneda.format(totales.ganancia)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Margen</span>
            <strong>{totales.margen.toFixed(1)}%</strong>
          </div>
        </div>

        <Collapsible title="📦 Stock en bodega central" subtitle={`${stockBodega.length} productos`}>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Entradas</th>
                <th>Trasladado</th>
                <th>Devuelto</th>
                <th>Stock actual</th>
              </tr>
            </thead>
            <tbody>
              {stockBodega.map((s) => (
                <tr key={s.producto_id}>
                  <td>{s.nombre}</td>
                  <td>{s.total_entradas}</td>
                  <td>{s.total_trasladado}</td>
                  <td>{s.total_devuelto}</td>
                  <td>
                    <StockBadge value={s.stock_bodega} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>

        <Collapsible title="🍻 Ventas por bar" subtitle={`${baresVenta.length} bares`}>
          {baresVenta.length === 0 ? (
            <p>Sin traslados registrados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bar</th>
                  <th>Vendido</th>
                  <th>Ingreso</th>
                  <th>Costo</th>
                  <th>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {baresVenta.map((b) => (
                  <tr key={b.bar_id}>
                    <td>{b.bar_nombre}</td>
                    <td>{b.total_vendido}</td>
                    <td>₡{moneda.format(b.ingreso_total)}</td>
                    <td>₡{moneda.format(b.costo_total)}</td>
                    <td>₡{moneda.format(b.ganancia_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Collapsible>

        {baresCortesia.length > 0 && (
          <Collapsible title="🎁 Cortesías / actividades especiales">
            <table>
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Entregado</th>
                  <th>Valor equivalente</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {baresCortesia.map((b) => (
                  <tr key={b.bar_id}>
                    <td>{b.bar_nombre}</td>
                    <td>{b.total_vendido}</td>
                    <td>₡{moneda.format(b.valor_equivalente_total)}</td>
                    <td>₡{moneda.format(b.costo_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="reporte-nota">
              No suma al ingreso ni a la ganancia del evento — es solo para saber cuánto se regaló
              y qué hubiera valido.
            </p>
          </Collapsible>
        )}

        <Collapsible title="🗂️ Ventas por producto" subtitle={`${resumen.length} productos`}>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Vendido</th>
                <th>Ingreso</th>
                <th>Costo</th>
                <th>Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.producto_id}>
                  <td>{r.nombre}</td>
                  <td>{r.total_vendido}</td>
                  <td>₡{moneda.format(r.ingreso_total)}</td>
                  <td>₡{moneda.format(r.costo_total)}</td>
                  <td>₡{moneda.format(r.ganancia_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>
      </div>
    </div>
  )
}
