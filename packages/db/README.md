# db

This package contains the shared database logic and schema for the monorepo.

- Exports the Drizzle `db` instance and `baseSqliteDb` for Expo (via `expo-sqlite`).
- Manages schema with Drizzle migrations; do not rely on runtime table creation.
- Re-exports `useLiveQuery` and `useMigrations` for convenience in the Expo app.

How to generate migrations (from the app):

1. Switch to the `apps/expo-app` folder.
2. Run `yarn drizzle:generate` (this uses `apps/expo-app/drizzle.config.js`, which points at `packages/db/src/expo/schema.ts`).

In your Expo app, use Drizzle-generated migrations and the `useMigrations` hook to apply migrations at startup if needed, and use `useLiveQuery` to reactively read data.
