export function businessDate(value=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 const get=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function calendarDate(value:string){const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
