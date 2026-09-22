-- Agrega soporte para contar productos por caja/paquete (ej. cerveza en cajas de 24,
-- refrescos en paquetes de 12) y deja el catálogo SOLO con los productos del primer
-- pedido real "Fiestas Tronadora" (2026-09-21): se borran los licores de botella y los
-- refrescos que no vinieron en este pedido (se agregan después cuando lleguen).
-- Correr en Supabase: Dashboard -> SQL Editor -> New query -> pegar y ejecutar (Run).

-- 1) Columnas nuevas en productos.
alter table productos add column if not exists unidades_por_caja numeric not null default 1;
alter table productos add column if not exists empaque_nombre text;

-- 2) Limpieza de movimientos de prueba (necesario para poder borrar productos, ya que
-- las tablas de movimientos no permiten borrar un producto mientras tenga movimientos).
-- Si ya tenías datos reales cargados que querías conservar, avisame antes de correr esto.
delete from incidencias;
delete from devoluciones;
delete from traslados;
delete from entradas_bodega;

-- 3) Borrar productos que no vinieron en este pedido.
delete from productos where nombre in (
  'Buchannans litro', 'Johnny negro litro', 'Old Parr litro', 'Royal litro',
  'J&B litro', 'Flor de caña litro', 'Centenario litro', 'Campari litro',
  'Cacique litro', 'Jagger litro',
  'Fresca 355ml', 'Tropical Té Blanco 350ml', 'Tropical Té frío melo 350ml',
  'Agua 600ml'
);

-- 4) Cervezas ya existentes: renombrar y cargar precio real de caja de 24
-- (₡19.000 costo / ₡36.000 venta por caja => ₡792 costo / ₡1.500 venta por unidad).
update productos set
  nombre = 'Imperial regular',
  costo_compra = 792,
  precio_venta_porcion = 1500,
  unidades_por_caja = 24,
  empaque_nombre = 'Caja'
where nombre = 'Imperial 350ml';

update productos set
  nombre = 'Imperial light',
  costo_compra = 792,
  precio_venta_porcion = 1500,
  unidades_por_caja = 24,
  empaque_nombre = 'Caja'
where nombre = 'Light 350ml';

update productos set
  nombre = 'Pilsen',
  costo_compra = 792,
  precio_venta_porcion = 1500,
  unidades_por_caja = 24,
  empaque_nombre = 'Caja'
where nombre = 'Pilsen 350 ml';

update productos set
  nombre = 'Silver',
  costo_compra = 792,
  precio_venta_porcion = 1500,
  unidades_por_caja = 24,
  empaque_nombre = 'Caja'
where nombre = 'Silver 350ml';

-- 5) Refresco que sí vino en el pedido: renombrar "frío melo 500ml" -> "melocotón 500ml".
update productos set nombre = 'Tropical Té melocotón 500ml'
where nombre = 'Tropical Té frío melo 500ml';

-- 6) Marcar paquete de 12 en los refrescos que quedan (Coca cola, Gin, Tropical Té
-- Blanco 500ml, Tropical Té melocotón 500ml).
update productos set
  unidades_por_caja = 12,
  empaque_nombre = 'Paquete'
where tipo = 'sin_alcohol';

-- 7) Productos nuevos del pedido "Fiestas Tronadora" (sin costo/precio todavía,
-- se cargan en 0 y se completan luego desde Catálogo). Guardado con NOT EXISTS
-- para poder correr este script más de una vez sin duplicar filas.
insert into productos (nombre, tipo, ml_botella, ml_porcion, costo_compra, precio_venta_porcion, unidades_por_caja, empaque_nombre)
select v.nombre, 'alcoholica', null, null, 0, 0, 24, 'Caja'
from (values
  ('Adam y Eva frutos rojos'),
  ('Adam y Eva Maracuyá'),
  ('Smirnoff negra'),
  ('Smirnoff roja'),
  ('Smirnoff verde'),
  ('Guarana'),
  ('Cuba')
) as v(nombre)
where not exists (select 1 from productos p where p.nombre = v.nombre);
