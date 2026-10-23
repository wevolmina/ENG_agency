type Account={localId?:unknown;disabled?:unknown;validSince?:unknown};
// Firebase Admin treats an absent validSince as no revocation boundary.
// Only use after signature verification and a successful online account lookup.
export function accountIsActive(user:Account|undefined,claims:{uid:string;auth_time:number}){
  if(!user||user.localId!==claims.uid||!Number.isFinite(claims.auth_time))return false;
  if(user.disabled!==undefined&&user.disabled!==false)return false;
  if(user.validSince===undefined)return true;
  return typeof user.validSince==="string"&&/^\d+$/.test(user.validSince)
    &&Number.isSafeInteger(Number(user.validSince))&&Number(user.validSince)<=claims.auth_time;
}
