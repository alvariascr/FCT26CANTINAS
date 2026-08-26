-- Corrige el cálculo de ingreso para licores vendidos por shot: una botella de 1L
-- rinde ~33 porciones de 30ml, y el ingreso debía multiplicarse por esa cantidad
-- de porciones, no calcularse como si cada botella fuera 1 solo trago.
-- No borra ni toca ningún dato, solo reemplaza esta vista.

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
  round(vendido * porciones_por_unidad * precio_venta_porcion, 2) as valor_equivalente,
  case
    when es_cortesia then 0
    else round(vendido * porciones_por_unidad * precio_venta_porcion, 2)
  end as ingreso
from base;

-- CREATE OR REPLACE VIEW resetea esta bandera a su valor por defecto (security definer),
-- que ignora el login obligatorio. Hay que volver a activarla siempre que se reemplace esta vista.
alter view v_movimientos_bar set (security_invoker = on);
