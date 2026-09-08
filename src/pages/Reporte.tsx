import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { generarExcel } from '../lib/exportExcel'
import type { ResumenBarRow, ResumenProductoRow, StockBodegaRow } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-CR')

function BarChart({
  title,
  unidad,
  datos,
}: {
  title: string
  unidad: 'money' | 'unidades'
  datos: { label: string; value: number }[]
}) {
  const max = Math.max(...datos.map((d) => d.value), 1)
  return (
    <>
      <h2>{title}</h2>
      {datos.length === 0 ? (
        <p>Sin datos.</p>
      ) : (
        <div className="chart-rows">
          {datos.map((d) => (
            <div className="chart-row" key={d.label}>
              <div className="chart-label">{d.label}</div>
              <div className="chart-track">
                <div
                  className="chart-bar"
                  style={{ width: `${Math.max((d.value / max) * 100, 1.5)}%` }}
                />
                <span className="chart-value">
                  {unidad === 'money' ? `₡${moneda.format(d.value)}` : numero.format(d.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

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

  const gananciaPorBar = useMemo(
    () =>
      baresVenta
        .map((b) => ({ label: b.bar_nombre, value: b.ganancia_total }))
        .sort((a, b) => b.value - a.value),
    [baresVenta]
  )

  const ingresoPorProducto = useMemo(
    () =>
      resumen
        .filter((r) => r.total_vendido > 0)
        .map((r) => ({ label: r.nombre, value: r.ingreso_total }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [resumen]
  )

  const stockActual = useMemo(
    () =>
      stockBodega
        .filter((s) => s.stock_bodega > 0)
        .map((s) => ({ label: s.nombre, value: s.stock_bodega }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [stockBodega]
  )

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

        <BarChart title="📦 Stock actual en bodega" unidad="unidades" datos={stockActual} />

        <BarChart title="🍻 Ganancia por bar" unidad="money" datos={gananciaPorBar} />

      {baresCortesia.length > 0 && (
        <>
          <h2>🎁 Cortesías / actividades especiales</h2>
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
            No suma al ingreso ni a la ganancia del evento — es solo para saber cuánto se regaló y
            qué hubiera valido.
          </p>
        </>
      )}

        <BarChart title="🗂️ Ingreso por producto (top 8)" unidad="money" datos={ingresoPorProducto} />

        <p className="reporte-nota">
          El detalle completo, producto por producto y movimiento por movimiento, está en el
          Excel descargable — este PDF es un resumen visual para revisar rápido.
        </p>
      </div>
    </div>
  )
}
