-- PASO 1 de 2: registra lo que falta de los pedidos, las devoluciones a proveedores y los gastos.
-- Correr DESPUÉS de migration_004. Todo corre junto: si algo falla no se guarda nada.
-- Se puede correr UNA sola vez (si ya se corrió, se detiene con un aviso).
--
-- Qué hace:
--   a) Crea los productos nuevos (Fanta x3, Coca cola zero) y deja la Heineken lista.
--   b) Restaura las entradas de la proforma 13032 (cervezas) y suma las de la 13034 y Heineken.
--   c) Registra la devolución a Zamora (proforma 13070) y las 32 cajas devueltas a Los Ángeles.
--   d) Carga los gastos que no son bebida (hielo, vasos, gas, club soda), IVA incluido salvo el gas.
--   e) Ajusta el costo de Imperial, Light y Silver al promedio real entre Zamora y Los Ángeles.
--
-- Supuestos (revisalos):
--   * Los Ángeles: ₡18.000 la caja de 24 con IVA = ₡750,00 por unidad.
--   * Las 32 cajas devueltas a Los Ángeles fueron: Imperial regular 336, Imperial light 336,
--     Silver 96 (es lo que hoy figura como stock en bodega, y suma 768 = 32 cajas).
--   * Heineken: precio de venta NO se toca. Revisalo en Catálogo.
--
-- El resultado final muestra el stock de bodega de los productos afectados. Un número NEGATIVO
-- significa que la base tiene registradas más ventas de las reales, uno POSITIVO que faltan
-- ventas por registrar. El paso 2 lo deja todo en 0.

do $$
declare
  n int;
