export type TipoProducto = 'alcoholica' | 'sin_alcohol'

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

export interface Consumo {
  id: string
  producto_id: string
  bar_id: string
  cantidad: number
  motivo: string | null
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
