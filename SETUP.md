# Catán Dashboard — Guía de Setup

## 1. Base de datos (Supabase)

1. Ir a [supabase.com](https://supabase.com) → tu proyecto
2. Abrir **SQL Editor** y ejecutar el contenido de `supabase/schema.sql`
3. En **Authentication → Users**, crear un usuario admin con email y contraseña

## 2. Migración de datos históricos

Con el archivo `data/Catan_original.xlsx` en su lugar:

```bash
npx ts-node --esm scripts/migrate-from-excel.ts
```

> **Nota**: En Windows, si ts-node falla, usar:
> ```bash
> npx tsx scripts/migrate-from-excel.ts
> ```
> (requiere `npm install -D tsx`)

## 3. Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 4. Deploy en Vercel

1. Ir a [vercel.com](https://vercel.com) → Import Project → seleccionar este repo
2. Agregar las siguientes variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 5. Edge Function de backup (opcional)

1. Crear un Service Account en Google Cloud Console con acceso a Google Sheets API
2. Crear un Google Sheet con hojas llamadas: `Resultados`, `Eventos`, `Jugadores`
3. Compartir el Sheet con el email del Service Account
4. En Supabase → Edge Functions → Secrets, agregar:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` = JSON del service account (como string)
   - `SPREADSHEET_ID` = ID del Google Sheet (parte de la URL)
5. Deploy la función:
   ```bash
   supabase functions deploy backup-to-sheets
   ```
6. Configurar cron en Supabase Dashboard → Edge Functions → Schedules:
   - Expression: `0 2 * * 1` (lunes 02:00 UTC = domingo 23:00 Argentina)

## Acceso admin

URL: `/admin/login`
Credenciales: las del usuario creado en el paso 1.
