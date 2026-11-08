import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {NextResponse} from 'next/server';
export const requestStages=['New','Contacted','Site visit','Quoted','Approved','Installed','Completed','Closed'] as const;
export function database(){if(!env.DB)throw new Error('Request storage is temporarily unavailable. Please call RAMSON Glass.');return env.DB;}
export async function operator(){const u=await getChatGPTUser();const owner=process.env.RAMSON_OWNER_EMAIL?.trim().toLowerCase();return u&&owner&&u.email.toLowerCase()===owner?u:null;}
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function boundedBody(req:Request){
 if(Number(req.headers.get('content-length')||0)>20000)throw new Error('Request is too large.');
 const reader=req.body?.getReader();if(!reader)throw new Error('Request body is required.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000){await reader.cancel();throw new Error('Request is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function permitSubmission(req:Request){
 const ip=req.headers.get('cf-connecting-ip');if(!ip)return true;
 const now=Date.now(),window=Math.floor(now/600000),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${ip}:${window}`));
 const key=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
 const db=database();const row=await db.prepare('INSERT INTO submission_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+1200000).first<{count:number}>();
 await db.prepare('DELETE FROM submission_limits WHERE expires_at < ?').bind(now).run();
 return !!row&&row.count<=10;
}
export const safeCsv=(value:unknown)=>{let s=String(value??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
