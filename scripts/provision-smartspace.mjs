// Explicitly provisions a NEW empty database. Never deletes or copies old data.
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
const env=process.env;
for(const key of ['MYSQL_HOST','MYSQL_USER','MYSQL_PASSWORD','MYSQL_DATABASE','SMARTSPACE_NEW_DATABASE','SMARTSPACE_SELLER_UID'])if(!env[key])throw Error(`Missing ${key}`);
const target=env.SMARTSPACE_NEW_DATABASE;
if(!/^paybridge_smartspace_[a-z0-9_]+$/.test(target)||target===env.MYSQL_DATABASE)throw Error('New database must have a distinct paybridge_smartspace_ name');
if(env.MYSQL_TLS==='false'&&!['localhost','127.0.0.1'].includes(env.MYSQL_HOST))throw Error('Remote TLS required');
if(env.SMARTSPACE_SELLER_UID.length>128)throw Error('Invalid seller UID');
if(env.SMARTSPACE_PROVISION!=='CREATE_NEW_EMPTY_DATABASE')throw Error('Set SMARTSPACE_PROVISION after identifying the existing seller and database');
const c=await mysql.createConnection({host:env.MYSQL_HOST,port:Number(env.MYSQL_PORT||3306),user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,ssl:env.MYSQL_TLS==='false'?undefined:{rejectUnauthorized:true,ca:env.MYSQL_CA_BASE64?Buffer.from(env.MYSQL_CA_BASE64,'base64').toString():undefined}});
try{
 const [existing]=await c.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[target]);
 if(existing.length)throw Error('Target already exists; inspect it manually. No automatic overwrite or retry.');
 await c.query(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
 await c.changeUser({database:target});
 const sql=await readFile(new URL('../database/smartspace-v2.sql',import.meta.url),'utf8');
 for(const statement of sql.split(/;\s*(?:\n|$)/).filter(x=>x.trim()))await c.query(statement);
 await c.execute("INSERT INTO staff_memberships (user_uid,merchant_id,role) VALUES (?,'studio-mina','merchant'),(?,'studio-mina','admin')",[env.SMARTSPACE_SELLER_UID,env.SMARTSPACE_SELLER_UID]);
 const [versions]=await c.query('SELECT version FROM schema_versions');
 const [roles]=await c.execute('SELECT role FROM staff_memberships WHERE user_uid=?',[env.SMARTSPACE_SELLER_UID]);
 console.log(JSON.stringify({database:target,schema:versions[0].version,roles:roles.map(r=>r.role),oldDatabaseUnchanged:true,authAccountsUnchanged:true}));
}finally{await c.end()}
