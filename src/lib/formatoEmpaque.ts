import type { Producto } from './types'

export function unidadesYEmpaque(cantidad: number, producto?: Producto) {
  if ((producto?.unidades_por_caja ?? 1) <= 1) return `${cantidad}`
  return `${cantidad} (${formatoEmpaque(cantidad, producto)})`
}

export function resumenEmpaques(
  filas: { producto_id: string; vendido: number }[],
  productos: Producto[]
) {
  let cajas = 0
  let paquetes = 0
  let sueltas = 0
  for (const f of filas) {
    if (f.vendido <= 0) continue
    const p = productos.find((pr) => pr.id === f.producto_id)
    const porCaja = p?.unidades_por_caja ?? 1
    if (porCaja <= 1) {
      sueltas += f.vendido
      continue
    }
    const enteros = Math.floor(f.vendido / porCaja)
    if ((p?.empaque_nombre || '').toLowerCase().includes('paquete')) paquetes += enteros
    else cajas += enteros
    sueltas += f.vendido % porCaja
  }
  const partes: string[] = []
  if (cajas > 0) partes.push(`${cajas} ${cajas === 1 ? 'caja' : 'cajas'}`)
  if (paquetes > 0) partes.push(`${paquetes} ${paquetes === 1 ? 'paquete' : 'paquetes'}`)
  if (sueltas > 0) partes.push(`${sueltas} u.`)
  return partes.length > 0 ? partes.join(' + ') : '0'
}

export function formatoEmpaque(stock: number, producto?: Producto) {
  const porCaja = producto?.unidades_por_caja ?? 1
  if (porCaja <= 1) return `${stock} unidades`
  const nombre = (producto?.empaque_nombre || 'Caja').toLowerCase()
  const cajas = Math.floor(stock / porCaja)
  const sobrante = stock % porCaja
  if (cajas === 0 && sobrante > 0) return `${sobrante} u.`
  const textoCajas = `${cajas} ${nombre}${cajas === 1 ? '' : 's'}`
  return sobrante > 0 ? `${textoCajas} + ${sobrante} u.` : textoCajas
}
