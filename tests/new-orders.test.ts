import {test} from "node:test";
import assert from "node:assert/strict";
import {unseenOrderIds} from "../apps/merchant/lib/new-orders";
test("order notifications ignore baseline and previously seen IDs",()=>{
 assert.deepEqual(unseenOrderIds(null,["a"]),[]);
 const seen=new Set(["a","b"]);
 assert.deepEqual(unseenOrderIds(seen,["c","b","a"]),["c"]);
 seen.add("c");
 assert.deepEqual(unseenOrderIds(seen,["c","a"]),[]);
 // An order falling outside the recent list must not be announced on return.
 assert.deepEqual(unseenOrderIds(seen,["b","c","a"]),[]);
});
