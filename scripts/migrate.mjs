import pg from "pg";
import {readFile} from "node:fs/promises";
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required");
const url=new URL(process.env.DATABASE_URL);
const local=["localhost","127.0.0.1","::1"].includes(url.hostname);
if(!local&&url.searchParams.get("sslmode")==="disable")throw Error("Remote TLS required");
for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])url.searchParams.delete(key);
const c=new pg.Client({connectionString:url.toString(),ssl:local?undefined:{rejectUnauthorized:true}});
await c.connect();
try{
 await c.query("BEGIN");
 await c.query("SELECT pg_advisory_xact_lock(70621026)");
 await c.query("CREATE TABLE IF NOT EXISTS app_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
 const found=await c.query("SELECT version FROM app_migrations WHERE version=$1",["postgres-initial-v1"]);
 if(!found.rowCount){
  const existing=await c.query("SELECT to_regclass('public.orders') AS orders,to_regclass('public.packages') AS packages");
  if(existing.rows[0].orders||existing.rows[0].packages)throw Error("Existing tables found; inspect database instead of overwriting");
  await c.query(await readFile(new URL("../database/postgres/001-initial.sql",import.meta.url),"utf8"));
  await c.query("INSERT INTO app_migrations(version) VALUES($1)",["postgres-initial-v1"]);
 }
 await c.query("COMMIT");console.log("PostgreSQL schema ready; existing data was not replaced.");
}catch(e){await c.query("ROLLBACK");throw e}finally{await c.end()}
