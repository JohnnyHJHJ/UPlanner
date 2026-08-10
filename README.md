# UPlanner — Vercel migration scaffold

This project is the backend replacement for the uploaded Canva UPlanner code.

## What was removed

- Canva telemetry SDK
- Canva data SDK
- Canva resizing SDK
- `window.dataSdk.init`
- `window.dataSdk.create`
- `window.dataSdk.update`
- `window.dataSdk.delete`
- client-side CSV import into Canva storage
- `sessionStorage` as the authoritative authentication mechanism

The current prototype frontend is intentionally small. The next migration step is to move the existing UPlanner views into `public/index.html` (or a Next.js frontend) while calling the API endpoints.

## Stack

- Vercel
- Vercel Functions
- PostgreSQL
- Plain HTML/CSS/JS frontend for the first migration
- Signed HTTP-only session cookie

## Database

Run `schema.sql` in your PostgreSQL database.

## Environment variables

Set in Vercel:

- `POSTGRES_URL` or the database variables provided by your Vercel/Neon integration
- `SESSION_SECRET` — long random secret

The DB helper uses `@vercel/postgres`.

## Deploy

1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Connect your Neon/Vercel Postgres integration.
4. Run `schema.sql`.
5. Set `SESSION_SECRET`.
6. Deploy.
7. Verify `/api/bootstrap`.

## CSV migration

The uploaded Canva export contains a single generic record stream with:
- users
- schedules
- entries
- groups
- group members
- user preferences

The migration script maps those into normalized PostgreSQL tables.

Before running it, install `pg` locally:

    npm install pg

Then:

    DATABASE_URL="YOUR_CONNECTION_STRING" node scripts/import-csv.mjs ./uplanner.csv

Do NOT expose your database connection string in frontend code.

## Security note

The original UPlanner intentionally uses username-only login. This scaffold preserves that behavior for migration compatibility. It is not strong authentication: anybody who knows a username can log in as that user. Before public launch, add passwords, passkeys, or an external identity provider.
