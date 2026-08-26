-- Esquema de base de datos para la app de inventario de licor.
-- Correr completo en Supabase: Dashboard -> SQL Editor -> New query -> pegar y ejecutar (Run).
-- (Si ya tenías una versión anterior de este esquema corrida en tu proyecto, no vuelvas a
-- correr este archivo entero: usá el script de migración que se entrega aparte.)

create extension if not exists "pgcrypto";

-- ============ TABLAS ============

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('alcoholica', 'sin_alcohol')),
  ml_botella numeric,
  ml_porcion numeric,
  costo_compra numeric not null default 0,
  precio_venta_porcion numeric not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists bares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  -- Un bar/actividad "de cortesía" (ej. bebida gratis en una comisión) se traslada y se
  -- devuelve igual que cualquier bar, pero lo consumido ahí NUNCA suma al ingreso/ganancia
  -- del evento (solo se ve como "valor equivalente", informativo).
  es_cortesia boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists entradas_bodega (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create table if not exists traslados (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  bar_id uuid not null references bares(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

-- Conteo de lo que sobró en un bar al cierre del evento (una sola vez, al final).
-- Vuelve a sumar a la bodega y se resta de lo "vendido" de ese bar.
create table if not exists devoluciones (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  bar_id uuid not null references bares(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

-- Casos puntuales durante el evento que hay que restar de "vendido" aunque la botella
-- nunca vuelva físicamente a bodega: se rompió, se perdió, o fue una cortesía suelta
-- en un bar que normalmente sí vende.
create table if not exists incidencias (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  bar_id uuid not null references bares(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  motivo text not null check (motivo in ('Rotura', 'Pérdida', 'Cortesía', 'Otro')),
  observaciones text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_entradas_producto on entradas_bodega(producto_id);
create index if not exists idx_traslados_producto on traslados(producto_id);
create index if not exists idx_traslados_bar on traslados(bar_id);
create index if not exists idx_devoluciones_producto on devoluciones(producto_id);
create index if not exists idx_devoluciones_bar on devoluciones(bar_id);
create index if not exists idx_incidencias_producto on incidencias(producto_id);
create index if not exists idx_incidencias_bar on incidencias(bar_id);

-- ============ VISTAS (stock y resumen, todo derivado, nada se guarda a mano) ============

create or replace view v_stock_bodega as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  coalesce(e.total, 0) as total_entradas,
  coalesce(t.total, 0) as total_trasladado,
  coalesce(d.total, 0) as total_devuelto,
  coalesce(e.total, 0) - coalesce(t.total, 0) + coalesce(d.total, 0) as stock_bodega
from productos p
left join (select producto_id, sum(cantidad) total from entradas_bodega group by producto_id) e
  on e.producto_id = p.id
left join (select producto_id, sum(cantidad) total from traslados group by producto_id) t
  on t.producto_id = p.id
left join (select producto_id, sum(cantidad) total from devoluciones group by producto_id) d
  on d.producto_id = p.id;

-- Detalle por bar y producto: cuánto entró, cuánto volvió, cuánto se rompió/perdió/regaló
-- suelto, y por diferencia cuánto se vendió de verdad.
-- Ojo con las "porciones por unidad": una botella de licor de 1L rinde ~33 shots de 30ml,
-- así que el ingreso de lo vendido se calcula en PORCIONES (botellas x porciones_por_unidad),
-- no en botellas — si no, se subestima el ingreso real de los licores por ~33 veces.
-- El costo, en cambio, sí es por botella (así se compra), y "vendido" se sigue mostrando en
-- botellas porque así es como se traslada/devuelve físicamente el stock.
create or replace view v_movimientos_bar as
with t as (
  select bar_id, producto_id, sum(cantidad) as total from traslados group by bar_id, producto_id
), d as (
  select bar_id, producto_id, sum(cantidad) as total from devoluciones group by bar_id, producto_id
), i as (
  select bar_id, producto_id, sum(cantidad) as total from incidencias group by bar_id, producto_id
), combos as (
  select bar_id, producto_id from t
  union
  select bar_id, producto_id from d
  union
  select bar_id, producto_id from i
), base as (
  select
    combos.bar_id,
    b.nombre as bar_nombre,
    b.es_cortesia,
    combos.producto_id,
    p.nombre as producto_nombre,
    p.tipo,
    p.costo_compra,
    p.precio_venta_porcion,
    case
      when p.ml_botella is not null and p.ml_porcion is not null and p.ml_porcion > 0
      then p.ml_botella / p.ml_porcion
      else 1
    end as porciones_por_unidad,
    coalesce(t.total, 0) as total_trasladado,
    coalesce(d.total, 0) as total_devuelto,
    coalesce(i.total, 0) as total_incidencias,
    coalesce(t.total, 0) - coalesce(d.total, 0) - coalesce(i.total, 0) as vendido
  from combos
  join bares b on b.id = combos.bar_id
  join productos p on p.id = combos.producto_id
  left join t on t.bar_id = combos.bar_id and t.producto_id = combos.producto_id
  left join d on d.bar_id = combos.bar_id and d.producto_id = combos.producto_id
  left join i on i.bar_id = combos.bar_id and i.producto_id = combos.producto_id
)
select
  bar_id,
  bar_nombre,
  es_cortesia,
  producto_id,
  producto_nombre,
  tipo,
  costo_compra,
  precio_venta_porcion,
  total_trasladado,
  total_devuelto,
  total_incidencias,
  vendido,
  round(vendido * costo_compra, 2) as costo,
  -- valor_equivalente: cuánto hubiera generado si se vendiera, sin importar si el bar es de cortesía.
  round(vendido * porciones_por_unidad * precio_venta_porcion, 2) as valor_equivalente,
  -- ingreso real: 0 en bares de cortesía, sin importar cuánto se haya "vendido" ahí.
  case
    when es_cortesia then 0
    else round(vendido * porciones_por_unidad * precio_venta_porcion, 2)
  end as ingreso
from base;

-- Stock que queda físicamente en cada bar ahora mismo (lo trasladado menos lo que ya
-- se sabe que salió: devuelto + incidencias).
create or replace view v_stock_bares as
select bar_id, bar_nombre, producto_id, producto_nombre, tipo, total_trasladado,
  total_devuelto + total_incidencias as total_consumido,
  vendido as stock_bar
from v_movimientos_bar;

-- Resumen por bar: para comparar qué cantina vendió más/menos.
create or replace view v_resumen_bar as
select
  bar_id,
  bar_nombre,
  es_cortesia,
  sum(vendido) as total_vendido,
  sum(costo) as costo_total,
  sum(ingreso) as ingreso_total,
  sum(valor_equivalente) as valor_equivalente_total,
  sum(ingreso) - sum(costo) as ganancia_total
from v_movimientos_bar
group by bar_id, bar_nombre, es_cortesia;

-- Resumen por producto, sumado across todos los bares (para la tabla "ventas por producto").
create or replace view v_resumen_producto as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  p.costo_compra,
  p.precio_venta_porcion,
  coalesce(e.total_entradas, 0) as total_entradas,
  coalesce(m.total_vendido, 0) as total_vendido,
  coalesce(m.costo_total, 0) as costo_total,
  coalesce(m.ingreso_total, 0) as ingreso_total,
  coalesce(m.ingreso_total, 0) - coalesce(m.costo_total, 0) as ganancia_total
from productos p
left join (select producto_id, sum(cantidad) total_entradas from entradas_bodega group by producto_id) e
  on e.producto_id = p.id
left join (
  select producto_id, sum(vendido) total_vendido, sum(costo) costo_total, sum(ingreso) ingreso_total
  from v_movimientos_bar
  group by producto_id
) m on m.producto_id = p.id;

-- Postgres 15+: hace que las vistas respeten los permisos/RLS del usuario que consulta,
-- no del dueño de la vista. Necesario para que las políticas de abajo apliquen también aquí.
alter view v_stock_bodega set (security_invoker = on);
alter view v_movimientos_bar set (security_invoker = on);
alter view v_stock_bares set (security_invoker = on);
alter view v_resumen_bar set (security_invoker = on);
alter view v_resumen_producto set (security_invoker = on);

-- ============ ROW LEVEL SECURITY ============
-- Un solo rol de confianza: cualquier usuario autenticado (los 2-3 que se crean a mano
-- en Authentication -> Add user) puede leer y escribir todo. Nadie sin sesión (anon) puede.

alter table productos enable row level security;
alter table bares enable row level security;
alter table entradas_bodega enable row level security;
alter table traslados enable row level security;
alter table devoluciones enable row level security;
alter table incidencias enable row level security;

create policy "autenticados_todo_productos" on productos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_bares" on bares
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_entradas" on entradas_bodega
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_traslados" on traslados
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_devoluciones" on devoluciones
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_incidencias" on incidencias
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============ DATOS INICIALES: catálogo tomado del Excel ============
-- Ajustá nombres/precios/costos libremente desde la pantalla de Catálogo una vez
-- que la app esté corriendo; esto solo es un punto de partida para no arrancar vacío.

insert into bares (nombre) values
  ('Bar grupera'),
  ('Bar redondel arriba'),
  ('Bar redondel abajo')
on conflict (nombre) do nothing;

insert into productos (nombre, tipo, ml_botella, ml_porcion, costo_compra, precio_venta_porcion) values
  ('Imperial 350ml', 'alcoholica', 350, 350, 19000, 36000),
  ('Light 350ml', 'alcoholica', 350, 350, 19000, 36000),
  ('Pilsen 350 ml', 'alcoholica', 350, 350, 19000, 36000),
  ('Silver 350ml', 'alcoholica', 350, 350, 19000, 36000),
  ('Buchannans litro', 'alcoholica', 1000, 30, 0, 3000),
  ('Johnny negro litro', 'alcoholica', 1000, 30, 0, 3000),
  ('Old Parr litro', 'alcoholica', 1000, 30, 0, 3000),
  ('Royal litro', 'alcoholica', 1000, 30, 0, 1000),
  ('J&B litro', 'alcoholica', 1000, 30, 0, 2000),
  ('Flor de caña litro', 'alcoholica', 1000, 30, 0, 2000),
  ('Centenario litro', 'alcoholica', 1000, 30, 0, 2000),
  ('Campari litro', 'alcoholica', 1000, 30, 0, 2000),
  ('Cacique litro', 'alcoholica', 1000, 30, 0, 1000),
  ('Jagger litro', 'alcoholica', 1000, 30, 0, 2000),
  ('Coca cola 355ml', 'sin_alcohol', 500, 500, 0, 0),
  ('Gin 355ml', 'sin_alcohol', 500, 500, 0, 0),
  ('Fresca 355ml', 'sin_alcohol', 350, 350, 0, 0),
  ('Tropical Té Blanco 500ml', 'sin_alcohol', 350, 350, 0, 0),
  ('Tropical Té frío melo 500ml', 'sin_alcohol', 350, 350, 0, 0),
  ('Tropical Té frío melo 350ml', 'sin_alcohol', 300, 300, 0, 0),
  ('Tropical Té Blanco 350ml', 'sin_alcohol', 300, 300, 0, 0),
  ('Agua 600ml', 'sin_alcohol', 600, 600, 0, 0)
on conflict do nothing;
