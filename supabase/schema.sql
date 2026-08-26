-- Esquema de base de datos para la app de inventario de licor.
-- Correr completo en Supabase: Dashboard -> SQL Editor -> New query -> pegar y ejecutar (Run).

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

create table if not exists consumos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  bar_id uuid not null references bares(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  motivo text,
  observaciones text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_entradas_producto on entradas_bodega(producto_id);
create index if not exists idx_traslados_producto on traslados(producto_id);
create index if not exists idx_traslados_bar on traslados(bar_id);
create index if not exists idx_consumos_producto on consumos(producto_id);
create index if not exists idx_consumos_bar on consumos(bar_id);

-- ============ VISTAS (stock y resumen, todo derivado, nada se guarda a mano) ============

create or replace view v_stock_bodega as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  coalesce(e.total, 0) as total_entradas,
  coalesce(t.total, 0) as total_trasladado,
  coalesce(e.total, 0) - coalesce(t.total, 0) as stock_bodega
from productos p
left join (select producto_id, sum(cantidad) total from entradas_bodega group by producto_id) e
  on e.producto_id = p.id
left join (select producto_id, sum(cantidad) total from traslados group by producto_id) t
  on t.producto_id = p.id;

create or replace view v_stock_bares as
with t as (
  select bar_id, producto_id, sum(cantidad) as total from traslados group by bar_id, producto_id
), c as (
  select bar_id, producto_id, sum(cantidad) as total from consumos group by bar_id, producto_id
), combos as (
  select bar_id, producto_id from t
  union
  select bar_id, producto_id from c
)
select
  combos.bar_id,
  b.nombre as bar_nombre,
  combos.producto_id,
  p.nombre as producto_nombre,
  p.tipo,
  coalesce(t.total, 0) as total_trasladado,
  coalesce(c.total, 0) as total_consumido,
  coalesce(t.total, 0) - coalesce(c.total, 0) as stock_bar
from combos
join bares b on b.id = combos.bar_id
join productos p on p.id = combos.producto_id
left join t on t.bar_id = combos.bar_id and t.producto_id = combos.producto_id
left join c on c.bar_id = combos.bar_id and c.producto_id = combos.producto_id;

create or replace view v_resumen_producto as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  p.costo_compra,
  p.precio_venta_porcion,
  coalesce(e.total_entradas, 0) as total_entradas,
  coalesce(cs.total_consumido, 0) as total_vendido,
  round(coalesce(e.total_entradas, 0) * p.costo_compra, 2) as costo_total,
  round(coalesce(cs.total_consumido, 0) * p.precio_venta_porcion, 2) as ingreso_total,
  round(coalesce(cs.total_consumido, 0) * p.precio_venta_porcion, 2)
    - round(coalesce(e.total_entradas, 0) * p.costo_compra, 2) as ganancia_total
from productos p
left join (select producto_id, sum(cantidad) total_entradas from entradas_bodega group by producto_id) e
  on e.producto_id = p.id
left join (select producto_id, sum(cantidad) total_consumido from consumos group by producto_id) cs
  on cs.producto_id = p.id;

-- Postgres 15+: hace que las vistas respeten los permisos/RLS del usuario que consulta,
-- no del dueño de la vista. Necesario para que las políticas de abajo apliquen también aquí.
alter view v_stock_bodega set (security_invoker = on);
alter view v_stock_bares set (security_invoker = on);
alter view v_resumen_producto set (security_invoker = on);

-- ============ ROW LEVEL SECURITY ============
-- Un solo rol de confianza: cualquier usuario autenticado (los 2-3 que se crean a mano
-- en Authentication -> Add user) puede leer y escribir todo. Nadie sin sesión (anon) puede.

alter table productos enable row level security;
alter table bares enable row level security;
alter table entradas_bodega enable row level security;
alter table traslados enable row level security;
alter table consumos enable row level security;

create policy "autenticados_todo_productos" on productos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_bares" on bares
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_entradas" on entradas_bodega
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_traslados" on traslados
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_consumos" on consumos
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
