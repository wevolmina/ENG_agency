const origins=new Set(["https://paybridge-mock.web.app","https://paybridge-mock.firebaseapp.com"]);
export function cors(request:Request){const origin=request.headers.get("origin");return {"Cache-Control":"private, no-store","Vary":"Origin",...(origin&&origins.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type"};}
export function options(request:Request){return new Response(null,{status:204,headers:cors(request)});}
