import {submitCheckout,options} from "../../../lib/checkout-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const OPTIONS=options;
export const POST=(request:Request)=>submitCheckout(request,"single");
