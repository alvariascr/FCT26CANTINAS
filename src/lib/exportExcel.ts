import { supabase } from './supabaseClient'
import type { ResumenBarRow, ResumenProductoRow, StockBodegaRow } from './types'

const MONEY_FMT = '#,##0'

interface DatosExport {
  stockBodega: StockBodegaRow[]
  resumenBar: ResumenBarRow[]
  resumen: ResumenProductoRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = any

export async function generarExcel(datos: DatosExport) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventario Fiesta'
  wb.created = new Date()

  // ---- Resumen por bar ----
  const wsBar = wb.addWorksheet('Resumen por bar')
  wsBar.columns = [
    { header: 'Bar', key: 'bar', width: 26 },
    { header: 'Cortesía', key: 'cortesia', width: 10 },
    { header: 'Vendido', key: 'vendido', width: 10 },
    { header: 'Ingreso (₡)', key: 'ingreso', width: 14 },
    { header: 'Costo (₡)', key: 'costo', width: 14 },
    { header: 'Ganancia (₡)', key: 'ganancia', width: 14 },
    { header: 'Valor equivalente (₡)', key: 'valor_eq', width: 18 },
  ]
  datos.resumenBar.forEach((b) => {
    wsBar.addRow({
      bar: b.bar_nombre,
      cortesia: b.es_cortesia ? 'Sí' : 'No',
      vendido: b.total_vendido,
      ingreso: b.ingreso_total,
      costo: b.costo_total,
      ganancia: b.ganancia_total,
      valor_eq: b.valor_equivalente_total,
    })
  })
  ;['ingreso', 'costo', 'ganancia', 'valor_eq'].forEach((k) => {
    wsBar.getColumn(k).numFmt = MONEY_FMT
  })
  wsBar.getRow(1).font = { bold: true }

  // ---- Resumen por producto ----
  const wsProd = wb.addWorksheet('Resumen por producto')
  wsProd.columns = [
    { header: 'Producto', key: 'producto', width: 28 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Vendido', key: 'vendido', width: 10 },
    { header: 'Ingreso (₡)', key: 'ingreso', width: 14 },
    { header: 'Costo (₡)', key: 'costo', width: 14 },
    { header: 'Ganancia (₡)', key: 'ganancia', width: 14 },
  ]
  datos.resumen.forEach((r) => {
    wsProd.addRow({
      producto: r.nombre,
      tipo: r.tipo === 'alcoholica' ? 'Alcohólica' : 'Sin alcohol',
      vendido: r.total_vendido,
      ingreso: r.ingreso_total,
      costo: r.costo_total,
      ganancia: r.ganancia_total,
    })
  })
  ;['ingreso', 'costo', 'ganancia'].forEach((k) => {
    wsProd.getColumn(k).numFmt = MONEY_FMT
  })
  wsProd.getRow(1).font = { bold: true }

  // ---- Stock en bodega ----
  const wsStock = wb.addWorksheet('Stock en bodega')
  wsStock.columns = [
    { header: 'Producto', key: 'producto', width: 28 },
    { header: 'Entradas', key: 'entradas', width: 12 },
    { header: 'Trasladado', key: 'trasladado', width: 12 },
    { header: 'Devuelto', key: 'devuelto', width: 12 },
    { header: 'Stock actual', key: 'stock', width: 12 },
  ]
  datos.stockBodega.forEach((s) => {
    wsStock.addRow({
      producto: s.nombre,
      entradas: s.total_entradas,
      trasladado: s.total_trasladado,
      devuelto: s.total_devuelto,
      stock: s.stock_bodega,
    })
  })
  wsStock.getRow(1).font = { bold: true }

  // ---- Movimientos (historial completo, sin limite) ----
  const [{ data: entradas }, { data: traslados }, { data: devoluciones }, { data: incidencias }] =
    await Promise.all([
      supabase
        .from('entradas_bodega')
        .select('cantidad, creado_en, productos(nombre)')
        .order('creado_en'),
      supabase
        .from('traslados')
        .select('cantidad, creado_en, productos(nombre), bares(nombre)')
        .order('creado_en'),
      supabase
        .from('devoluciones')
        .select('cantidad, creado_en, productos(nombre), bares(nombre)')
        .order('creado_en'),
      supabase
        .from('incidencias')
        .select('cantidad, motivo, observaciones, creado_en, productos(nombre), bares(nombre)')
        .order('creado_en'),
    ])

  const combinado: Fila[] = [
    ...(entradas ?? []).map((r: Fila) => ({
      tipo: 'Entrada',
      producto: r.productos?.nombre ?? '',
      bar: '',
      cantidad: r.cantidad,
      motivo: '',
      obs: '',
      creado_en: r.creado_en,
    })),
    ...(traslados ?? []).map((r: Fila) => ({
      tipo: 'Traslado',
      producto: r.productos?.nombre ?? '',
      bar: r.bares?.nombre ?? '',
      cantidad: r.cantidad,
      motivo: '',
      obs: '',
      creado_en: r.creado_en,
    })),
    ...(devoluciones ?? []).map((r: Fila) => ({
      tipo: 'Devolución',
      producto: r.productos?.nombre ?? '',
      bar: r.bares?.nombre ?? '',
      cantidad: r.cantidad,
      motivo: '',
      obs: '',
      creado_en: r.creado_en,
    })),
    ...(incidencias ?? []).map((r: Fila) => ({
      tipo: 'Incidencia',
      producto: r.productos?.nombre ?? '',
      bar: r.bares?.nombre ?? '',
      cantidad: r.cantidad,
      motivo: r.motivo ?? '',
      obs: r.observaciones ?? '',
      creado_en: r.creado_en,
    })),
  ].sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))

  const wsMov = wb.addWorksheet('Movimientos')
  wsMov.columns = [
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Producto', key: 'producto', width: 28 },
    { header: 'Bar', key: 'bar', width: 22 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Motivo', key: 'motivo', width: 14 },
    { header: 'Observaciones', key: 'obs', width: 32 },
  ]
  combinado.forEach((r) => {
    wsMov.addRow({
      tipo: r.tipo,
      fecha: new Date(r.creado_en).toLocaleString('es-CR'),
      producto: r.producto,
      bar: r.bar,
      cantidad: r.cantidad,
      motivo: r.motivo,
      obs: r.obs,
    })
  })
  wsMov.getRow(1).font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario-fiesta-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
