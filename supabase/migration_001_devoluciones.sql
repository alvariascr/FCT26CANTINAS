-- Migración para proyectos que ya corrieron el schema.sql original.
-- Correr una sola vez en el SQL Editor de Supabase.
-- Esto también limpia los movimientos de prueba (traslados, entradas, consumos) que
-- habíamos hablado de borrar, así que hacé esto en vez del DELETE suelto que te había
-- pasado antes.

alter table bares add column if not exists es_cortesia boolean not null default false;

create table if not exists devoluciones (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  bar_id uuid not null references bares(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index if not exists idx_devoluciones_producto on devoluciones(producto_id);
create index if not exists idx_devoluciones_bar on devoluciones(bar_id);
alter table devoluciones enable row level security;
drop policy if exists "autenticados_todo_devoluciones" on devoluciones;
create policy "autenticados_todo_devoluciones" on devoluciones
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table consumos rename to incidencias;
alter policy "autenticados_todo_consumos" on incidencias rename to "autenticados_todo_incidencias";

-- Limpieza de datos de prueba (incluye los movimientos de prueba que ya habíamos hablado
-- de borrar, más lo viejo de "consumos" que no encaja con los nuevos motivos permitidos).
delete from incidencias;
delete from traslados;
delete from entradas_bodega;

alter table incidencias alter column motivo set not null;
alter table incidencias drop constraint if exists incidencias_motivo_check;
alter table incidencias add constraint incidencias_motivo_check
  check (motivo in ('Rotura', 'Pérdida', 'Cortesía', 'Otro'));

drop view if exists v_stock_bares;
drop view if exists v_resumen_producto;
drop view if exists v_resumen_bar;
drop view if exists v_movimientos_bar;
drop view if exists v_stock_bodega;

create view v_stock_bodega as
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

create view v_movimientos_bar as
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
)
select
  combos.bar_id,
  b.nombre as bar_nombre,
  b.es_cortesia,
  combos.producto_id,
  p.nombre as producto_nombre,
  p.tipo,
  p.costo_compra,
  p.precio_venta_porcion,
  coalesce(t.total, 0) as total_trasladado,
  coalesce(d.total, 0) as total_devuelto,
  coalesce(i.total, 0) as total_incidencias,
  coalesce(t.total, 0) - coalesce(d.total, 0) - coalesce(i.total, 0) as vendido,
  round((coalesce(t.total, 0) - coalesce(d.total, 0) - coalesce(i.total, 0)) * p.costo_compra, 2)
    as costo,
  round((coalesce(t.total, 0) - coalesce(d.total, 0) - coalesce(i.total, 0)) * p.precio_venta_porcion, 2)
    as valor_equivalente,
  case
    when b.es_cortesia then 0
    else round((coalesce(t.total, 0) - coalesce(d.total, 0) - coalesce(i.total, 0)) * p.precio_venta_porcion, 2)
  end as ingreso
from combos
join bares b on b.id = combos.bar_id
join productos p on p.id = combos.producto_id
left join t on t.bar_id = combos.bar_id and t.producto_id = combos.producto_id
left join d on d.bar_id = combos.bar_id and d.producto_id = combos.producto_id
left join i on i.bar_id = combos.bar_id and i.producto_id = combos.producto_id;

create view v_stock_bares as
select bar_id, bar_nombre, producto_id, producto_nombre, tipo, total_trasladado,
  total_devuelto + total_incidencias as total_consumido,
  vendido as stock_bar
from v_movimientos_bar;

create view v_resumen_bar as
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

create view v_resumen_producto as
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

alter view v_stock_bodega set (security_invoker = on);
alter view v_movimientos_bar set (security_invoker = on);
alter view v_stock_bares set (security_invoker = on);
alter view v_resumen_bar set (security_invoker = on);
alter view v_resumen_producto set (security_invoker = on);
