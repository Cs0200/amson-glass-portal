// Integration tests against the production Worker and an isolated D1 database.
// Identity headers here simulate those set by Sites dispatch after sign-in.
import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(p+'/'+f.name):f.name.endsWith('.js')?[{type:'ESModule',path:p+'/'+f.name}]:[])}
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...files('dist/server').filter(f=>f.path!=='dist/server/index.js')],modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{RAMSON_OWNER_EMAIL:'owner@example.com'}});
try {
const db=await mf.getD1Database('DB');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.exec(sql.replaceAll('\n',' '));
const base={name:'Test Customer',email:'TEST@example.com',phone:'+919999999999',city:'Ludhiana',customer_type:'Residential',message:'Test request',consent:true};
const owner={'oai-authenticated-user-id':'site-owner','oai-authenticated-user-email':'owner@example.com'};
const customer={'oai-authenticated-user-id':'site-customer','oai-authenticated-user-email':'test@example.com'};
async function post(action,body,headers={},origin='https://example.com'){return mf.dispatchFetch('https://example.com/api/'+action,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
const get=(path,headers={})=>mf.dispatchFetch('https://example.com'+path,{headers,redirect:'manual'});
let r=await post('contact',{...base,request_key:randomUUID()});assert.equal(r.status,200);assert.ok((await r.json()).reference);
const key=randomUUID(),estimate={...base,request_key:key,service_id:'partitions',width:8,height:7,quantity:1,material:'Clear',finish:'Chrome'};
r=await post('estimate',estimate);assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.estimated_total,37900);
r=await post('estimate',estimate);assert.equal((await r.json()).id,saved.id,'retry reuses saved record');
assert.equal((await db.prepare('SELECT COUNT(*) n FROM consultation_requests').first()).n,2);
assert.equal((await db.prepare('SELECT email FROM consultation_requests WHERE id=?').bind(saved.id).first()).email,'test@example.com');
assert.equal((await post('contact',{...base,request_key:randomUUID(),city:''})).status,400);
assert.equal((await post('contact',{...base,request_key:randomUUID(),consent:false})).status,400);
assert.equal((await post('contact',{...base,request_key:randomUUID(),website:'spam'})).status,400);
assert.equal((await post('estimate',{...estimate,request_key:randomUUID(),service_id:'unknown'})).status,400);
assert.equal((await post('contact',base,{},'https://other.example')).status,403);
assert.equal((await get('/api/operations')).status,403);
assert.equal((await get('/api/operations',customer)).status,403);
assert.equal((await post('operations',{id:saved.id,status:'Contacted',notes:'',followUp:'',revision:0},customer)).status,403);
r=await get('/api/operations',owner);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).count,2);
r=await get('/api/operations?id='+saved.id,owner);assert.equal((await r.json()).data.revision,0);
r=await post('operations',{id:saved.id,status:'Site visit',notes:'Confirm measurements on site.',followUp:'2099-01-01',revision:0},owner);assert.equal(r.status,200);
assert.equal((await post('operations',{id:saved.id,status:'Closed',notes:'stale edit',followUp:'',revision:0},owner)).status,409,'stale edits rejected');
const quote={action:'quote',id:saved.id,scope:'Glass partition: verified dimensions and agreed hardware, including installation.',subtotal:10000.29,tax:1800.05,deposit:3000.25,validUntil:'2099-01-01',terms:'Deposit is due after approval. Installation timing must be agreed with RAMSON Glass. No custom fabrication until confirmation.'};
r=await post('operations',quote,owner);assert.equal(r.status,200,await r.clone().text());const first=(await r.json()).url;
r=await post('operations',{...quote,scope:'Revised glass partition: verified dimensions, safety glass and agreed hardware.'},owner);assert.equal(r.status,200);const latest=(await r.json()).url;
assert.equal((await post('quotation',{token:first.split('/').pop(),name:'Test Customer',agree:true})).status,409,'superseded quote cannot be approved');
r=await get(latest);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');const html=await r.text();assert.ok(html.includes('Revised glass partition'));
assert.equal((await post('quotation',{token:latest.split('/').pop(),name:'Test Customer',agree:false})).status,400);
r=await post('quotation',{token:latest.split('/').pop(),name:'Test Customer',agree:true});assert.equal(r.status,200);
assert.equal((await post('quotation',{token:latest.split('/').pop(),name:'Test Customer',agree:true})).status,409,'duplicate acceptance rejected');
assert.equal((await db.prepare('SELECT status FROM consultation_requests WHERE id=?').bind(saved.id).first()).status,'Approved');
assert.equal((await post('operations',quote,owner)).status,409,'approved scope cannot be silently revised');
let pay={action:'payment',id:saved.id,amount:3000.25,reference:'UPI-TEST-001',paidOn:'2026-01-01'};
r=await post('operations',pay,owner);assert.equal(r.status,200,await r.clone().text());
assert.equal((await post('operations',pay,owner)).status,409,'transaction references are unique');
assert.equal((await post('operations',{...pay,reference:'UPI-TOO-MUCH',amount:999999},owner)).status,409,'cannot record more than remaining balance');
r=await get('/api/operations?id='+saved.id,owner);let detail=await r.json();assert.equal(detail.payments[0].amount,300025);
r=await post('operations',{action:'void-payment',paymentId:detail.payments[0].id,reason:'Incorrect manual reference entry'},owner);assert.equal(r.status,200);
assert.ok((await db.prepare('SELECT voided_at FROM request_payments WHERE id=?').bind(detail.payments[0].id).first()).voided_at);
r=await get('/api/operations?export=csv',owner);assert.equal(r.status,200);assert.ok((await r.text()).includes("'+919999999999"),'CSV protects against formula interpretation');
r=await get('/my-requests',customer);const mine=await r.text();assert.ok(mine.includes('Test Customer'));assert.ok(mine.includes(latest));
r=await get('/my-requests',{'oai-authenticated-user-id':'stranger','oai-authenticated-user-email':'stranger@example.com'});assert.ok(!(await r.text()).includes('Test Customer'),'other customers cannot see enquiry records');
assert.equal((await get('/operations',customer)).status,200); // Access-denied page, no records.
assert.ok(!(await (await get('/operations',customer)).text()).includes('Test Customer'));
for(let i=0;i<10;i++){r=await post('contact',{...base,request_key:randomUUID()},{'cf-connecting-ip':'192.0.2.123'});assert.equal(r.status,200)}
assert.equal((await post('contact',{...base,request_key:randomUUID()},{'cf-connecting-ip':'192.0.2.123'})).status,429,'public submission limit enforced');
// Expired links, invalid calendar dates, anonymous redirects and injected values stay protected.
r=await post('contact',{...base,request_key:randomUUID(),name:'=HYPERLINK(1)' });const extra=await r.json();
assert.equal((await post('operations',{...quote,id:extra.id,validUntil:'2099-02-31'},owner)).status,400);
r=await post('operations',{...quote,id:extra.id},owner);const expiring=(await r.json()).url;
await db.prepare('UPDATE request_quotes SET valid_until=? WHERE token=?').bind('2000-01-01',expiring.split('/').pop()).run();
assert.equal((await post('quotation',{token:expiring.split('/').pop(),name:'Test Customer',agree:true})).status,409);
assert.equal((await get('/my-requests')).status,307);assert.equal((await get('/operations')).status,307);
r=await get('/api/operations?export=csv',owner);assert.ok((await r.text()).includes("'=HYPERLINK(1)"));
for(const path of ['/privacy','/terms']){r=await get(path);assert.equal(r.status,200)}
console.log('PASS: durable requests, retry idempotency, consent, spam controls, owner access, customer isolation, revision conflicts, quote supersession, approval, manual payments, void audit, CSV safety, and private cache headers.');
}finally{await mf.dispose()}
