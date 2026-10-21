import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import Modal from '../components/Modal'
import type { Gasto } from '../lib/types'

const moneda = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Gastos() {
  const { session } = useAuth()
  const toast = useToast()
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Gasto | 'nuevo' | null>(null)
  const [saving, setSaving] = useState(false)

  const [concepto, setConcepto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [referencia, setReferencia] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [monto, setMonto] = useState('')

  async function cargar() {
    const { data } = await supabase.from('gastos').select('*').order('creado_en', { ascending: false })
    setGastos(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const total = useMemo(() => gastos.reduce((acc, g) => acc + g.monto, 0), [gastos])

  function abrir(g: Gasto | 'nuevo') {
    setEditando(g)
    if (g === 'nuevo') {
      setConcepto('')
      setProveedor('')
      setReferencia('')
      setCantidad('')
      setMonto('')
    } else {
      setConcepto(g.concepto)
      setProveedor(g.proveedor ?? '')
      setReferencia(g.referencia ?? '')
      setCantidad(g.cantidad != null ? String(g.cantidad) : '')
      setMonto(String(g.monto))
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const montoNum = Number(monto)
    if (!concepto.trim() || !(montoNum > 0)) return
    setSaving(true)
    const datos = {
      concepto: concepto.trim(),
      proveedor: proveedor.trim() || null,
      referencia: referencia.trim() || null,
      cantidad: cantidad ? Number(cantidad) : null,
      monto: montoNum,
    }
    const { error } =
      editando && editando !== 'nuevo'
        ? await supabase.from('gastos').update(datos).eq('id', editando.id)
        : await supabase.from('gastos').insert({ ...datos, usuario_id: session?.user.id })
    setSaving(false)
    if (error) {
      toast.show('No se pudo guardar: ' + error.message, 'error')
      return
    }
    toast.show(editando === 'nuevo' ? 'Gasto agregado.' : 'Gasto actualizado.')
    setEditando(null)
    cargar()
  }

  async function eliminar(g: Gasto) {
    if (!confirm(`¿Eliminar el gasto "${g.concepto}" por ₡${moneda.format(g.monto)}?`)) return
    const { error } = await supabase.from('gastos').delete().eq('id', g.id)
    if (error) {
      toast.show('No se pudo eliminar: ' + error.message, 'error')
      return
    }
    toast.show('Gasto eliminado.')
    cargar()
  }

  if (loading) return <div className="empty-state">Cargando gastos...</div>

  return (
    <div>
      <h2>Gastos</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -8 }}>
        Lo que no es bebida para vender: hielo, vasos, gas, club soda, etc. Se restan de la
        ganancia en el Resumen y en el Reporte. Anotá el monto total pagado (con IVA si aplica).
      </p>

      <div className="summary-grid">
        <div className="summary-tile">
          <div className="label">Total de gastos</div>
          <div className="value">₡{moneda.format(total)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Registros</div>
          <div className="value">{gastos.length}</div>
        </div>
      </div>

      <button className="btn-primary" style={{ marginBottom: 14 }} onClick={() => abrir('nuevo')}>
        + Nuevo gasto
      </button>
      <Link to="/resumen" className="btn-secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 18 }}>
        ← Volver al resumen
      </Link>

      {gastos.length === 0 ? (
        <div className="empty-state">Todavía no hay gastos registrados.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {gastos.map((g) => (
            <div key={g.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontWeight: 600 }}>{g.concepto}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>₡{moneda.format(g.monto)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                {[
                  g.cantidad != null ? `${g.cantidad} u.` : null,
                  g.proveedor,
                  g.referencia ? `Proforma ${g.referencia}` : null,
                  new Date(g.creado_en).toLocaleDateString('es-CR'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => abrir(g)}>
                  Editar
                </button>
                <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => eliminar(g)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <Modal title={editando === 'nuevo' ? 'Nuevo gasto' : 'Editar gasto'} onClose={() => setEditando(null)}>
          <form onSubmit={guardar}>
            <div className="field">
              <label htmlFor="g-concepto">Concepto</label>
              <input
                id="g-concepto"
                placeholder="Ej: Hielo cristal 10 kg"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="g-monto">Monto total pagado (₡)</label>
              <input
                id="g-monto"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="g-cantidad">Cantidad (opcional)</label>
              <input
                id="g-cantidad"
                type="number"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="g-proveedor">Proveedor (opcional)</label>
              <input id="g-proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="g-referencia">Número de proforma (opcional)</label>
              <input id="g-referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
