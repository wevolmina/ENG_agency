import {configuredAdminOrigin} from "./admin-http";
export function customerOrigins(env=process.env){
 return new Set((env.CUSTOMER_SITE_ORIGINS||"").split(",").map(value=>configuredAdminOrigin(value.trim())).filter((value):value is string=>!!value));
}
export function cors(request:Request){const origin=request.headers.get("origin");return {"Cache-Control":"private, no-store","Vary":"Origin",
 ...(origin&&customerOrigins().has(origin)?{"Access-Control-Allow-Origin":origin}:{}),
 "Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type"};}
export function options(request:Request){const origin=request.headers.get("origin");return new Response(null,{status:origin&&customerOrigins().has(origin)?204:403,headers:cors(request)});}
