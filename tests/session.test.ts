import {test} from "node:test";
import assert from "node:assert/strict";
import {accountIsActive} from "../apps/merchant/lib/session";
const claims={uid:"owner",auth_time:100};
test("anonymous account without revocation boundary is valid",()=>{assert.equal(accountIsActive({localId:"owner"},claims),true);});
test("missing or different account is denied",()=>{assert.equal(accountIsActive(undefined,claims),false);assert.equal(accountIsActive({localId:"other"},claims),false);});
test("disabled account is denied even with no revocation boundary",()=>{assert.equal(accountIsActive({localId:"owner",disabled:true},claims),false);});
test("revoked authentication is denied and boundary equality is valid",()=>{assert.equal(accountIsActive({localId:"owner",validSince:"101"},claims),false);assert.equal(accountIsActive({localId:"owner",validSince:"100"},claims),true);});
test("malformed revocation fields fail closed",()=>{for(const validSince of [null,100,"wrong","9007199254740993"]){assert.equal(accountIsActive({localId:"owner",validSince},claims),false);}assert.equal(accountIsActive({localId:"owner"},{...claims,auth_time:NaN}),false);});
