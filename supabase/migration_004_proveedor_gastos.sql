-- Devoluciones a proveedores (Zamora, Los Ángeles) y gastos que no son bebida
-- (hielo, vasos, gas, club soda, etc.).
-- Correr en Supabase: Dashboard -> SQL Editor -> New query -> pegar y ejecutar (Run).
-- No borra ni modifica datos existentes; se puede correr más de una vez.

-- 1) Lo que se le regresa físicamente al proveedor. Sale de la bodega y no cuenta como venta
-- ni como devolución de bar. Va aparte de "devoluciones" (esa es de bar a bodega).
create table if not exists devoluciones_proveedor (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  proveedor text not null,
  referencia text,
  cantidad numeric not null check (cantidad > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_devprov_producto on devoluciones_proveedor(producto_id);

-- 2) Gastos del evento que no son bebida. El monto es el total pagado (IVA incluido si aplica).
create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  proveedor text,
  referencia text,
  cantidad numeric,
  monto numeric(12, 2) not null check (monto > 0),
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

-- 3) El stock de bodega ahora también resta lo devuelto al proveedor. Las columnas que ya
-- existían quedan igual; la nueva va al final para no romper la app.
create or replace view v_stock_bodega as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  coalesce(e.total, 0) as total_entradas,
  coalesce(t.total, 0) as total_trasladado,
  coalesce(d.total, 0) as total_devuelto,
  coalesce(e.total, 0) - coalesce(t.total, 0) + coalesce(d.total, 0) - coalesce(dp.total, 0) as stock_bodega,
  coalesce(dp.total, 0) as total_devuelto_proveedor
from productos p
left join (select producto_id, sum(cantidad) total from entradas_bodega group by producto_id) e
  on e.producto_id = p.id
left join (select producto_id, sum(cantidad) total from traslados group by producto_id) t
  on t.producto_id = p.id
left join (select producto_id, sum(cantidad) total from devoluciones group by producto_id) d
  on d.producto_id = p.id
left join (select producto_id, sum(cantidad) total from devoluciones_proveedor group by producto_id) dp
  on dp.producto_id = p.id;

alter view v_stock_bodega set (security_invoker = on);

-- 4) Mismos permisos que el resto: cualquier usuario autenticado, nadie sin sesión.
alter table devoluciones_proveedor enable row level security;
alter table gastos enable row level security;

drop policy if exists "autenticados_todo_devoluciones_proveedor" on devoluciones_proveedor;
create policy "autenticados_todo_devoluciones_proveedor" on devoluciones_proveedor
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "autenticados_todo_gastos" on gastos;
create policy "autenticados_todo_gastos" on gastos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
