import {NextRequest,NextResponse} from 'next/server';
import {db,identity} from '@/lib/supabase';
import {deliver,messagingConfig} from '@/lib/messaging';
import {z} from 'zod';
export const dynamic='force-dynamic';
const prefs='id,email_marketing_opt_in,whatsapp_marketing_opt_in,email_updates_opt_in,whatsapp_updates_opt_in';
function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})}
function check(result:any){if(result.error)throw new Error(result.error.message);return result.data;}
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{
 const u=await identity();if(!u)return json({error:'Please sign in.'},401);const s=await db();const [action,id]=(await params).action;
 if(action==='preferences'){if(id&&id!==u.id&&!u.is_admin)return json({error:'Access denied'},403);return json({data:check(await s.from('profiles').select(prefs).eq('id',id||u.id).single())});}
 if(!u.is_admin)return json({error:'Admin access required.'},403);
 if(action==='overview'){const page=Math.max(0,Math.floor(Number(req.nextUrl.searchParams.get('page'))||0));const [c,m,total]=await Promise.all([s.from('campaigns').select('*').order('created_at',{ascending:false}).limit(50),s.from('message_outbox').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(page*25,page*25+24),s.from('profiles').select('id',{count:'exact',head:true}).eq('is_admin',false)]);check(total);return json({campaigns:check(c),messages:check(m),messageCount:m.count,customerCount:total.count,configuration:messagingConfig()});}
 if(action==='review'&&id){const campaign=check(await s.from('campaigns').select('*').eq('id',id).single());const rows:any[]=[];for(let from=0;;from+=500){const chunk=check(await s.rpc('campaign_recipients',{campaign:id}).range(from,from+499));rows.push(...chunk);if(chunk.length<500)break;if(rows.length>=10000)throw new Error('Narrow this campaign by city or customer type; maximum 10,000 recipients.');}return json({campaign,recipients:rows});}
 return json({error:'Not found'},404);
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to load communications'},400)}}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin'},403);
 const u=await identity();if(!u)return json({error:'Please sign in'},401);const s=await db();const [action]=(await params).action;const input=await req.json();
 if(action==='preferences'){const p=z.object({customer:z.string().uuid(),preferences:z.object({email_marketing_opt_in:z.boolean(),whatsapp_marketing_opt_in:z.boolean(),email_updates_opt_in:z.boolean(),whatsapp_updates_opt_in:z.boolean()}),evidence:z.string().max(1000).default('')}).parse(input);check(await s.rpc('set_message_preferences',p));return json({ok:true});}
 if(!u.is_admin)return json({error:'Admin access required'},403);
 if(action==='draft'){const p=z.object({name:z.string().min(2).max(100),channel:z.enum(['email','whatsapp']),subject:z.string().max(200).default(''),body:z.string().min(1).max(3000),template_name:z.string().max(100),language:z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/),parameters:z.array(z.string().min(1).max(500)).max(10),audience:z.enum(['All','Residential','Commercial']),city:z.string().max(100)}).parse(input);if(p.channel==='whatsapp'&&!/^[a-z0-9_]+$/.test(p.template_name))throw new Error('Enter an approved WhatsApp template name.');if(p.channel==='whatsapp'){const vars=[...p.body.matchAll(/\{\{(\d+)\}\}/g)].map(v=>Number(v[1]));if(vars.some(n=>n<1||n>p.parameters.length)||p.parameters.some((_,i)=>!vars.includes(i+1)))throw new Error('Template placeholders and parameters must match.');}return json({id:check(await s.rpc('create_campaign',{input:p}))});}
 if(action==='queue'){const p=z.object({campaign:z.string().uuid(),expected_count:z.number().int().min(1).max(10000)}).parse(input);return json({count:check(await s.rpc('queue_campaign',p))});}
 if(action==='cancel'){const p=z.object({campaign:z.string().uuid()}).parse(input);return json({count:check(await s.rpc('cancel_campaign',p))});}
 if(action==='send'){const c=messagingConfig();if(!c.enabled||!c.email||!c.whatsapp||!c.callbacks)return json({error:'Connect both providers, Supabase, and public callbacks before sending.'},503);const batch=check(await s.rpc('claim_messages'));for(const m of batch){if(!check(await s.rpc('authorize_message',{message:m.id})))continue;let result;try{let url='';if(m.purpose==='marketing'&&m.channel==='email'){const token=check(await s.rpc('get_unsubscribe_token',{customer:m.customer_id}));url=process.env.PUBLIC_APP_URL+'/api/unsubscribe?token='+token;}result=await deliver(m,url);}catch{result={status:'failed',detail:'Setup error before sending.'};}check(await s.rpc('finish_message',{message:m.id,result:result.status,provider:result.provider||null,detail:result.detail||null}));}return json({attempted:batch.length});}
 return json({error:'Not found'},404);
 }catch(e){return json({error:e instanceof Error?e.message:'Communication request failed'},400)}}
