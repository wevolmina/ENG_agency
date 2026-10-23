import {verifySignature,syncSchema} from "../../../../../../functions/src/domain";
import {getPool} from "../../../../lib/mysql";
import {persistPayment} from "../../../../lib/payments";
export const runtime="nodejs";
export async function POST(request:Request) {
  const secret=process.env.SYNC_SHARED_SECRET;
  if(!secret || secret.length<32) return Response.json({error:"SYNC_NOT_CONFIGURED"},{status:503});
  // Bound streamed bodies too; Content-Length alone cannot protect this endpoint.
  const reader=request.body?.getReader();
  if(!reader) return Response.json({error:"EMPTY_BODY"},{status:400});
  const chunks:Uint8Array[]=[];let length=0;
  while(true) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
    if(length>16384){await reader.cancel();return Response.json({error:"BODY_TOO_LARGE"},{status:413});}chunks.push(value);}
  const body=Buffer.concat(chunks).toString("utf8");
  if(!verifySignature(body,request.headers.get("x-sync-timestamp")||"",request.headers.get("x-sync-signature")||"",secret)) return Response.json({error:"INVALID_SIGNATURE"},{status:401});
  let input;
  try {input=syncSchema.parse(JSON.parse(body));} catch {return Response.json({error:"INVALID_PAYMENT"},{status:400});}
  try {await persistPayment(getPool(),input.payment);return Response.json({ok:true,paymentId:input.payment.paymentId});}
  catch(error) {const conflict=error instanceof Error && error.message==="PAYMENT_CONFLICT";
    console.error("sync_payment_failed",{paymentId:input.payment.paymentId,code:conflict?"PAYMENT_CONFLICT":"MYSQL_UNAVAILABLE"});
    return Response.json({error:conflict?"PAYMENT_CONFLICT":"MYSQL_UNAVAILABLE"},{status:conflict?409:503});}
}