begin
  if exists (select 1 from devoluciones_proveedor where referencia = '13070') then
    raise exception 'Este script ya se corrió (existe la devolución 13070). No se hizo nada.';
  end if;

  -- a) Productos nuevos de la proforma 13034 (refrescos, paquete de 12, ₡438,06 con IVA, venta ₡1.000).
  insert into productos (nombre, tipo, ml_botella, ml_porcion, costo_compra, precio_venta_porcion, unidades_por_caja, empaque_nombre)
  select v.nombre, 'sin_alcohol', null, null, 438.06, 1000, 12, 'Paquete'
  from (values ('Coca cola zero'), ('Fanta naranja'), ('Fanta uva'), ('Fanta kolita')) as v(nombre)
  where not exists (select 1 from productos p where p.nombre = v.nombre);

  -- Heineken de vidrio (proforma 13032): ₡936,50 + IVA = ₡1.058,24 la unidad, caja de 24.
  update productos set
    nombre = 'Heineken',
    tipo = 'alcoholica',
    ml_botella = null,
    ml_porcion = null,
    costo_compra = 1058.24,
    unidades_por_caja = 24,
    empaque_nombre = 'Caja'
  where nombre in ('Heineken 0', 'Heineken');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No encontré exactamente un producto Heineken (encontré %).', n; end if;

  -- e) Costo promedio real de las cervezas con dos proveedores:
  --    (unidades netas Zamora x 829,17 + unidades netas Los Ángeles x 750) / unidades netas totales.
  --    Neto = comprado menos devuelto.
  update productos set costo_compra = round((3299 * 829.17 + 864 * 750) / 4163.0, 2) where nombre = 'Imperial regular';
  update productos set costo_compra = round((4086 * 829.17 + 864 * 750) / 4950.0, 2) where nombre = 'Imperial light';
  update productos set costo_compra = round((937 * 829.17 + 318 * 750) / 1255.0, 2) where nombre = 'Silver';

  -- b) Entradas que faltaban: proforma 13032 (cervezas y Heineken) y 13034 (refrescos).
  insert into entradas_bodega (producto_id, cantidad, creado_en)
  select p.id, v.cantidad, v.fecha::timestamptz
  from (values
    ('Imperial regular', 480, '2026-10-03 12:00:00-06'),
    ('Imperial light',   600, '2026-10-03 12:00:00-06'),
    ('Pilsen',           360, '2026-10-03 12:00:00-06'),
    ('Silver',           240, '2026-10-03 12:00:00-06'),
    ('Heineken',          72, '2026-10-03 12:00:00-06'),
    ('Coca cola 355ml',   36, '2026-10-03 12:00:00-06'),
    ('Coca cola zero',    60, '2026-10-03 12:00:00-06'),
    ('Fanta naranja',     96, '2026-10-03 12:00:00-06'),
    ('Fanta uva',         72, '2026-10-03 12:00:00-06'),
    ('Fanta kolita',      96, '2026-10-03 12:00:00-06')
  ) as v(nombre, cantidad, fecha)
  join productos p on p.nombre = v.nombre;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'Entradas: esperaba 10 productos y encontré %.', n; end if;

  -- c) Devolución a Zamora, proforma 13070 (8 de octubre). Natural Light no está en el catálogo
  -- (se compró y se devolvió completa, no afecta nada).
  insert into devoluciones_proveedor (producto_id, proveedor, referencia, cantidad, creado_en)
  select p.id, 'Zamora', '13070', v.cantidad, '2026-10-08 12:00:00-06'::timestamptz
  from (values
    ('Imperial regular', 865),
    ('Imperial light', 258),
    ('Silver', 263),
    ('Pilsen', 387),
    ('Tropical Té Blanco 500ml', 167),
    ('Tropical Té Blanco 355ml', 188),
    ('Tropical Té melocotón 500ml', 40),
    ('Tropical Té melocotón 350ml', 111),
    ('Fresca toronja 355ml', 121),
    ('Ginger ale 355ml', 21),
    ('Fanta naranja', 11),
    ('Fanta kolita', 1),
    ('Smirnoff roja', 23),
    ('Guarana', 14),
    ('Smirnoff verde', 18),
    ('Cuba', 22),
    ('Adam y Eva Maracuyá', 36),
    ('Adam y Eva frutos rojos', 101),
    ('Heineken', 7)
  ) as v(nombre, cantidad)
  join productos p on p.nombre = v.nombre;
  get diagnostics n = row_count;
  if n <> 19 then raise exception 'Devolución Zamora: esperaba 19 productos y encontré %.', n; end if;

  -- Devolución a Los Ángeles: 32 cajas (768 unidades).
  insert into devoluciones_proveedor (producto_id, proveedor, referencia, cantidad)
  select p.id, 'Los Ángeles', null, v.cantidad
  from (values
    ('Imperial regular', 336),
    ('Imperial light', 336),
    ('Silver', 96)
  ) as v(nombre, cantidad)
  join productos p on p.nombre = v.nombre;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Devolución Los Ángeles: esperaba 3 productos y encontré %.', n; end if;

  -- d) Gastos que no son bebida. Monto con IVA (13%), excepto el gas que no lleva impuesto.
  insert into gastos (concepto, proveedor, referencia, cantidad, monto, creado_en) values
    ('Hielo cristal 10 kg',            'Zamora', '12982', 150, 438581.25, '2026-09-29 12:00:00-06'),
    ('Vasos plásticos cerveceros',     'Zamora', '13020',  28,  37950.00, '2026-10-02 12:00:00-06'),
    ('Cilindro de gas 25 lb (recarga)','Zamora', '13032',   2,  13650.00, '2026-10-03 12:00:00-06'),
    ('Vasos plásticos cerveceros',     'Zamora', '13032',  20,  27107.12, '2026-10-03 12:00:00-06'),
    ('Club soda Canada Dry 600 ml',    'Zamora', '13032',  36,  28520.60, '2026-10-03 12:00:00-06'),
    ('Hielo cristal 10 kg',            'Zamora', '13038',  17,  51850.00, '2026-10-04 12:00:00-06');
end $$;

select nombre, total_entradas, total_trasladado, total_devuelto, total_devuelto_proveedor, stock_bodega
from v_stock_bodega
where total_devuelto_proveedor > 0
   or nombre in ('Coca cola 355ml', 'Coca cola zero', 'Fanta uva')
order by nombre;
