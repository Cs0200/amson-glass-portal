import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(p+'/'+f.name):f.name.endsWith('.js')?[{type:'ESModule',path:p+'/'+f.name}]:[])}
import assert from 'node:assert/strict';
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...files('dist/server').filter(f=>f.path!=='dist/server/index.js')],modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
try {
const db=await mf.getD1Database('DB');await db.exec(readFileSync('drizzle/0000_harsh_brother_voodoo.sql','utf8').replaceAll('\n',' '));
const base={name:'Test Customer',email:'TEST@example.com',phone:'+919999999999',city:'Ludhiana',customer_type:'Residential',message:'Test request'};
async function post(action,body,origin='https://example.com'){return mf.dispatchFetch('https://example.com/api/'+action,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})}
let r=await post('contact',base);assert.equal(r.status,200);assert.ok((await r.json()).reference);
r=await post('estimate',{...base,service_id:'partitions',width:8,height:7,quantity:1,material:'Clear',finish:'Chrome'});assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.estimated_total,37900);
assert.equal((await db.prepare('select count(*) as n from consultation_requests').first()).n,2);
assert.equal((await db.prepare('select email from consultation_requests where id=?').bind(saved.id).first()).email,'test@example.com');
assert.equal((await post('contact',{...base,city:''})).status,400);
assert.equal((await post('estimate',{...base,service_id:'unknown',width:8,height:7,quantity:1,material:'Clear',finish:'Chrome'})).status,400);
assert.equal((await post('contact',base,'https://other.example')).status,403);
assert.equal((await db.prepare('select count(*) as n from consultation_requests').first()).n,2);
console.log('PASS: contact and estimate persisted; total and normalized email correct; invalid input and foreign origin rejected.');
}finally{await mf.dispose()}
