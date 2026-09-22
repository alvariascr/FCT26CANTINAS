import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from '../components/Modal'
import { useToast } from '../lib/ToastContext'
import type { Bar, Producto, TipoProducto } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 })

type Tab = 'productos' | 'bares'

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
  const [nuevoServido, setNuevoServido] = useState<'completa' | 'shot'>('completa')
  const [nuevoMlBotella, setNuevoMlBotella] = useState('')
  const [nuevoMlPorcion, setNuevoMlPorcion] = useState('')
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevoUsaEmpaque, setNuevoUsaEmpaque] = useState(false)
  const [nuevoEmpaquePreset, setNuevoEmpaquePreset] = useState<'caja' | 'paquete' | 'otro'>('caja')
  const [nuevoEmpaqueNombre, setNuevoEmpaqueNombre] = useState('Caja')
  const [nuevoUnidadesPorCaja, setNuevoUnidadesPorCaja] = useState('24')
  const [nuevoPrecioPorCaja, setNuevoPrecioPorCaja] = useState(false)

  function elegirPreset(preset: 'caja' | 'paquete' | 'otro') {
    setNuevoEmpaquePreset(preset)
    if (preset === 'caja') {
      setNuevoEmpaqueNombre('Caja')
      setNuevoUnidadesPorCaja('24')
    } else if (preset === 'paquete') {
      setNuevoEmpaqueNombre('Paquete')
      setNuevoUnidadesPorCaja('12')
    }
  }

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
    const mlBotella = nuevoMlBotella ? Number(nuevoMlBotella) : null
    const mlPorcion =
      nuevoServido === 'completa' ? mlBotella : nuevoMlPorcion ? Number(nuevoMlPorcion) : null
    const unidadesPorCaja = nuevoUsaEmpaque ? Number(nuevoUnidadesPorCaja) || 1 : 1
    const dividir = nuevoUsaEmpaque && nuevoPrecioPorCaja && unidadesPorCaja > 1
    const costoUnidad = dividir ? (Number(nuevoCosto) || 0) / unidadesPorCaja : Number(nuevoCosto) || 0
    const precioUnidad = dividir ? (Number(nuevoPrecio) || 0) / unidadesPorCaja : Number(nuevoPrecio) || 0
    const { error } = await supabase.from('productos').insert({
      nombre: nuevoNombre.trim(),
      tipo: nuevoTipo,
      ml_botella: mlBotella,
      ml_porcion: mlPorcion,
      costo_compra: costoUnidad,
      precio_venta_porcion: precioUnidad,
      unidades_por_caja: unidadesPorCaja,
      empaque_nombre: nuevoUsaEmpaque ? nuevoEmpaqueNombre.trim() || 'Caja' : null,
    })
    if (error) {
      toast.show('No se pudo agregar el producto: ' + error.message, 'error')
      return
    }
    setNuevoNombre('')
    setNuevoServido('completa')
    setNuevoMlBotella('')
    setNuevoMlPorcion('')
    setNuevoCosto('')
    setNuevoPrecio('')
    setNuevoUsaEmpaque(false)
    setNuevoEmpaquePreset('caja')
    setNuevoEmpaqueNombre('Caja')
    setNuevoUnidadesPorCaja('24')
    setNuevoPrecioPorCaja(false)
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
                      const usaEmpaque = p.unidades_por_caja > 1
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
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              marginBottom: usaEmpaque ? 12 : 16,
                              fontSize: '0.9rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={usaEmpaque}
                              onChange={(e) =>
                                editarLocal(
                                  p.id,
                                  'unidades_por_caja',
                                  e.target.checked ? '24' : '1'
                                )
                              }
                              style={{ width: 18, height: 18 }}
                            />
                            ¿Este producto llega en caja o paquete?
                          </label>
                          {usaEmpaque && (
                            <>
                              <div className="type-toggle" style={{ marginBottom: 10 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    editarLocalTexto(p.id, 'empaque_nombre', 'Caja')
                                    editarLocal(p.id, 'unidades_por_caja', '24')
                                  }}
                                >
                                  📦 Caja (24)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    editarLocalTexto(p.id, 'empaque_nombre', 'Paquete')
                                    editarLocal(p.id, 'unidades_por_caja', '12')
                                  }}
                                >
                                  📦 Paquete (12)
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <div className="field" style={{ flex: 1 }}>
                                  <label>Nombre del empaque</label>
                                  <input
                                    value={p.empaque_nombre ?? ''}
                                    placeholder="Ej: Six pack, Fardo..."
                                    onChange={(e) =>
                                      editarLocalTexto(p.id, 'empaque_nombre', e.target.value)
                                    }
                                  />
                                </div>
                                <div className="field" style={{ flex: 1 }}>
                                  <label>Unidades que trae</label>
                                  <input
                                    type="number"
                                    value={p.unidades_por_caja}
                                    onChange={(e) =>
                                      editarLocal(p.id, 'unidades_por_caja', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            </>
                          )}
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
                  <label>¿Cómo se sirve?</label>
                  <div className="type-toggle">
                    <button
                      type="button"
                      className={nuevoServido === 'completa' ? 'active' : ''}
                      onClick={() => setNuevoServido('completa')}
                    >
                      🍾 Completa (cerveza, soda)
                    </button>
                    <button
                      type="button"
                      className={nuevoServido === 'shot' ? 'active' : ''}
                      onClick={() => setNuevoServido('shot')}
                    >
                      🥃 Por shot/copa
                    </button>
                  </div>
                </div>

                {nuevoServido === 'completa' ? (
                  <div className="field">
                    <label htmlFor="p-ml-botella">ml por botella/lata/unidad</label>
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

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={nuevoUsaEmpaque}
                    onChange={(e) => {
                      setNuevoUsaEmpaque(e.target.checked)
                      if (e.target.checked) elegirPreset('caja')
                      else setNuevoPrecioPorCaja(false)
                    }}
                    style={{ width: 18, height: 18 }}
                  />
                  ¿Este producto llega en caja o paquete?
                </label>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: nuevoUsaEmpaque ? 12 : 20,
                  }}
                >
                  Activalo para poder registrar movimientos de este producto en cajas/paquetes (ej.
                  "2 cajas") en vez de escribir la cantidad de unidades a mano. Si se compra suelto,
                  botella por botella, dejalo sin marcar.
                </div>
                {nuevoUsaEmpaque && (
                  <div className="field">
                    <div className="type-toggle" style={{ marginBottom: 10 }}>
                      <button
                        type="button"
                        className={nuevoEmpaquePreset === 'caja' ? 'active' : ''}
                        onClick={() => elegirPreset('caja')}
                      >
                        📦 Caja (24)
                      </button>
                      <button
                        type="button"
                        className={nuevoEmpaquePreset === 'paquete' ? 'active' : ''}
                        onClick={() => elegirPreset('paquete')}
                      >
                        📦 Paquete (12)
                      </button>
                      <button
                        type="button"
                        className={nuevoEmpaquePreset === 'otro' ? 'active' : ''}
                        onClick={() => elegirPreset('otro')}
                      >
                        ✏️ Otro
                      </button>
                    </div>
                    {nuevoEmpaquePreset === 'otro' && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                          <label htmlFor="p-empaque-nombre">Nombre del empaque</label>
                          <input
                            id="p-empaque-nombre"
                            value={nuevoEmpaqueNombre}
                            placeholder="Ej: Six pack, Fardo..."
                            onChange={(e) => setNuevoEmpaqueNombre(e.target.value)}
                          />
                        </div>
                        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                          <label htmlFor="p-unidades-caja">Unidades que trae</label>
                          <input
                            id="p-unidades-caja"
                            type="number"
                            value={nuevoUnidadesPorCaja}
                            onChange={(e) => setNuevoUnidadesPorCaja(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {nuevoServido === 'completa' && (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 4,
                          fontSize: '0.85rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={nuevoPrecioPorCaja}
                          onChange={(e) => setNuevoPrecioPorCaja(e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                        Voy a escribir el costo/precio de{' '}
                        {(nuevoEmpaqueNombre || 'la caja').toLowerCase()} completa, no por unidad
                      </label>
                    )}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="p-costo">
                    {nuevoUsaEmpaque && nuevoPrecioPorCaja
                      ? `Costo de compra de ${(nuevoEmpaqueNombre || 'la caja').toLowerCase()} completa (₡)`
                      : nuevoServido === 'shot'
                        ? 'Costo de compra por botella completa (₡)'
                        : 'Costo de compra por unidad (₡)'}
                  </label>
                  <input
                    id="p-costo"
                    type="number"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                  />
                  {nuevoServido === 'shot' && !nuevoPrecioPorCaja && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      No es el costo del shot — es lo que cuesta la botella entera.
                    </div>
                  )}
                  {nuevoUsaEmpaque && nuevoPrecioPorCaja && Number(nuevoUnidadesPorCaja) > 0 && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      = ₡{moneda.format((Number(nuevoCosto) || 0) / Number(nuevoUnidadesPorCaja))} por
                      unidad
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="p-precio">
                    {nuevoUsaEmpaque && nuevoPrecioPorCaja
                      ? `Precio de venta de ${(nuevoEmpaqueNombre || 'la caja').toLowerCase()} completa (₡)`
                      : `Precio de venta ${nuevoServido === 'shot' ? 'por shot/copa' : 'por unidad'} (₡)`}
                  </label>
                  <input
                    id="p-precio"
                    type="number"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(e.target.value)}
                  />
                  {nuevoUsaEmpaque && nuevoPrecioPorCaja && Number(nuevoUnidadesPorCaja) > 0 && (
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      = ₡{moneda.format((Number(nuevoPrecio) || 0) / Number(nuevoUnidadesPorCaja))} por
                      unidad
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
