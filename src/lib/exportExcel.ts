import { supabase } from './supabaseClient'
import type { ResumenBarRow, ResumenProductoRow, StockBodegaRow } from './types'

const MONEY_FMT = '#,##0'

const COLOR = {
  headerFill: 'FF3A6BC9',
  headerFont: 'FFFFFFFF',
  titleFill: 'FF16233D',
  titleFont: 'FF9DBBEE',
  zebra: 'FFEDF2FB',
  border: 'FFD7E3F5',
  negBg: 'FFFFC7CE',
  negFont: 'FF9C0006',
} as const

interface DatosExport {
  stockBodega: StockBodegaRow[]
  resumenBar: ResumenBarRow[]
  resumen: ResumenProductoRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Hoja = any

/**
 * Le da a una hoja un look consistente: fila de título con el color de marca,
 * encabezado resaltado, bordes + franjas alternadas en los datos, panel
 * congelado, autofiltro, y color de pestaña — en vez de una tabla pelada.
 */
function estilizarHoja(
  ws: Hoja,
  titulo: string,
  colCount: number,
  opts?: { negativeCol?: string }
) {
  ws.spliceRows(1, 0, [])
  ws.mergeCells(1, 1, 1, colCount)
  const tituloCelda = ws.getCell(1, 1)
  tituloCelda.value = titulo
  tituloCelda.font = { bold: true, size: 13, color: { argb: COLOR.titleFont } }
  tituloCelda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleFill } }
  tituloCelda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 26

  const headerRow = ws.getRow(2)
  headerRow.height = 20
  headerRow.eachCell((c: Fila) => {
    c.font = { bold: true, color: { argb: COLOR.headerFont } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerFill } }
    c.alignment = { vertical: 'middle' }
  })

  const negativeColNum = opts?.negativeCol
    ? (ws.getColumn(opts.negativeCol).number as number)
    : null

  for (let i = 3; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const zebra = (i - 3) % 2 === 1
    row.eachCell({ includeEmpty: true }, (c: Fila) => {
      c.border = {
        top: { style: 'thin', color: { argb: COLOR.border } },
        bottom: { style: 'thin', color: { argb: COLOR.border } },
        left: { style: 'thin', color: { argb: COLOR.border } },
        right: { style: 'thin', color: { argb: COLOR.border } },
      }
      if (zebra) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } }
      }
    })
    if (negativeColNum) {
      const c = row.getCell(negativeColNum)
      if (typeof c.value === 'number' && c.value < 0) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.negBg } }
        c.font = { bold: true, color: { argb: COLOR.negFont } }
      }
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 2 }]
  const lastCol = ws.getColumn(colCount).letter
  ws.autoFilter = `A2:${lastCol}2`
  ws.properties.tabColor = { argb: COLOR.headerFill }
}

export async function generarExcel(datos: DatosExport) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventario Fiesta'
  wb.created = new Date()

  const fechaTexto = new Date().toLocaleString('es-CR')

  // ---- Portada ----
  const ingreso = datos.resumen.reduce((acc, r) => acc + r.ingreso_total, 0)
  const costo = datos.resumen.reduce((acc, r) => acc + r.costo_total, 0)
  const ganancia = ingreso - costo
  const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0

  const wsPortada = wb.addWorksheet('Resumen del evento')
  wsPortada.columns = [
    { key: 'a', width: 26 },
    { key: 'b', width: 20 },
  ]
  wsPortada.mergeCells('A1:B1')
  const portadaTitulo = wsPortada.getCell('A1')
  portadaTitulo.value = '🍻 Inventario Fiesta — Reporte de cierre'
  portadaTitulo.font = { bold: true, size: 16, color: { argb: COLOR.titleFont } }
  portadaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleFill } }
  portadaTitulo.alignment = { vertical: 'middle', indent: 1 }
  wsPortada.getRow(1).height = 30

  wsPortada.mergeCells('A2:B2')
  wsPortada.getCell('A2').value = `Generado el ${fechaTexto}`
  wsPortada.getCell('A2').font = { italic: true, color: { argb: 'FF777777' } }
  wsPortada.addRow([])

  const kpis: [string, number | string][] = [
    ['Ingreso total (₡)', ingreso],
    ['Costo total (₡)', costo],
    ['Ganancia neta (₡)', ganancia],
    ['Margen', `${margen.toFixed(1)}%`],
  ]
  kpis.forEach(([label, value]) => {
    const row = wsPortada.addRow([label, value])
    row.getCell(1).font = { bold: true }
    if (typeof value === 'number') row.getCell(2).numFmt = MONEY_FMT
    row.getCell(2).font = { bold: true, size: 12, color: { argb: COLOR.headerFill } }
    row.eachCell((c: Fila) => {
      c.border = {
        top: { style: 'thin', color: { argb: COLOR.border } },
        bottom: { style: 'thin', color: { argb: COLOR.border } },
        left: { style: 'thin', color: { argb: COLOR.border } },
        right: { style: 'thin', color: { argb: COLOR.border } },
      }
    })
  })
  wsPortada.properties.tabColor = { argb: COLOR.titleFill }

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
  estilizarHoja(wsBar, 'Resumen por bar', 7)

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
  estilizarHoja(wsProd, 'Resumen por producto', 6)

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
  estilizarHoja(wsStock, 'Stock en bodega central', 5, { negativeCol: 'stock' })

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
  estilizarHoja(wsMov, 'Historial completo de movimientos', 7)

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
