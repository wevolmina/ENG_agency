import {authorizedUser} from "../../../lib/admin";
import {getPool} from "../../../lib/mysql";
import {customerReceipt} from "../../../lib/checkout";
import {cors,options} from "../../../lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const OPTIONS=options;
export async function GET(request:Request){
 const headers=cors(request),user=await authorizedUser(request);
 if(!user)return Response.json({error:"AUTH_REQUIRED"},{status:401,headers});
 const id=new URL(request.url).searchParams.get("paymentId")||"";
 if(!/^pay_[a-f0-9]{40}$/.test(id))return Response.json({error:"INVALID_INPUT"},{status:400,headers});
 try{const receipt=await customerReceipt(getPool(),user.uid,id);return Response.json(receipt||{error:"NOT_FOUND"},{status:receipt?200:404,headers});}
 catch{return Response.json({error:"MYSQL_UNAVAILABLE"},{status:503,headers});}
}
