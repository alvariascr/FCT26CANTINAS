export type TipoProducto = 'alcoholica' | 'sin_alcohol'
export type MotivoIncidencia = 'Rotura' | 'Pérdida' | 'Cortesía' | 'Otro'

export interface Producto {
  id: string
  nombre: string
  tipo: TipoProducto
  ml_botella: number | null
  ml_porcion: number | null
  costo_compra: number
  precio_venta_porcion: number
  activo: boolean
  creado_en: string
}

export interface Bar {
  id: string
  nombre: string
  es_cortesia: boolean
  activo: boolean
  creado_en: string
}

export interface Traslado {
  id: string
  producto_id: string
  bar_id: string
  cantidad: number
  usuario_id: string | null
  creado_en: string
}

export interface Devolucion {
  id: string
  producto_id: string
  bar_id: string
  cantidad: number
  usuario_id: string | null
  creado_en: string
}

export interface Incidencia {
  id: string
  producto_id: string
  bar_id: string
  cantidad: number
  motivo: MotivoIncidencia
  observaciones: string | null
  usuario_id: string | null
  creado_en: string
}

export interface EntradaBodega {
  id: string
  producto_id: string
  cantidad: number
  usuario_id: string | null
  creado_en: string
}

export interface StockBodegaRow {
  producto_id: string
  nombre: string
  tipo: TipoProducto
  total_entradas: number
  total_trasladado: number
  total_devuelto: number
  stock_bodega: number
}

export interface StockBarRow {
  bar_id: string
  bar_nombre: string
  producto_id: string
  producto_nombre: string
  tipo: TipoProducto
  total_trasladado: number
  total_consumido: number
  stock_bar: number
}

export interface MovimientoBarRow {
  bar_id: string
  bar_nombre: string
  es_cortesia: boolean
  producto_id: string
  producto_nombre: string
  tipo: TipoProducto
  costo_compra: number
  precio_venta_porcion: number
  total_trasladado: number
  total_devuelto: number
  total_incidencias: number
  vendido: number
  costo: number
  valor_equivalente: number
  ingreso: number
}

export interface ResumenBarRow {
  bar_id: string
  bar_nombre: string
  es_cortesia: boolean
  total_vendido: number
  costo_total: number
  ingreso_total: number
  valor_equivalente_total: number
  ganancia_total: number
}

export interface ResumenProductoRow {
  producto_id: string
  nombre: string
  tipo: TipoProducto
  costo_compra: number
  precio_venta_porcion: number
  total_entradas: number
  total_vendido: number
  costo_total: number
  ingreso_total: number
  ganancia_total: number
}
