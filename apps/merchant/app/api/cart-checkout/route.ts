import {authorizedUser} from "../../../lib/admin";
import {getPool} from "../../../lib/mysql";
import {cartInput,existingCart,recordCartRequest,confirmCart} from "../../../lib/cart";
import {cors,options} from "../../../lib/http";
export const runtime="nodejs";export const dynamic="force-dynamic";export const OPTIONS=options;
export async function POST(request:Request){
 const headers=cors(request),user=await authorizedUser(request);if(!user)return Response.json({error:"AUTH_REQUIRED"},{status:401,headers});
 const text=await request.text();if(Buffer.byteLength(text)>2048)return Response.json({error:"INPUT_TOO_LARGE"},{status:413,headers});let value;try{value=JSON.parse(text)}catch{return Response.json({error:"INVALID_INPUT"},{status:400,headers})}
 const input=cartInput.safeParse(value);if(!input.success)return Response.json({error:"INVALID_INPUT"},{status:400,headers});
 try{const pool=getPool(),prior=await existingCart(pool,user.uid,input.data);if(prior)return Response.json(prior,{headers});await recordCartRequest(user.token,user.uid,input.data);return Response.json(await confirmCart(pool,user.uid,input.data),{headers})}
 catch(e){const code=e instanceof Error?e.message:"UNAVAILABLE",conflict=["REQUEST_CONFLICT","PACKAGE_UNAVAILABLE","PACKAGE_CHANGED"].includes(code);console.error("cart_checkout_failed",{requestId:input.data.requestId,code:conflict?code:"DEPENDENCY_UNAVAILABLE"});return Response.json({error:conflict?code:"CHECKOUT_UNAVAILABLE"},{status:conflict?409:503,headers})}
}
