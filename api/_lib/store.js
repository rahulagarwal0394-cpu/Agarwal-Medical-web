var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..", "..");
var DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "db.json");
var STORE_KEY = "agarwal_medical_db";

function hasPostgres() {
  return !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);
}

function postgresSql() {
  try {
    return require("@vercel/postgres").sql;
  } catch (err) {
    throw new Error("Postgres is configured but @vercel/postgres is not installed. Run npm install.");
  }
}

function seedDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

async function ensurePostgresStore(sql) {
  await sql`CREATE TABLE IF NOT EXISTS app_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function readDb() {
  if (!hasPostgres()) {
    return seedDb();
  }

  var sql = postgresSql();
  await ensurePostgresStore(sql);
  var result = await sql`SELECT value FROM app_store WHERE key = ${STORE_KEY}`;
  if (result.rows.length) {
    return result.rows[0].value;
  }

  var initialDb = seedDb();
  await writeDb(initialDb);
  return initialDb;
}

async function writeDb(db) {
  if (!hasPostgres()) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return;
  }

  var sql = postgresSql();
  await ensurePostgresStore(sql);
  var value = JSON.stringify(db);
  await sql`INSERT INTO app_store (key, value, updated_at)
    VALUES (${STORE_KEY}, ${value}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = ${value}::jsonb, updated_at = NOW()`;
}

module.exports = {
  readDb: readDb,
  writeDb: writeDb
};
