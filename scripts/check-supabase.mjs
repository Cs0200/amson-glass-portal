const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
if(!url||!key){console.error('Backend is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in secure environment settings.');process.exit(1);}
let origin;try{origin=new URL(url);if(origin.protocol!=='https:')throw new Error();}catch{console.error('SUPABASE_URL must be a valid HTTPS project URL.');process.exit(1);}
const headers={apikey:key,Authorization:`Bearer ${key}`};
async function check(path){const r=await fetch(new URL(path,origin),{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Backend check failed for ${path.split('?')[0]} (HTTP ${r.status}).`);return r.json();}
try{
 await check('/auth/v1/settings');
 const services=await check('/rest/v1/services?select=id,name,rate&limit=10');
 if(!services.length)throw new Error('The service catalogue is empty. Apply the initial schema and seed before deployment.');
 // Zero-row reads validate required columns without downloading customer records.
 for(const table of ['profiles?select=id,is_admin,city&limit=0','projects?select=id,owner_id,city,pricing_snapshot&limit=0','purchases?select=id,customer_id,paid_amount&limit=0']){
 const r=await fetch(new URL('/rest/v1/'+table,origin),{headers,signal:AbortSignal.timeout(20000)});
 if(!r.ok&&![401,403].includes(r.status))throw new Error(`Required table check failed: ${table.split('?')[0]} (HTTP ${r.status}).`);
 }
 console.log('PASS: Supabase Auth responds, the public catalogue is seeded, and protected table checks do not report missing schema.');
 console.log('Still required: verified admin account, Auth redirect allowlist, and two-customer RLS/upload acceptance checks.');
}catch(e){console.error(e.message);process.exit(1);}
