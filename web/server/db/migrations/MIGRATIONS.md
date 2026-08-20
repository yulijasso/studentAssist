# Migrations

The migration history was **squashed into a single baseline** (`0000_secret_drax.sql`)
because the previous `meta/` snapshot chain was corrupted by a bad merge (duplicate
`0005`–`0008` tags and missing snapshots), which broke `drizzle-kit generate`.

The baseline represents the full current schema. From here, `pnpm db:generate` and
`pnpm db:migrate` work normally.

## Fresh database

Nothing special — just run migrations:

```bash
make db-migrate
```

## Existing database (already ran the pre-squash migrations)

A one-time reconciliation is required, or `db:migrate` will try to re-create tables
that already exist and fail. Point the drizzle tracking table at the new baseline:

```sql
DELETE FROM drizzle.__drizzle_migrations;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('5047128ea87b4347907684d5abd55f763e07ad15b440bdb2bdc59a7888db34d5', 1787243200438);
```

After that, `db:migrate` is a no-op and future `db:generate` output applies cleanly.
