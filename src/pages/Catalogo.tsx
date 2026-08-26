import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Bar, Producto, TipoProducto } from '../lib/types'

export default function Catalogo() {
  const { session } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [bares, setBares] = useState<Bar[]>([])
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState<TipoProducto>('alcoholica')
  const [nuevoMlBotella, setNuevoMlBotella] = useState('')
  const [nuevoMlPorcion, setNuevoMlPorcion] = useState('')
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')

  const [nuevoBar, setNuevoBar] = useState('')

  const [entradaProductoId, setEntradaProductoId] = useState('')
  const [entradaCantidad, setEntradaCantidad] = useState('')

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
    const { error } = await supabase.from('productos').insert({
      nombre: nuevoNombre.trim(),
      tipo: nuevoTipo,
      ml_botella: nuevoMlBotella ? Number(nuevoMlBotella) : null,
      ml_porcion: nuevoMlPorcion ? Number(nuevoMlPorcion) : null,
      costo_compra: Number(nuevoCosto) || 0,
      precio_venta_porcion: Number(nuevoPrecio) || 0,
    })
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo agregar el producto: ' + error.message })
      return
    }
    setNuevoNombre('')
    setNuevoMlBotella('')
    setNuevoMlPorcion('')
    setNuevoCosto('')
    setNuevoPrecio('')
    setMsg({ type: 'success', text: 'Producto agregado.' })
    cargar()
  }

  async function guardarProducto(p: Producto) {
    const { error } = await supabase
      .from('productos')
      .update({ costo_compra: p.costo_compra, precio_venta_porcion: p.precio_venta_porcion })
      .eq('id', p.id)
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo guardar: ' + error.message })
    } else {
      setMsg({ type: 'success', text: `${p.nombre} actualizado.` })
    }
  }

  async function toggleProducto(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    cargar()
  }

  function editarLocal(id: string, campo: 'costo_compra' | 'precio_venta_porcion', valor: string) {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: Number(valor) || 0 } : p))
    )
  }

  async function agregarBar(e: FormEvent) {
    e.preventDefault()
    if (!nuevoBar.trim()) return
    const { error } = await supabase.from('bares').insert({ nombre: nuevoBar.trim() })
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo agregar el bar: ' + error.message })
      return
    }
    setNuevoBar('')
    cargar()
  }

  async function toggleBar(b: Bar) {
    await supabase.from('bares').update({ activo: !b.activo }).eq('id', b.id)
    cargar()
  }

  async function agregarEntrada(e: FormEvent) {
    e.preventDefault()
    const cantidad = Number(entradaCantidad)
    if (!entradaProductoId || !cantidad || cantidad <= 0) return
    const { error } = await supabase.from('entradas_bodega').insert({
      producto_id: entradaProductoId,
      cantidad,
      usuario_id: session?.user.id,
    })
    if (error) {
      setMsg({ type: 'error', text: 'No se pudo registrar la entrada: ' + error.message })
      return
    }
    setEntradaCantidad('')
    setMsg({ type: 'success', text: 'Entrada a bodega registrada.' })
  }

  return (
    <div>
      <h2>Catálogo</h2>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="section-title">Bares</div>
      <div className="card">
        {bares.map((b) => (
          <div
            key={b.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
          >
            <span style={{ opacity: b.activo ? 1 : 0.4 }}>{b.nombre}</span>
            <button className="icon-btn" onClick={() => toggleBar(b)}>
              {b.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
        <form onSubmit={agregarBar} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            placeholder="Nombre del nuevo bar"
            value={nuevoBar}
            onChange={(e) => setNuevoBar(e.target.value)}
          />
          <button className="icon-btn" type="submit">
            Agregar
          </button>
        </form>
      </div>

      <div className="section-title">Entradas a bodega (stock inicial / reposición)</div>
      <div className="card">
        <form onSubmit={agregarEntrada} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            style={{ flex: '1 1 100%' }}
            value={entradaProductoId}
            onChange={(e) => setEntradaProductoId(e.target.value)}
            required
          >
            <option value="">Seleccioná un producto...</option>
            {productos
              .filter((p) => p.activo)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
          <input
            type="number"
            placeholder="Cantidad"
            min={1}
            value={entradaCantidad}
            onChange={(e) => setEntradaCantidad(e.target.value)}
            style={{ flex: 1 }}
            required
          />
          <button className="icon-btn" type="submit">
            Registrar entrada
          </button>
        </form>
      </div>

      <div className="section-title">Productos</div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Costo</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.4 }}>
                <td>{p.nombre}</td>
                <td>
                  <input
                    type="number"
                    value={p.costo_compra}
                    style={{ width: 80, padding: 6 }}
                    onChange={(e) => editarLocal(p.id, 'costo_compra', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.precio_venta_porcion}
                    style={{ width: 80, padding: 6 }}
                    onChange={(e) => editarLocal(p.id, 'precio_venta_porcion', e.target.value)}
                  />
                </td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => guardarProducto(p)}>
                    Guardar
                  </button>
                  <button className="icon-btn" onClick={() => toggleProducto(p)}>
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Agregar producto nuevo</div>
      <div className="card">
        <form onSubmit={agregarProducto}>
          <div className="field">
            <label htmlFor="p-nombre">Nombre</label>
            <input
              id="p-nombre"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              required
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
            <label htmlFor="p-ml-botella">ml por botella/unidad</label>
            <input
              id="p-ml-botella"
              type="number"
              value={nuevoMlBotella}
              onChange={(e) => setNuevoMlBotella(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="p-ml-porcion">ml por porción (shot/copa/vaso)</label>
            <input
              id="p-ml-porcion"
              type="number"
              value={nuevoMlPorcion}
              onChange={(e) => setNuevoMlPorcion(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="p-costo">Costo de compra por unidad (₡)</label>
            <input
              id="p-costo"
              type="number"
              value={nuevoCosto}
              onChange={(e) => setNuevoCosto(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="p-precio">Precio de venta por porción (₡)</label>
            <input
              id="p-precio"
              type="number"
              value={nuevoPrecio}
              onChange={(e) => setNuevoPrecio(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit">
            Agregar producto
          </button>
        </form>
      </div>
    </div>
  )
}
