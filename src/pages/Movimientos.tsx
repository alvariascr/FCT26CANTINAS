import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import Modal from '../components/Modal'
import StockBadge from '../components/StockBadge'
import type {
  Bar,
  MotivoIncidencia,
  Producto,
  StockBarRow,
  StockBodegaRow,
  TipoProducto,
} from '../lib/types'

const MOTIVOS_INCIDENCIA: MotivoIncidencia[] = ['Rotura', 'Pérdida', 'Cortesía', 'Otro']

type Modo = 'entrada' | 'traslado' | 'devolucion'

const MODOS: { modo: Modo; label: string }[] = [
  { modo: 'entrada', label: '📦 Entrada' },
  { modo: 'traslado', label: '🚚 Traslado' },
  { modo: 'devolucion', label: '↩️ Devolución' },
]

type TablaHistorial = 'entradas_bodega' | 'traslados' | 'devoluciones' | 'incidencias'

interface ItemHistorial {
  id: string
  tabla: TablaHistorial
  etiqueta: string
  producto_id: string
  producto_nombre: string
  bar_id: string | null
  bar_nombre: string | null
  cantidad: number
  motivo: string | null
  creado_en: string
}

const ETIQUETAS: Record<TablaHistorial, string> = {
  entradas_bodega: '📦 Entrada',
  traslados: '🚚 Traslado',
  devoluciones: '↩️ Devolución',
  incidencias: '⚠️ Incidencia',
}

