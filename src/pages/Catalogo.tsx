import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from '../components/Modal'
import { useToast } from '../lib/ToastContext'
import type { Bar, Producto, TipoProducto } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

type Tab = 'productos' | 'bares'
type CategoriaEmpaque = 'cerveza' | 'refresco' | 'licor'

const DATOS_CATEGORIA: Record<CategoriaEmpaque, { unidades: number; nombre: string | null }> = {
  cerveza: { unidades: 24, nombre: 'Caja' },
  refresco: { unidades: 12, nombre: 'Paquete' },
  licor: { unidades: 1, nombre: null },
}

function categoriaDe(p: Producto): CategoriaEmpaque {
  if (p.unidades_por_caja <= 1) return 'licor'
  return (p.empaque_nombre || '').toLowerCase().includes('paquete') ? 'refresco' : 'cerveza'
}

export default function Catalogo() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('productos')
  const [productos, setProductos] = useState<Producto[]>([])
  const [bares, setBares] = useState<Bar[]>([])

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [showNuevoBar, setShowNuevoBar] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState<TipoProducto>('alcoholica')
  const [nuevoMlBotella, setNuevoMlBotella] = useState('')
  const [nuevoMlPorcion, setNuevoMlPorcion] = useState('')
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevoCategoria, setNuevoCategoria] = useState<CategoriaEmpaque>('cerveza')

  const [nuevoBar, setNuevoBar] = useState('')
  const [nuevoBarCortesia, setNuevoBarCortesia] = useState(false)

  async function cargar() {
    const [{ data: productosData }, { data: baresData }] = await Promise.all([
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('bares').select('*').order('nombre'),
    ])
    setProductos(productosData ?? [])
    setBares(baresData ?? [])
  }

  useEffect(() => {
    cargar()
  }, [])

  async function agregarProducto(e: FormEvent) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return
    const esLicor = nuevoCategoria === 'licor'
    const mlBotella = nuevoMlBotella ? Number(nuevoMlBotella) : null
    const mlPorcion = esLicor ? (nuevoMlPorcion ? Number(nuevoMlPorcion) : null) : mlBotella
    const { unidades: unidadesPorCaja, nombre: empaqueNombre } = DATOS_CATEGORIA[nuevoCategoria]
    // Cerveza/refresco: el costo/precio siempre se escriben de la caja/paquete completo.
    // Licor: el costo es por botella completa y el precio ya es por shot, no se divide.
    const costoUnidad = esLicor ? Number(nuevoCosto) || 0 : (Number(nuevoCosto) || 0) / unidadesPorCaja
    const precioUnidad = esLicor
      ? Number(nuevoPrecio) || 0
      : (Number(nuevoPrecio) || 0) / unidadesPorCaja
    const { error } = await supabase.from('productos').insert({
      nombre: nuevoNombre.trim(),
      tipo: nuevoTipo,
      ml_botella: mlBotella,
      ml_porcion: mlPorcion,
      costo_compra: costoUnidad,
      precio_venta_porcion: precioUnidad,
      unidades_por_caja: unidadesPorCaja,
      empaque_nombre: empaqueNombre,
    })
    if (error) {
      toast.show('No se pudo agregar el producto: ' + error.message, 'error')
      return
    }
    setNuevoNombre('')
    setNuevoMlBotella('')
    setNuevoMlPorcion('')
    setNuevoCosto('')
    setNuevoPrecio('')
    setNuevoCategoria('cerveza')
    setShowNuevoProducto(false)
    toast.show('Producto agregado.')
    cargar()
  }

  async function eliminarProducto(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}" del catálogo? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('productos').delete().eq('id', p.id)
    if (error) {
      toast.show(
        'No se pudo eliminar (probablemente ya tiene movimientos registrados). Podés desactivarlo en su lugar.',
        'error'
      )
    } else {
      toast.show(`${p.nombre} eliminado.`)
      setExpandedId(null)
      cargar()
    }
  }

  async function guardarProducto(p: Producto) {
    const { error } = await supabase
      .from('productos')
      .update({
        costo_compra: p.costo_compra,
        precio_venta_porcion: p.precio_venta_porcion,
        unidades_por_caja: p.unidades_por_caja || 1,
        empaque_nombre: p.unidades_por_caja > 1 ? p.empaque_nombre || 'Caja' : null,
      })
      .eq('id', p.id)
    if (error) {
      toast.show('No se pudo guardar: ' + error.message, 'error')
    } else {
      toast.show(`${p.nombre} actualizado.`)
      setExpandedId(null)
    }
  }

  async function toggleProducto(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    cargar()
  }

  function editarLocal(
    id: string,
    campo: 'costo_compra' | 'precio_venta_porcion' | 'unidades_por_caja',
    valor: string
  ) {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: Number(valor) || 0 } : p))
    )
  }

  function editarLocalTexto(id: string, campo: 'empaque_nombre', valor: string) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)))
  }

  async function agregarBar(e: FormEvent) {
    e.preventDefault()
    if (!nuevoBar.trim()) return
    const { error } = await supabase
      .from('bares')
      .insert({ nombre: nuevoBar.trim(), es_cortesia: nuevoBarCortesia })
    if (error) {
      toast.show('No se pudo agregar el bar: ' + error.message, 'error')
      return
    }
    setNuevoBar('')
    setNuevoBarCortesia(false)
    setShowNuevoBar(false)
    toast.show('Bar agregado.')
    cargar()
  }

  async function toggleBar(b: Bar) {
    await supabase.from('bares').update({ activo: !b.activo }).eq('id', b.id)
    cargar()
  }

  async function toggleCortesia(b: Bar) {
    await supabase.from('bares').update({ es_cortesia: !b.es_cortesia }).eq('id', b.id)
    cargar()
  }

  return (
    <div>
      <h2>Catálogo</h2>

      <div className="type-toggle">
        <button
          type="button"
          className={tab === 'productos' ? 'active' : ''}
          onClick={() => setTab('productos')}
        >
          🗂️ Productos
        </button>
        <button
          type="button"
          className={tab === 'bares' ? 'active' : ''}
          onClick={() => setTab('bares')}
        >
          📍 Bares
        </button>
      </div>

      {tab === 'bares' && (
        <>
          <button className="btn-primary" style={{ marginBottom: 14 }} onClick={() => setShowNuevoBar(true)}>
            + Nuevo bar
          </button>

          <div className="section-title">Bares del evento</div>
          <div className="card" style={{ padding: 0 }}>
            {bares.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  opacity: b.activo ? 1 : 0.4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: b.es_cortesia ? 4 : 0,
                  }}
                >
                  <span>{b.nombre}</span>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => toggleCortesia(b)}>
                      {b.es_cortesia ? 'Quitar cortesía' : 'Marcar cortesía'}
                    </button>
                    <button className="icon-btn" onClick={() => toggleBar(b)}>
                      {b.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
                {b.es_cortesia && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-strong)' }}>
                    🎁 Cortesía — no genera ingreso
                  </span>
                )}
              </div>
            ))}
          </div>

          {showNuevoBar && (
            <Modal
              title="Nuevo bar"
              onClose={() => {
                setShowNuevoBar(false)
                setNuevoBarCortesia(false)
              }}
            >
              <form onSubmit={agregarBar}>
                <div className="field">
                  <label htmlFor="bar-nombre">Nombre del bar</label>
                  <input
                    id="bar-nombre"
                    placeholder="Ej: Bar piscina, Comisión cabalgata..."
                    value={nuevoBar}
                    onChange={(e) => setNuevoBar(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 20,
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={nuevoBarCortesia}
                    onChange={(e) => setNuevoBarCortesia(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  Es cortesía — no genera ingreso (ej. actividad que regala bebida)
                </label>
                <button className="btn-primary" type="submit">
                  Agregar bar
                </button>
              </form>
            </Modal>
          )}
        </>
      )}

      {tab === 'productos' && (
        <>
          <button
            className="btn-primary"
            style={{ marginBottom: 14 }}
            onClick={() => setShowNuevoProducto(true)}
          >
            + Nuevo producto
          </button>

          <div className="card" style={{ padding: 0 }}>
            {productos.map((p) => {
              const expanded = expandedId === p.id
              return (
                <div
                  key={p.id}
                  style={{ borderBottom: '1px solid var(--border)', opacity: p.activo ? 1 : 0.4 }}
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text)',
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontSize: '0.95rem',
                    }}
                  >
                    <span>{p.nombre}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      ₡{moneda.format(p.precio_venta_porcion)}{' '}
                      <span style={{ marginLeft: 6 }}>{expanded ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {expanded &&
                    (() => {
                      const esShot =
                        p.ml_botella != null && p.ml_porcion != null && p.ml_botella !== p.ml_porcion
                      return (
                        <div style={{ padding: '0 16px 16px' }}>
                          <div className="field">
                            <label>
                              {esShot
                                ? 'Costo de compra por botella completa (₡)'
                                : 'Costo de compra por unidad (₡)'}
                            </label>
                            <input
                              type="number"
                              value={p.costo_compra}
                              onChange={(e) => editarLocal(p.id, 'costo_compra', e.target.value)}
                            />
                            {esShot && (
                              <div
                                style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}
                              >
                                No es el costo del shot — es lo que cuesta la botella entera (
                                {p.ml_botella}ml).
                              </div>
                            )}
                          </div>
                          <div className="field">
                            <label>
                              Precio de venta {esShot ? `por shot (${p.ml_porcion}ml)` : 'por unidad'} (₡)
                            </label>
                            <input
                              type="number"
                              value={p.precio_venta_porcion}
                              onChange={(e) =>
                                editarLocal(p.id, 'precio_venta_porcion', e.target.value)
                              }
                            />
                          </div>
                          <div className="field">
                            <label>¿Cómo se cuenta este producto?</label>
                            <div className="type-toggle">
                              <button
                                type="button"
                                className={categoriaDe(p) === 'cerveza' ? 'active' : ''}
                                onClick={() => {
                                  editarLocal(p.id, 'unidades_por_caja', '24')
                                  editarLocalTexto(p.id, 'empaque_nombre', 'Caja')
                                }}
                              >
                                🍺 Cerveza (caja 24)
                              </button>
                              <button
                                type="button"
                                className={categoriaDe(p) === 'refresco' ? 'active' : ''}
                                onClick={() => {
                                  editarLocal(p.id, 'unidades_por_caja', '12')
                                  editarLocalTexto(p.id, 'empaque_nombre', 'Paquete')
                                }}
                              >
                                🥤 Refresco (paq 12)
                              </button>
                              <button
                                type="button"
                                className={categoriaDe(p) === 'licor' ? 'active' : ''}
                                onClick={() => {
                                  editarLocal(p.id, 'unidades_por_caja', '1')
                                  editarLocalTexto(p.id, 'empaque_nombre', '')
                                }}
                              >
                                🥃 Licor (botella)
                              </button>
                            </div>
                          </div>
                          <div className="row-actions">
                            <button className="icon-btn" onClick={() => guardarProducto(p)}>
                              Guardar
                            </button>
                            <button className="icon-btn" onClick={() => toggleProducto(p)}>
                              {p.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              className="icon-btn"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => eliminarProducto(p)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                </div>
              )
            })}
          </div>

          {showNuevoProducto && (
            <Modal title="Nuevo producto" onClose={() => setShowNuevoProducto(false)}>
              <form onSubmit={agregarProducto}>
                <div className="field">
                  <label htmlFor="p-nombre">Nombre</label>
                  <input
                    id="p-nombre"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={nuevoTipo === 'alcoholica' ? 'active' : ''}
                    onClick={() => setNuevoTipo('alcoholica')}
                  >
                    🍺 Alcohólica
                  </button>
                  <button
                    type="button"
                    className={nuevoTipo === 'sin_alcohol' ? 'active' : ''}
                    onClick={() => setNuevoTipo('sin_alcohol')}
                  >
                    🥤 Sin alcohol
                  </button>
                </div>
                <div className="field">
                  <label>¿Cómo se cuenta este producto?</label>
                  <div className="type-toggle">
                    <button
                      type="button"
                      className={nuevoCategoria === 'cerveza' ? 'active' : ''}
                      onClick={() => setNuevoCategoria('cerveza')}
                    >
                      🍺 Cerveza (caja 24)
                    </button>
                    <button
                      type="button"
                      className={nuevoCategoria === 'refresco' ? 'active' : ''}
                      onClick={() => setNuevoCategoria('refresco')}
                    >
                      🥤 Refresco (paq 12)
                    </button>
                    <button
                      type="button"
                      className={nuevoCategoria === 'licor' ? 'active' : ''}
                      onClick={() => setNuevoCategoria('licor')}
                    >
                      🥃 Licor (botella)
                    </button>
                  </div>
                </div>

                {nuevoCategoria !== 'licor' ? (
                  <div className="field">
                    <label htmlFor="p-ml-botella">ml por botella/lata</label>
                    <input
                      id="p-ml-botella"
                      type="number"
                      value={nuevoMlBotella}
                      onChange={(e) => setNuevoMlBotella(e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="p-ml-botella">ml por botella</label>
                      <input
                        id="p-ml-botella"
                        type="number"
                        value={nuevoMlBotella}
                        onChange={(e) => setNuevoMlBotella(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="p-ml-porcion">ml por shot/copa (la porción que se sirve)</label>
                      <input
                        id="p-ml-porcion"
                        type="number"
                        value={nuevoMlPorcion}
                        onChange={(e) => setNuevoMlPorcion(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="field">
                  <label htmlFor="p-costo">
                    {nuevoCategoria !== 'licor'
                      ? `Costo de compra de ${DATOS_CATEGORIA[nuevoCategoria].nombre!.toLowerCase()} completa (₡)`
                      : 'Costo de compra por botella completa (₡)'}
                  </label>
                  <input
                    id="p-costo"
                    type="number"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                  />
                  {nuevoCategoria === 'licor' && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      No es el costo del shot — es lo que cuesta la botella entera.
                    </div>
                  )}
                  {nuevoCategoria !== 'licor' && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      = ₡
                      {moneda.format(
                        (Number(nuevoCosto) || 0) / DATOS_CATEGORIA[nuevoCategoria].unidades
                      )}{' '}
                      por unidad
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="p-precio">
                    {nuevoCategoria !== 'licor'
                      ? `Precio de venta de ${DATOS_CATEGORIA[nuevoCategoria].nombre!.toLowerCase()} completa (₡)`
                      : 'Precio de venta por shot/copa (₡)'}
                  </label>
                  <input
                    id="p-precio"
                    type="number"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(e.target.value)}
                  />
                  {nuevoCategoria !== 'licor' && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      = ₡
                      {moneda.format(
                        (Number(nuevoPrecio) || 0) / DATOS_CATEGORIA[nuevoCategoria].unidades
                      )}{' '}
                      por unidad
                    </div>
                  )}
                </div>

                <button className="btn-primary" type="submit" style={{ marginTop: 20 }}>
                  Agregar producto
                </button>
              </form>
            </Modal>
          )}
        </>
      )}
    </div>
  )
}
