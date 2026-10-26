import {readFile} from "node:fs/promises";
import mysql from "mysql2/promise";
const required=["MYSQL_HOST","MYSQL_USER","MYSQL_PASSWORD","MYSQL_DATABASE"];
if(required.some(key=>!process.env[key]))throw new Error("MySQL 환경 변수를 먼저 설정하세요.");
if(process.env.MYSQL_TLS==="false" && !["localhost","127.0.0.1"].includes(process.env.MYSQL_HOST))throw new Error("외부 MySQL은 TLS가 필요합니다.");
const connection=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,
  ssl:process.env.MYSQL_TLS==="false"?undefined:{rejectUnauthorized:true,ca:process.env.MYSQL_CA_BASE64?Buffer.from(process.env.MYSQL_CA_BASE64,"base64").toString():undefined}});
try{await connection.query(await readFile(new URL("../database/001-payments.sql",import.meta.url),"utf8"));for(const file of ["002-orders.sql","005-staff-access-requests.sql"])for(const sql of (await readFile(new URL("../database/"+file,import.meta.url),"utf8")).split(/;\s*(?:\n|$)/).filter(x=>x.trim()))await connection.query(sql);console.log("주문·결제·권한 신청 테이블 준비 완료");}finally{await connection.end();}