export default function Movimientos() {
  const { session } = useAuth()
  const toast = useToast()
  const [modo, setModo] = useState<Modo>('traslado')
  const [bares, setBares] = useState<Bar[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [stockBodega, setStockBodega] = useState<StockBodegaRow[]>([])
  const [stockBares, setStockBares] = useState<StockBarRow[]>([])
  const [tipo, setTipo] = useState<TipoProducto>('alcoholica')
  const [barId, setBarId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [saving, setSaving] = useState(false)
  const [historial, setHistorial] = useState<ItemHistorial[]>([])
  const [showHistorial, setShowHistorial] = useState(false)

  async function cargarHistorial() {
    const [{ data: entradas }, { data: traslados }, { data: devoluciones }, { data: incidencias }] =
      await Promise.all([
        supabase
          .from('entradas_bodega')
          .select('id, producto_id, cantidad, creado_en, productos(nombre)')
          .order('creado_en', { ascending: false })
          .limit(100),
        supabase
          .from('traslados')
          .select('id, producto_id, bar_id, cantidad, creado_en, productos(nombre), bares(nombre)')
          .order('creado_en', { ascending: false })
          .limit(100),
        supabase
          .from('devoluciones')
          .select('id, producto_id, bar_id, cantidad, creado_en, productos(nombre), bares(nombre)')
          .order('creado_en', { ascending: false })
          .limit(100),
        supabase
          .from('incidencias')
          .select('id, producto_id, bar_id, cantidad, motivo, creado_en, productos(nombre), bares(nombre)')
          .order('creado_en', { ascending: false })
          .limit(100),
      ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toItem = (tabla: TablaHistorial) => (row: any): ItemHistorial => ({
      id: row.id,
      tabla,
      etiqueta: ETIQUETAS[tabla],
      producto_id: row.producto_id,
      producto_nombre: row.productos?.nombre ?? '?',
      bar_id: row.bar_id ?? null,
      bar_nombre: row.bares?.nombre ?? null,
      cantidad: row.cantidad,
      motivo: row.motivo ?? null,
      creado_en: row.creado_en,
    })

    const combinado = [
      ...(entradas ?? []).map(toItem('entradas_bodega')),
      ...(traslados ?? []).map(toItem('traslados')),
      ...(devoluciones ?? []).map(toItem('devoluciones')),
      ...(incidencias ?? []).map(toItem('incidencias')),
    ].sort((a, b) => b.creado_en.localeCompare(a.creado_en))

    setHistorial(combinado.slice(0, 100))
  }

  async function borrarItem(item: ItemHistorial) {
    if (!confirm(`¿Borrar este ${item.etiqueta.split(' ')[1]}?`)) return
    const { error } = await supabase.from(item.tabla).delete().eq('id', item.id)
    cargarHistorial()
    cargar()
    if (error) {
      toast.show('No se pudo borrar: ' + error.message, 'error')
    } else {
      toast.show('Borrado.')
    }
  }

  const [editItem, setEditItem] = useState<ItemHistorial | null>(null)
  const [editProductoId, setEditProductoId] = useState('')
  const [editBarId, setEditBarId] = useState('')
  const [editCantidad, setEditCantidad] = useState(1)
  const [editMotivo, setEditMotivo] = useState<MotivoIncidencia>('Rotura')
  const [editSaving, setEditSaving] = useState(false)

  function abrirEditar(item: ItemHistorial) {
    setEditItem(item)
    setEditProductoId(item.producto_id)
    setEditBarId(item.bar_id ?? '')
    setEditCantidad(item.cantidad)
    setEditMotivo((item.motivo as MotivoIncidencia) ?? 'Rotura')
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem || editCantidad <= 0) return
    setEditSaving(true)

    const payload: Record<string, unknown> = {
      producto_id: editProductoId,
      cantidad: editCantidad,
    }
    if (editItem.tabla !== 'entradas_bodega') payload.bar_id = editBarId
    if (editItem.tabla === 'incidencias') payload.motivo = editMotivo

    const { error } = await supabase.from(editItem.tabla).update(payload).eq('id', editItem.id)
    setEditSaving(false)
    if (!error) {
      setEditItem(null)
      cargarHistorial()
      cargar()
      toast.show('Cambios guardados.')
    } else {
      toast.show('No se pudo guardar: ' + error.message, 'error')
    }
  }

  async function cargar() {
    const [{ data: baresData }, { data: productosData }, { data: stockData }, { data: stockBarData }] =
      await Promise.all([
        supabase.from('bares').select('*').eq('activo', true).order('nombre'),
        supabase.from('productos').select('*').eq('activo', true).order('nombre'),
        supabase.from('v_stock_bodega').select('*'),
        supabase.from('v_stock_bares').select('*'),
      ])
    setBares(baresData ?? [])
    setProductos(productosData ?? [])
    setStockBodega(stockData ?? [])
    setStockBares(stockBarData ?? [])
    if (baresData && baresData.length > 0) setBarId((prev) => prev || baresData[0].id)
  }

  useEffect(() => {
    cargar()
    cargarHistorial()
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

  const stockBodegaDisponible =
    stockBodega.find((s) => s.producto_id === productoId)?.stock_bodega ?? 0

  const stockBarActual =
    stockBares.find((s) => s.producto_id === productoId && s.bar_id === barId)?.stock_bar ?? 0

  const excedeStock =
    (modo === 'traslado' && cantidad > stockBodegaDisponible) ||
    (modo === 'devolucion' && cantidad > stockBarActual)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productoId || cantidad <= 0) return
    if (modo !== 'entrada' && !barId) return
    if (modo === 'traslado' && cantidad > stockBodegaDisponible) {
      toast.show(`No hay suficiente stock en bodega (disponible: ${stockBodegaDisponible}).`, 'error')
      return
    }
    if (modo === 'devolucion' && cantidad > stockBarActual) {
      toast.show(`No puede devolver más de lo que hay en ese bar (disponible: ${stockBarActual}).`, 'error')
      return
    }
    setSaving(true)

    const { error } =
      modo === 'entrada'
        ? await supabase
            .from('entradas_bodega')
            .insert({ producto_id: productoId, cantidad, usuario_id: session?.user.id })
        : modo === 'traslado'
          ? await supabase
              .from('traslados')
              .insert({ bar_id: barId, producto_id: productoId, cantidad, usuario_id: session?.user.id })
          : await supabase
              .from('devoluciones')
              .insert({ bar_id: barId, producto_id: productoId, cantidad, usuario_id: session?.user.id })

    setSaving(false)
    if (error) {
      toast.show('No se pudo guardar: ' + error.message, 'error')
    } else {
      toast.show(
        modo === 'entrada'
          ? 'Entrada a bodega registrada.'
          : modo === 'traslado'
            ? 'Traslado registrado.'
            : 'Devolución registrada.'
      )
      setCantidad(1)
      cargar()
      cargarHistorial()
    }
  }

  return (
    <div>
      <h2>Movimientos de stock</h2>

      <div className="type-toggle">
        {MODOS.map((m) => (
          <button
            key={m.modo}
            type="button"
            className={modo === m.modo ? 'active' : ''}
            onClick={() => setModo(m.modo)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {modo !== 'entrada' && (
          <div className="field">
            <label htmlFor="bar">{modo === 'traslado' ? 'Bar destino' : 'Bar que devuelve'}</label>
            <select id="bar" value={barId} onChange={(e) => setBarId(e.target.value)} required>
              {bares.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                  {b.es_cortesia ? ' (cortesía)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

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
          {modo === 'traslado' && (
            <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Stock en bodega: <StockBadge value={stockBodegaDisponible} />
            </div>
          )}
          {modo === 'devolucion' && (
            <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Stock actual en ese bar: <StockBadge value={stockBarActual} />
            </div>
          )}
          {excedeStock && (
            <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--danger)' }}>
              ⚠️ La cantidad supera el stock disponible.
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="cantidad">
            {modo === 'entrada'
              ? 'Cantidad recibida'
              : modo === 'traslado'
                ? 'Cantidad a trasladar'
                : 'Cantidad que sobró (devuelta)'}
          </label>
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

        <button
          className="btn-primary"
          type="submit"
          disabled={
            saving ||
            !productoId ||
            cantidad <= 0 ||
            (modo !== 'entrada' && !barId) ||
            excedeStock
          }
        >
          {saving
            ? 'Guardando...'
            : modo === 'entrada'
              ? 'Registrar entrada'
              : modo === 'traslado'
                ? 'Guardar traslado'
                : 'Guardar devolución'}
        </button>
      </form>

      <button
        className="btn-primary"
        style={{ marginTop: 20 }}
        onClick={() => setShowHistorial(true)}
      >
        🕒 Ver historial completo ({historial.length})
      </button>

      {showHistorial && (
        <Modal title="Historial de movimientos" onClose={() => setShowHistorial(false)}>
          {historial.length === 0 ? (
            <div className="empty-state">Todavía no hay movimientos.</div>
          ) : (
            historial.map((item) => (
              <div
                key={`${item.tabla}-${item.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem' }}>
                    {item.etiqueta} · {item.producto_nombre} · {item.cantidad}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.bar_nombre ? `${item.bar_nombre} · ` : ''}
                    {item.motivo ? `${item.motivo} · ` : ''}
                    {new Date(item.creado_en).toLocaleString('es-CR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" onClick={() => abrirEditar(item)}>
                    Editar
                  </button>
                  <button className="icon-btn" onClick={() => borrarItem(item)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))
          )}
        </Modal>
      )}

      {editItem && (
        <Modal title={`Editar ${editItem.etiqueta.split(' ')[1]}`} onClose={() => setEditItem(null)}>
          <form onSubmit={guardarEdicion}>
            {editItem.tabla !== 'entradas_bodega' && (
              <div className="field">
                <label htmlFor="edit-bar">Bar</label>
                <select
                  id="edit-bar"
                  value={editBarId}
                  onChange={(e) => setEditBarId(e.target.value)}
                  required
                >
                  {bares.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="edit-producto">Producto</label>
              <select
                id="edit-producto"
                value={editProductoId}
                onChange={(e) => setEditProductoId(e.target.value)}
                required
              >
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="edit-cantidad">Cantidad</label>
              <input
                id="edit-cantidad"
                type="number"
                min={1}
                value={editCantidad === 0 ? '' : editCantidad}
                onChange={(e) => {
                  const v = e.target.value
                  setEditCantidad(v === '' ? 0 : Math.max(0, Math.trunc(Number(v)) || 0))
                }}
                onBlur={() => setEditCantidad((c) => (c <= 0 ? 1 : c))}
                required
              />
            </div>

            {editItem.tabla === 'incidencias' && (
              <div className="field">
                <label htmlFor="edit-motivo">Motivo</label>
                <select
                  id="edit-motivo"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value as MotivoIncidencia)}
                >
                  {MOTIVOS_INCIDENCIA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={editSaving}>
              {editSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
