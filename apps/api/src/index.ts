import "./load-env.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./http/app.js";
import { createPool } from "./db/pool.js";
import { PgApplicationRepository } from "./repositories/pg-application-repository.js";

const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "dev-only-secret";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const webDistPath =
  process.env.WEB_DIST_PATH ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
const pool = createPool();
const repo = new PgApplicationRepository(pool);
const app = createApp({
  repo,
  jwtSecret,
  webOrigin,
  webDistPath
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
