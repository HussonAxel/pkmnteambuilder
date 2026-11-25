// Applies the SQL migrations in src/migrations to DATABASE_URL, then exits. Idempotent: drizzle records
// what ran in __drizzle_migrations, so it's safe on every start. The container runs it before the
// server (apps/web/Dockerfile); locally: pnpm db:migrate:run (DATABASE_URL from the environment).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url });
try {
  await migrate(drizzle({ client }), {
    migrationsFolder: new URL("../src/migrations", import.meta.url).pathname,
  });
  console.log("migrate: database is up to date");
} catch (error) {
  console.error("migrate: failed", error);
  process.exitCode = 1;
} finally {
  client.close();
}
