import "../load-env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = createPool();
  const migrationsDir = path.resolve(__dirname, "../../migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const file of files) {
    const alreadyApplied = await pool.query(
      "select filename from schema_migrations where filename = $1",
      [file]
    );

    if (alreadyApplied.rowCount) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");

    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (filename) values ($1)", [file]);
      await pool.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
