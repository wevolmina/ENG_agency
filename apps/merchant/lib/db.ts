import pg from "pg";
import {attachDatabasePool} from "@vercel/functions";
export type RowDataPacket = Record<string, any>;
export interface Sql {
 execute<T = RowDataPacket[]>(sql:string, args?:readonly unknown[]):Promise<[T, unknown]>;
}
export interface PoolConnection extends Sql {
 beginTransaction():Promise<void>; commit():Promise<void>; rollback():Promise<void>; release():void;
}
export interface Pool extends Sql {getConnection():Promise<PoolConnection>; end():Promise<void>;}
export function parameters(sql:string){
 let n=0,quoted=false;
 return sql.replace(/''|'|\?/g,token=>{
  if(token==="''")return token;
  if(token==="'"){quoted=!quoted;return token}
  return quoted?token:"$"+(++n);
 });
}
pg.types.setTypeParser(1114, value=>value);
pg.types.setTypeParser(1082, value=>value);
let pool:Pool|undefined;
export function getPool():Pool {
 if(pool)return pool;
 const connectionString=process.env.DATABASE_URL;
 if(!connectionString)throw Error("DB_CONFIG_MISSING");
 const url=new URL(connectionString),local=["localhost","127.0.0.1","::1"].includes(url.hostname);
 if(!local&&url.searchParams.get("sslmode")==="disable")throw Error("DB_TLS_REQUIRED");
 for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])url.searchParams.delete(key);
 const native=new pg.Pool({connectionString:url.toString(),ssl:local?undefined:{rejectUnauthorized:true},
  max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,query_timeout:10000});
 native.on("error",()=>console.error("postgres_idle_connection_error"));
 attachDatabasePool(native);
 const execute=(client:pg.Pool|pg.PoolClient)=>async<T=RowDataPacket[]>(sql:string,args:readonly unknown[]=[])=>{
  const result=await client.query(parameters(sql),[...args]);
  return [result.rows as T, {affectedRows:result.rowCount}] as [T,unknown];
 };
 pool={execute:execute(native),end:()=>native.end(),getConnection:async()=>{
  const client=await native.connect();
  return {execute:execute(client),beginTransaction:async()=>{await client.query("BEGIN; SET LOCAL TIME ZONE 'UTC'; SET LOCAL statement_timeout = '10s'")},
   commit:async()=>{await client.query("COMMIT")},rollback:async()=>{await client.query("ROLLBACK")},release:()=>client.release()};
 }};
 return pool;
}
