// The first successful snapshot is a baseline, never an announcement.
export function unseenOrderIds(previous:ReadonlySet<string>|null,ids:readonly string[]){
 return previous ? ids.filter(id=>!previous.has(id)) : [];
}
