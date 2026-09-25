import type { Producto } from './types'

export function formatoEmpaque(stock: number, producto?: Producto) {
  const porCaja = producto?.unidades_por_caja ?? 1
  if (porCaja <= 1) return `${stock} unidades`
  const nombre = (producto?.empaque_nombre || 'Caja').toLowerCase()
  const cajas = Math.floor(stock / porCaja)
  const sobrante = stock % porCaja
  const textoCajas = `${cajas} ${nombre}${cajas === 1 ? '' : 's'}`
  return sobrante > 0 ? `${textoCajas} + ${sobrante} u.` : textoCajas
}
