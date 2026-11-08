import {businessDate,calendarDate} from '@/lib/project-dates';
import {NextRequest} from 'next/server';
import {z} from 'zod';
import {database,operator,json,boundedBody,requestStages,safeCsv} from '@/lib/operations';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!await operator())return json({error:'Owner access required.'},403);
 try {
 const db=database(),q=req.nextUrl.searchParams;
 if(q.get('id')){
 const id=z.string().uuid().parse(q.get('id'));const data=await db.prepare('SELECT * FROM consultation_requests WHERE id=?').bind(id).first();if(!data)return json({error:'Enquiry not found.'},404);
 const activity=await db.prepare('SELECT * FROM request_activity WHERE request_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();
 const quotes=await db.prepare('SELECT * FROM request_quotes WHERE request_id=? ORDER BY id DESC LIMIT 20').bind(id).all();
 const payments=await db.prepare('SELECT * FROM request_payments WHERE request_id=? ORDER BY created_at DESC').bind(id).all();
 return json({data,activity:activity.results,quotes:quotes.results,payments:payments.results});
 }
 const page=Math.max(0,Math.min(100000,Number(q.get('page'))||0)),search=(q.get('search')||'').slice(0,100),status=q.get('status')||'All';
 const where="WHERE (?='All' OR status=?) AND (?='' OR instr(lower(name||' '||email||' '||phone||' '||city||' '||id),lower(?))>0)";
 const args=[status,status,search,search];
 const count=await db.prepare('SELECT COUNT(*) count FROM consultation_requests '+where).bind(...args).first();
 if(q.get('export')==='csv'){
 const rows=await db.prepare('SELECT id,created_at,name,email,phone,city,customer_type,kind,status,estimated_total,follow_up,notes FROM consultation_requests '+where+' ORDER BY created_at DESC LIMIT 5000').bind(...args).all();
 const keys=['id','created_at','name','email','phone','city','customer_type','kind','status','estimated_total','follow_up','notes'];
 const csv=[keys.map(safeCsv).join(','),...rows.results.map(r=>keys.map(k=>safeCsv(r[k])).join(','))].join('\r\n');
 return new Response('\uFEFF'+csv,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="RAMSON-enquiries.csv"','Cache-Control':'private, no-store'}});
 }
 const data=await db.prepare('SELECT * FROM consultation_requests '+where+' ORDER BY created_at DESC LIMIT 25 OFFSET ?').bind(...args,Math.floor(page)*25).all();
 const totals=await db.prepare('SELECT status,COUNT(*) count FROM consultation_requests GROUP BY status').all();
 const due=await db.prepare("SELECT COUNT(*) count FROM consultation_requests WHERE follow_up<>'' AND follow_up<=? AND status NOT IN ('Closed','Completed')").bind(businessDate()).first();
 return json({data:data.results,count:count?.count||0,totals:totals.results,due:due?.count||0});
 }catch{return json({error:'Unable to load enquiries. Please retry.'},500)}
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin.'},403);
 const user=await operator();if(!user)return json({error:'Owner access required.'},403);
 try{
 const b=await boundedBody(req),db=database(),now=new Date().toISOString();
 if(b.action==='payment'){
 const x=z.object({id:z.string().uuid(),amount:z.number().positive().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001),reference:z.string().trim().min(3).max(100),paidOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(calendarDate)}).parse(b);
 if(x.paidOn>businessDate())return json({error:'The payment date cannot be in the future.'},400);
 const amount=Math.round(x.amount*100),id=crypto.randomUUID();
 const results=await db.batch([
 db.prepare('INSERT OR IGNORE INTO request_payments (id,request_id,quote_id,amount,reference,paid_on,recorded_by,created_at) SELECT ?,q.request_id,q.id,?,?,?,?,? FROM request_quotes q WHERE q.request_id=? AND q.accepted_at IS NOT NULL AND q.id=(SELECT MAX(id) FROM request_quotes WHERE request_id=q.request_id) AND q.subtotal+q.tax-COALESCE((SELECT SUM(amount) FROM request_payments WHERE request_id=q.request_id AND voided_at IS NULL),0)>=?').bind(id,amount,x.reference,x.paidOn,user.email,now,x.id,amount),
 db.prepare('INSERT INTO request_activity (id,request_id,actor,summary,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM request_payments WHERE id=?)').bind(crypto.randomUUID(),x.id,user.email,'Manually recorded payment of INR '+x.amount.toFixed(2)+'; reference '+x.reference,now,id)
 ]);
 if(!results[0].meta.changes)return json({error:'Approve the current quotation first, check the outstanding balance, and use a unique payment reference.'},409);
 return json({ok:true});
 }
 if(b.action==='void-payment'){
 const x=z.object({paymentId:z.string().uuid(),reason:z.string().trim().min(5).max(500)}).parse(b),eventId=crypto.randomUUID();
 const results=await db.batch([
 db.prepare('INSERT INTO request_activity (id,request_id,actor,summary,created_at) SELECT ?,request_id,?,?,? FROM request_payments WHERE id=? AND voided_at IS NULL').bind(eventId,user.email,'Voided a manually recorded payment: '+x.reason,now,x.paymentId),
 db.prepare('UPDATE request_payments SET voided_at=?,void_reason=? WHERE id=? AND voided_at IS NULL').bind(now,x.reason,x.paymentId)
 ]);
 if(!results[1].meta.changes)return json({error:'Payment not found or already voided.'},409);
 return json({ok:true});
 }
 if(b.action==='quote'){
 const x=z.object({id:z.string().uuid(),scope:z.string().trim().min(20).max(5000),subtotal:z.number().positive().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001),tax:z.number().nonnegative().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001),deposit:z.number().nonnegative().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001),validUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(calendarDate),terms:z.string().trim().min(20).max(3000)}).parse(b);
 if(x.deposit>x.subtotal+x.tax||x.validUntil<businessDate())return json({error:'Check the deposit and quote validity date.'},400);
 const row=await db.prepare('SELECT status FROM consultation_requests WHERE id=?').bind(x.id).first<{status:string}>();if(!row)return json({error:'Enquiry not found.'},404);
 const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
 // The INSERT condition is rechecked inside the atomic batch, including concurrent approvals.
 const result=await db.batch([
 db.prepare("INSERT INTO request_quotes (request_id,token,scope,subtotal,tax,deposit,valid_until,terms,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM consultation_requests WHERE id=? AND status NOT IN ('Approved','Installed','Completed','Closed'))").bind(x.id,token,x.scope,Math.round(x.subtotal*100),Math.round(x.tax*100),Math.round(x.deposit*100),x.validUntil,x.terms,now,x.id),
 db.prepare("UPDATE consultation_requests SET status='Quoted',revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM request_quotes WHERE token=?)").bind(x.id,token),
 db.prepare("INSERT INTO request_activity (id,request_id,actor,summary,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM request_quotes WHERE token=?)").bind(crypto.randomUUID(),x.id,user.email,'Issued a quotation for INR '+(x.subtotal+x.tax).toFixed(2),now,token)
 ]);
 if(!result[0].meta.changes)return json({error:'This enquiry is already approved or closed. Reopen it before issuing a revised quote.'},409);
 return json({ok:true,url:'/quotation/'+token});
 }
 const x=z.object({id:z.string().uuid(),status:z.enum(requestStages),notes:z.string().max(5000),followUp:z.union([z.literal(''),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(calendarDate)]),revision:z.number().int().nonnegative()}).parse(b);
 const eventId=crypto.randomUUID();
 const results=await db.batch([
 db.prepare('INSERT INTO request_activity (id,request_id,actor,summary,created_at) SELECT ?,id,?,?,? FROM consultation_requests WHERE id=? AND revision=?').bind(eventId,user.email,'Stage: '+x.status+'; follow-up: '+(x.followUp||'none')+'; notes updated',now,x.id,x.revision),
 db.prepare('UPDATE consultation_requests SET status=?,notes=?,follow_up=?,revision=revision+1 WHERE id=? AND revision=?').bind(x.status,x.notes,x.followUp,x.id,x.revision)
 ]);
 if(!results[1].meta.changes)return json({error:'This enquiry changed in another window. Refresh before saving.'},409);
 return json({ok:true});
 }catch(e){return json({error:e instanceof z.ZodError?'Check the required fields and amounts.':'Unable to save. Please retry.'},400)}
}
