# 🍻 Inventario Fiesta

App web sencilla para controlar el inventario de bebidas durante la fiesta del 2-3-4 de octubre.
Pensada para usarse desde el celular: cada persona inicia sesión, registra traslados de bodega a
cada bar y las salidas (ventas/cortesías/mermas), y el stock y las ganancias se calculan solos.

## 1. Crear el proyecto de Supabase

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta gratis y un **New project**.
2. Elegí una contraseña de base de datos (guardala, no hace falta para la app en sí).
3. Cuando el proyecto esté listo, andá a **Project Settings → API** y copiá:
   - **Project URL**
   - **anon public key**
4. Andá a **SQL Editor → New query**, pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   y dale **Run**. Esto crea las tablas, las vistas de stock/ganancias, las políticas de seguridad
   (RLS) y carga el catálogo de productos y los 3 bares del Excel como punto de partida.
5. Andá a **Authentication → Users → Add user** y creá ahí mismo (email + password, marcando
   "Auto Confirm User") a las 2-3 personas que van a usar la app. No hay registro público:
   los usuarios se crean solo desde acá.

## 2. Configurar el proyecto localmente

```bash
npm install
cp .env.example .env
```

Editá `.env` y pegá el `Project URL` y la `anon public key` de tu proyecto de Supabase.

```bash
npm run dev
```

Abrí la URL que te muestre la terminal (normalmente `http://localhost:5173/inventario_licor/`)
e iniciá sesión con uno de los usuarios que creaste en el paso 1.5.

## 3. Publicar en GitHub Pages

1. Creá un repo nuevo en GitHub llamado **`inventario_licor`** (si le ponés otro nombre, actualizá
   el valor de `base` en `vite.config.ts` para que coincida).
2. Subí este proyecto a ese repo (rama `main`).
3. En el repo, andá a **Settings → Pages** y en "Build and deployment" elegí **Source: GitHub Actions**.
4. En **Settings → Secrets and variables → Actions → New repository secret**, creá dos secretos:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (los mismos valores que pusiste en tu `.env` local)
5. Cada `push` a `main` dispara el workflow `.github/workflows/deploy.yml`, que construye la app
   y la publica. La URL final queda como `https://<tu-usuario>.github.io/inventario_licor/`.

> La `anon public key` de Supabase es segura de exponer en una app pública como esta: no da
> acceso por sí sola, el control de acceso real lo hacen las políticas RLS (solo usuarios logueados
> pueden leer/escribir), que ya vienen incluidas en `schema.sql`.

## Cómo está organizado

- **Bodega central**: se carga con "Entradas a bodega" desde la pantalla de Catálogo (reemplaza
  la hoja "Stock Inicial" del Excel).
- **Traslados**: mueven stock de la bodega a un bar específico.
- **Consumo**: cada bar registra sus salidas (venta, cortesía, merma) contra lo que tiene
  trasladado — reemplaza la bitácora "Día 1-5" del Excel, ya conectada automáticamente con el
  resumen (a diferencia del Excel, acá no hay doble digitación).
- **Resumen**: stock en bodega, stock por bar e ingreso/costo/ganancia/margen, todo calculado
  en vivo con vistas SQL (`v_stock_bodega`, `v_stock_bares`, `v_resumen_producto`).
- **Catálogo**: alta de productos y bares, edición de precios/costos, y carga de entradas a bodega.

## Stack

Vite + React + TypeScript + React Router (con `HashRouter`, para que las rutas funcionen bien en
GitHub Pages) + Supabase (Postgres, Auth y RLS), sin backend propio: el frontend habla directo con
Supabase desde el navegador.
