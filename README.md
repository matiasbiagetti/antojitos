# Antojitos

> Menos vueltas, más sabor.

Web app efímera para decidir qué se come en grupo: cada uno swipea categorías en privado y la app
cruza los votos. Producto: [`docs/product-spec.md`](docs/product-spec.md). Diseño técnico:
[`docs/superpowers/specs/2026-10-01-antojitos-poc-design.md`](docs/superpowers/specs/2026-10-01-antojitos-poc-design.md).

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para Supabase local)

## Desarrollo local

```bash
npm install
npm run db:start          # levanta Supabase local y aplica las migraciones
npx supabase status       # copiar DB URL, API URL y anon key
cp .env.example .env.local  # completar con esos valores
npm run dev               # http://localhost:3000
```

## Tests

```bash
npm test                  # dominio y cliente (sin base de datos)
npm run test:server       # comandos del servidor contra Supabase local
npm run test:e2e          # flujo multiusuario con Playwright (levanta `npm run dev`)
```

## Deploy (Supabase + Vercel)

1. Crear un proyecto en Supabase y aplicar las migraciones: `npx supabase link --project-ref <ref>`
   y `npx supabase db push`. Verificar en Database → Extensions que `pg_cron` esté activo.
2. Importar el repo en Vercel y configurar las variables de entorno:
   - `DATABASE_URL`: connection string del **pooler en modo transacción** (puerto 6543).
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: de Project Settings → API.
3. Métricas: [`docs/metrics.sql`](docs/metrics.sql).
