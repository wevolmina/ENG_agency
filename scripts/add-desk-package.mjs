// Add only the desk package to an already provisioned smartspace database.
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
const e=process.env;
if(e.DESK_MIGRATION!=='ADD_DESK_PACKAGE')throw Error('Explicit migration flag required');
if(!/^paybridge_smartspace_[a-z0-9_]+$/.test(e.MYSQL_DATABASE||''))throw Error('Unexpected target database');
const c=await mysql.createConnection({host:e.MYSQL_HOST,port:Number(e.MYSQL_PORT||3306),user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE,ssl:{rejectUnauthorized:true,ca:e.MYSQL_CA_BASE64?Buffer.from(e.MYSQL_CA_BASE64,'base64').toString():undefined}});
try{
 await c.beginTransaction();
 const [existing]=await c.execute('SELECT space_id,merchant_id,name,unit_price FROM packages WHERE product_id=? FOR UPDATE',['desk-focus']);
 const [versions]=await c.execute('SELECT version FROM schema_versions WHERE version=?',['desk-focus-v1']);
 if(existing.length||versions.length){
  if(existing.length!==1||versions.length!==1||existing[0].space_id!=='desk'||existing[0].merchant_id!=='studio-mina'||existing[0].name!=='데스크테리어 집중 패키지'||Number(existing[0].unit_price)!==79000)throw Error('Existing desk migration differs; inspect without overwriting');
  await c.commit();console.log(JSON.stringify({alreadyApplied:true,productId:'desk-focus',price:79000}));
 }else{
  const sql=await readFile(new URL('../database/004-desk-package.sql',import.meta.url),'utf8');
  for(const statement of sql.split(/;\s*(?:\n|$)/).filter(s=>s.trim()))await c.query(statement);
  await c.commit();console.log(JSON.stringify({applied:true,productId:'desk-focus',price:79000,existingOrdersPreserved:true}));
 }
}catch(error){await c.rollback();throw error}finally{await c.end()}
