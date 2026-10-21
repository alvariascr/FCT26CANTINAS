import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { generarExcel } from '../lib/exportExcel'
import StockBadge from '../components/StockBadge'
import Collapsible from '../components/Collapsible'
import type {
  MovimientoBarRow,
  Producto,
  ResumenBarRow,
  ResumenProductoRow,
  StockBodegaRow,
  Gasto,
} from '../lib/types'
import { formatoEmpaque, resumenEmpaques, unidadesYEmpaque } from '../lib/formatoEmpaque'

const moneda = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Reporte() {
  const navigate = useNavigate()
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [resumenBar, setResumenBar] = useState<ResumenBarRow[]>([])
  const [resumen, setResumen] = useState<ResumenProductoRow[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoBarRow[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [barrasSel, setBarrasSel] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [
        { data: bodega },
        { data: bares },
        { data: res },
        { data: prods },
        { data: movs },
        { data: gastosData },
      ] = await Promise.all([
        supabase.from('v_stock_bodega').select('*').order('nombre'),
        supabase.from('v_resumen_bar').select('*'),
        supabase.from('v_resumen_producto').select('*').order('nombre'),
        supabase.from('productos').select('*'),
        supabase.from('v_movimientos_bar').select('*'),
        supabase.from('gastos').select('*').order('creado_en'),
      ])
      setGastos(gastosData ?? [])
      setStockBodega(bodega ?? [])
      setResumenBar(bares ?? [])
      setResumen(res ?? [])
      setProductos(prods ?? [])
      setMovimientos(movs ?? [])
      setBarrasSel((bares ?? []).map((b: ResumenBarRow) => b.bar_id))
      setLoading(false)
    }
    cargar()
  }, [])

  const todasSeleccionadas = barrasSel.length === resumenBar.length
  const resumenBarFiltrado = useMemo(
    () => resumenBar.filter((b) => barrasSel.includes(b.bar_id)),
    [resumenBar, barrasSel]
  )
  const nombresSeleccionados = resumenBarFiltrado.map((b) => b.bar_nombre)

  const resumenFiltrado = useMemo(() => {
    if (todasSeleccionadas) return resumen
    const mapa = new Map<string, ResumenProductoRow>()
    for (const m of movimientos) {
      if (!barrasSel.includes(m.bar_id)) continue
      const fila = mapa.get(m.producto_id) ?? {
        producto_id: m.producto_id,
        nombre: m.producto_nombre,
        tipo: m.tipo,
        costo_compra: m.costo_compra,
        precio_venta_porcion: m.precio_venta_porcion,
        total_entradas: 0,
        total_vendido: 0,
        costo_total: 0,
        ingreso_total: 0,
        ganancia_total: 0,
      }
      fila.total_vendido += m.vendido
      fila.costo_total += m.costo
      fila.ingreso_total += m.ingreso
      fila.ganancia_total = fila.ingreso_total - fila.costo_total
      mapa.set(m.producto_id, fila)
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [todasSeleccionadas, resumen, movimientos, barrasSel])

  function alternarBar(id: string) {
    setBarrasSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function vendidoEmpaques(barId: string) {
    return resumenEmpaques(
      movimientos.filter((m) => m.bar_id === barId),
      productos
    )
  }

  const baresVenta = useMemo(
    () =>
      resumenBarFiltrado
        .filter((b) => !b.es_cortesia)
        .sort((a, b) => b.ingreso_total - a.ingreso_total),
    [resumenBarFiltrado]
  )
  const baresCortesia = useMemo(
    () => resumenBarFiltrado.filter((b) => b.es_cortesia),
    [resumenBarFiltrado]
  )

  // Los gastos son del evento completo: solo cuentan cuando el reporte incluye todas las actividades.
  const totalGastos = useMemo(
    () => (todasSeleccionadas ? gastos.reduce((acc, g) => acc + Number(g.monto), 0) : 0),
    [todasSeleccionadas, gastos]
  )

  const totales = useMemo(() => {
    const ingreso = resumenFiltrado.reduce((acc, r) => acc + r.ingreso_total, 0)
    const costo = resumenFiltrado.reduce((acc, r) => acc + r.costo_total, 0)
    const gananciaBruta = ingreso - costo
    const ganancia = gananciaBruta - totalGastos
    const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0
    return { ingreso, costo, gananciaBruta, ganancia, margen }
  }, [resumenFiltrado, totalGastos])

  async function handleExportarExcel() {
    setExportando(true)
    try {
      await generarExcel({
        stockBodega: todasSeleccionadas ? stockBodega : [],
        resumenBar: resumenBarFiltrado,
        resumen: resumenFiltrado,
        productos,
        soloBares: todasSeleccionadas ? undefined : nombresSeleccionados,
        gastos: todasSeleccionadas ? gastos : [],
      })
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

      <div className="reporte-filtro no-print">
        <strong>Actividades incluidas en el reporte</strong>
        <div>
          {resumenBar.map((b) => (
            <label key={b.bar_id}>
              <input
                type="checkbox"
                checked={barrasSel.includes(b.bar_id)}
                onChange={() => alternarBar(b.bar_id)}
              />
              {b.bar_nombre}
              {b.es_cortesia ? ' (cortesía)' : ''}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setBarrasSel(resumenBar.map((b) => b.bar_id))}
          disabled={todasSeleccionadas}
        >
          Incluir todas
        </button>
      </div>

      <div className="reporte-band">
        <h1>🍻 Inventario Fiesta</h1>
        <p className="reporte-subtitulo">
          {todasSeleccionadas
            ? 'Reporte de cierre del evento'
            : `Reporte de: ${nombresSeleccionados.join(', ') || 'ninguna actividad'}`}
        </p>
        <p className="reporte-fecha">Generado el {new Date().toLocaleString('es-CR')}</p>
      </div>

      <div className="reporte-body">
        <div className="reporte-summary">
          <div className="reporte-tile">
            <span>Ingreso total</span>
            <strong>₡{moneda.format(totales.ingreso)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Costo de bebidas</span>
            <strong>₡{moneda.format(totales.costo)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Ganancia bruta</span>
            <strong>₡{moneda.format(totales.gananciaBruta)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Gastos</span>
            <strong>₡{moneda.format(totalGastos)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Ganancia neta</span>
            <strong>₡{moneda.format(totales.ganancia)}</strong>
          </div>
          <div className="reporte-tile">
            <span>Margen neto</span>
            <strong>{totales.margen.toFixed(1)}%</strong>
          </div>
        </div>

        {todasSeleccionadas && (
        <Collapsible title="📦 Stock en bodega central" subtitle={`${stockBodega.length} productos`}>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Entradas</th>
                <th>Trasladado</th>
                <th>Devuelto de bares</th>
                <th>Devuelto a proveedor</th>
                <th>Stock actual</th>
              </tr>
            </thead>
            <tbody>
              {stockBodega.map((s) => {
                const p = productos.find((pr) => pr.id === s.producto_id)
                return (
                  <tr key={s.producto_id}>
                    <td>{s.nombre}</td>
                    <td>{unidadesYEmpaque(s.total_entradas, p)}</td>
                    <td>{unidadesYEmpaque(s.total_trasladado, p)}</td>
                    <td>{unidadesYEmpaque(s.total_devuelto, p)}</td>
                    <td>{unidadesYEmpaque(s.total_devuelto_proveedor, p)}</td>
                    <td>
                      <StockBadge value={s.stock_bodega} />
                      {(p?.unidades_por_caja ?? 1) > 1 && (
                        <span> ({formatoEmpaque(s.stock_bodega, p)})</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Collapsible>
        )}

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
                    <td>{b.total_vendido} u. ({vendidoEmpaques(b.bar_id)})</td>
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
                    <td>{b.total_vendido} u. ({vendidoEmpaques(b.bar_id)})</td>
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

        <Collapsible title="🗂️ Ventas por producto" subtitle={`${resumenFiltrado.length} productos`}>
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
              {resumenFiltrado.map((r) => (
                <tr key={r.producto_id}>
                  <td>{r.nombre}</td>
                  <td>
                    {unidadesYEmpaque(
                      r.total_vendido,
                      productos.find((pr) => pr.id === r.producto_id)
                    )}
                  </td>
                  <td>₡{moneda.format(r.ingreso_total)}</td>
                  <td>₡{moneda.format(r.costo_total)}</td>
                  <td>₡{moneda.format(r.ganancia_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>

        {todasSeleccionadas && gastos.length > 0 && (
          <Collapsible title="🧾 Gastos" subtitle={`₡${moneda.format(totalGastos)}`}>
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Cantidad</th>
                  <th>Proforma</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{g.concepto}</td>
                    <td>{g.cantidad ?? ''}</td>
                    <td>{g.referencia ?? ''}</td>
                    <td>₡{moneda.format(g.monto)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Total</td>
                  <td>₡{moneda.format(totalGastos)}</td>
                </tr>
              </tbody>
            </table>
          </Collapsible>
        )}
      </div>
    </div>
  )
}
