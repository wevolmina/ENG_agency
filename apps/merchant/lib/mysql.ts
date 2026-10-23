import mysql from "mysql2/promise";
import {attachDatabasePool} from "@vercel/functions";
let pool:mysql.Pool|undefined;
export function getPool() {
  if(pool) return pool;
  const {MYSQL_HOST:host,MYSQL_USER:user,MYSQL_PASSWORD:password,MYSQL_DATABASE:database}=process.env;
  if(!host||!user||!password||!database) throw new Error("DB_CONFIG_MISSING");
  const local=["localhost","127.0.0.1"].includes(host);
  if(process.env.MYSQL_TLS==="false" && !local) throw new Error("DB_TLS_REQUIRED");
  const ca=process.env.MYSQL_CA_BASE64?Buffer.from(process.env.MYSQL_CA_BASE64,"base64").toString("utf8"):undefined;
  pool=mysql.createPool({host,user,password,database,port:Number(process.env.MYSQL_PORT||3306),
    ssl:process.env.MYSQL_TLS==="false"?undefined:{rejectUnauthorized:true,ca},
    timezone:"Z",dateStrings:true,decimalNumbers:true,waitForConnections:true,
    connectionLimit:3,maxIdle:1,idleTimeout:10000,queueLimit:20,connectTimeout:10000});
  attachDatabasePool(pool);
  return pool;
}
