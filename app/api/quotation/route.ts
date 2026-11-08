import {businessDate,calendarDate} from '@/lib/project-dates';
import {NextRequest} from 'next/server';
import {z} from 'zod';
import {database,json,boundedBody,permitSubmission} from '@/lib/operations';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin.'},403);
 try{
 const x=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().trim().min(2).max(100),agree:z.literal(true)}).parse(await boundedBody(req));
 if(!await permitSubmission(req))return json({error:'Too many attempts. Please try again later.'},429);
 const db=database(),now=new Date().toISOString(),stamp=crypto.randomUUID();
 const results=await db.batch([
 db.prepare("INSERT INTO request_activity (id,request_id,actor,summary,created_at) SELECT ?,q.request_id,?,?,? FROM request_quotes q JOIN consultation_requests r ON r.id=q.request_id WHERE q.token=? AND q.accepted_at IS NULL AND q.valid_until>=? AND q.id=(SELECT MAX(id) FROM request_quotes WHERE request_id=q.request_id) AND r.status='Quoted'").bind(stamp,'Customer: '+x.name,'Accepted quotation',now,x.token,businessDate()),
 db.prepare('UPDATE request_quotes SET accepted_at=?,accepted_by=? WHERE token=? AND EXISTS(SELECT 1 FROM request_activity WHERE id=?)').bind(now,x.name,x.token,stamp),
 db.prepare("UPDATE consultation_requests SET status='Approved',revision=revision+1 WHERE id=(SELECT request_id FROM request_quotes WHERE token=?) AND EXISTS(SELECT 1 FROM request_activity WHERE id=?)").bind(x.token,stamp)
 ]);
 if(!results[0].meta.changes)return json({error:'This quote is already accepted, expired, withdrawn, or replaced. Contact RAMSON Glass for the current quotation.'},409);
 return json({ok:true});
 }catch{return json({error:'Check your name and confirm that you agree to the quotation.'},400)}
}
