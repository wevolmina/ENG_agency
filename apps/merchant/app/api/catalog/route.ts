import {spaceCatalog} from "../../../lib/catalog";
import {getPool} from "../../../lib/db";
import {cors,options} from "../../../lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const OPTIONS=options;
export async function GET(request:Request){
 const headers=cors(request);
 try{return Response.json({packages:await spaceCatalog(getPool()),mode:"mock"},{headers})}
 catch{return Response.json({error:"CATALOG_UNAVAILABLE"},{status:503,headers})}
}
