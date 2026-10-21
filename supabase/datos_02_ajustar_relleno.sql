-- PASO 2 de 2: deja la bodega en 0 ajustando las ventas de relleno de "Bar grupera".
-- Correr DESPUÉS de datos_01. Todo corre junto: si algo falla no se guarda nada.
--
-- Lógica, para los productos de los pedidos y las devoluciones a proveedor:
--   * Si en bodega sobran unidades (stock positivo), no hay registro de que se vendieron:
--     se agrega un traslado de relleno a Bar grupera (4 oct, 12:00) por esa cantidad.
--   * Si el stock es negativo, la base tiene registradas más ventas de las reales:
--     se rebajan traslados de Bar grupera (los más recientes primero) por esa cantidad.
--   * Si Bar grupera no tiene suficientes traslados para rebajar, el script se detiene y
--     lista TODOS los productos con problema, sin cambiar nada.
--
-- Se puede correr más de una vez: si el stock ya es 0 no hace nada.

do $$
declare
  v_bar uuid;
  r record;
  fila record;
  falta numeric;
  tomar numeric;
  disponible numeric;
  problemas text := '';
begin
  select id into v_bar from bares where nombre = 'Bar grupera';
  if v_bar is null then raise exception 'No encontré el bar "Bar grupera".'; end if;

  -- Revisión previa: que haya de dónde rebajar.
  for r in
    select s.producto_id, s.nombre, s.stock_bodega
    from v_stock_bodega s
    where s.stock_bodega < 0
      and (s.total_devuelto_proveedor > 0
           or s.nombre in ('Coca cola 355ml', 'Coca cola zero', 'Fanta naranja', 'Fanta uva', 'Fanta kolita'))
  loop
    select coalesce(sum(cantidad), 0) into disponible
    from traslados where bar_id = v_bar and producto_id = r.producto_id;
    if disponible < -r.stock_bodega then
      problemas := problemas || format(E'\n- %s: faltan %s y Bar grupera solo tiene %s trasladadas',
        r.nombre, -r.stock_bodega, disponible);
    end if;
  end loop;
  if problemas <> '' then
    raise exception 'No se puede rebajar de Bar grupera:%', problemas;
  end if;

  -- Ajuste.
  for r in
    select s.producto_id, s.nombre, s.stock_bodega
    from v_stock_bodega s
    where s.stock_bodega <> 0
      and (s.total_devuelto_proveedor > 0
           or s.nombre in ('Coca cola 355ml', 'Coca cola zero', 'Fanta naranja', 'Fanta uva', 'Fanta kolita'))
  loop
    if r.stock_bodega > 0 then
      insert into traslados (producto_id, bar_id, cantidad, creado_en)
      values (r.producto_id, v_bar, r.stock_bodega, '2026-10-04 12:00:00-06');
    else
      falta := -r.stock_bodega;
      for fila in
        select id, cantidad from traslados
        where bar_id = v_bar and producto_id = r.producto_id
        order by creado_en desc
      loop
        exit when falta <= 0;
        tomar := least(fila.cantidad, falta);
        if tomar = fila.cantidad then
          delete from traslados where id = fila.id;
        else
          update traslados set cantidad = cantidad - tomar where id = fila.id;
        end if;
        falta := falta - tomar;
      end loop;
    end if;
  end loop;

  -- Seguridad: ningún bar puede quedar con "vendido" negativo.
  if exists (select 1 from v_movimientos_bar where vendido < 0) then
    raise exception 'Algún bar quedaría con ventas negativas. No se guardó nada.';
  end if;
end $$;

select s.nombre, s.total_entradas, s.total_devuelto_proveedor as devuelto_proveedor,
       s.stock_bodega,
       coalesce(sum(m.vendido), 0) as vendido_real
from v_stock_bodega s
left join v_movimientos_bar m on m.producto_id = s.producto_id
where s.total_devuelto_proveedor > 0
   or s.nombre in ('Coca cola 355ml', 'Coca cola zero', 'Fanta uva')
group by s.nombre, s.total_entradas, s.total_devuelto_proveedor, s.stock_bodega
order by s.nombre;
