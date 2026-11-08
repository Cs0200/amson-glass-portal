import { NextRequest,NextResponse } from 'next/server';
import {db,configured,identity} from '@/lib/supabase';
import {z} from 'zod';
import {getDb} from '@/db';
import {consultationRequests} from '@/db/schema';
import {services} from '@/lib/catalog';
const contact=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(200),phone:z.string().regex(/^[+\d ()-]{8,20}$/),message:z.string().max(3000).default(''),city:z.string().trim().min(2).max(100),address:z.string().trim().max(500).default(''),postal_code:z.string().trim().max(12).default(''),customer_type:z.enum(['Residential','Commercial'])});
const estimate=z.object({service_id:z.string().min(1),width:z.number().positive().max(100),height:z.number().positive().max(100),quantity:z.number().int().min(1).max(100),material:z.enum(['Clear','Frosted','Tinted']),finish:z.enum(['Chrome','Matte black','Brushed steel'])});
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{const {action}=await params;const user=await identity();if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});const s=await db();
 const page=(key='page')=>Math.max(0,Math.min(100000,Math.floor(Number(req.nextUrl.searchParams.get(key))||0)));
 if(action[0]==='profile'){const {data,error}=await s.from('profiles').select('id,name,email,phone,address,city,postal_code,customer_type').eq('id',user.id).single();if(error)throw error;return NextResponse.json({data});}
 if(action[0]==='customers'){
 if(!user.is_admin)return NextResponse.json({error:'Admin access required.'},{status:403});
 let q=s.from('profiles').select('id,name,email,phone,city,address,postal_code,customer_type,created_at',{count:'exact'}).eq('is_admin',false).order('created_at',{ascending:false}).order('id');
 const term=(req.nextUrl.searchParams.get('search')||'').replace(/[^a-zA-Z0-9 @.+-]/g,'').slice(0,100);if(term)q=q.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`);
 const {data,count,error}=await q.range(page()*25,page()*25+24);if(error)throw error;return NextResponse.json({data,count});}
 if(action[0]==='customer'){
 if(!user.is_admin)return NextResponse.json({error:'Admin access required.'},{status:403});const id=z.string().uuid().parse(action[1]);
 const {data:profile,error}=await s.from('profiles').select('id,name,email,phone,address,city,postal_code,customer_type,created_at').eq('id',id).eq('is_admin',false).single();if(error)return NextResponse.json({error:'Customer not found.'},{status:404});
 const results=await Promise.all([
 s.from('projects').select('*,services(name)',{count:'exact'}).eq('owner_id',id).order('created_at',{ascending:false}).order('id').range(page('projects_page')*20,page('projects_page')*20+19),
 s.from('purchases').select('*,purchase_events(*)',{count:'exact'}).eq('customer_id',id).order('purchased_on',{ascending:false}).order('id').range(page('purchases_page')*20,page('purchases_page')*20+19),
 s.from('leads').select('*',{count:'exact'}).eq('email',profile.email).order('created_at',{ascending:false}).order('id').range(page('leads_page')*20,page('leads_page')*20+19),
 s.from('customer_events').select('*',{count:'exact'}).eq('customer_id',id).order('created_at',{ascending:false}).order('id').range(page('history_page')*20,page('history_page')*20+19)]);
 for(const r of results)if(r.error)throw r.error;
 return NextResponse.json({data:profile,projects:results[0].data,projectCount:results[0].count,purchases:results[1].data,purchaseCount:results[1].count,leads:results[2].data,leadCount:results[2].count,history:results[3].data,historyCount:results[3].count});}
 if(action[0]==='purchases'){
 const {data,count,error}=await s.from('purchases').select('*',{count:'exact'}).eq('customer_id',user.id).order('purchased_on',{ascending:false}).order('id').range(page()*20,page()*20+19);if(error)throw error;return NextResponse.json({data,count});}
 if(action[0]==='projects'){const {data,error}=await s.from('projects').select('*,services(name)').order('created_at',{ascending:false});if(error)throw error;return NextResponse.json({data});}
 if(action[0]==='project'){const {data,error}=await s.from('projects').select('*,services(name),messages(*),project_files(*),project_events(*),purchases(*)').eq('id',action[1]).single();if(error)return NextResponse.json({error:'Project not found or access denied.'},{status:404});return NextResponse.json({data});}
 if(action[0]==='leads'&&user.is_admin){const {data,error}=await s.from('leads').select('*').order('created_at',{ascending:false});if(error)throw error;return NextResponse.json({data});}
 if(action[0]==='file'){const {data:f}=await s.from('project_files').select('*').eq('id',action[1]).single();if(!f)return NextResponse.json({error:'File not found.'},{status:404});const {data,error}=await s.storage.from('project-files').createSignedUrl(f.path,60);if(error)throw error;return NextResponse.json({url:data.signedUrl});}
 return NextResponse.json({error:'Not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Request failed.'},{status:400});}}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{
 const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)return NextResponse.json({error:'Invalid request origin'},{status:403});
 const {action}=await params;
 if(!configured()&&['contact','estimate'].includes(action[0])){
 const body=await req.json();const c=contact.parse(body);const details=action[0]==='estimate'?estimate.parse(body):null;
 const service=details?services.find(s=>s.id===details.service_id):null;
 if(details&&!service)throw new Error('Choose an available solution.');
 const total=details&&service?Math.round(details.width*details.height*details.quantity*service.rate*(details.material==='Frosted'?1.15:details.material==='Tinted'?1.2:1)+1500*details.quantity):null;
 const id=crypto.randomUUID();
 await getDb().insert(consultationRequests).values({id,kind:action[0],name:c.name,email:c.email.toLowerCase(),phone:c.phone,city:c.city,address:c.address,postalCode:c.postal_code,customerType:c.customer_type,message:c.message,estimate:details?JSON.stringify(details):null,estimatedTotal:total,createdAt:new Date().toISOString()});
 return NextResponse.json({ok:true,id,reference:id,guest:true,estimated_total:total});
 }
 if(!configured())return NextResponse.json({error:'Account services are being configured. Please call +91 98764 50935.'},{status:503});
const s=await db();const user=await identity();
 if(action[0]==='upload'){
 if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});const form=await req.formData();const project=String(form.get('project_id'));const file=form.get('file') as File;
 if(!file||file.size>10*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Choose a JPG, PNG, WebP or PDF under 10 MB.');
 const {data:record}=await s.from('projects').select('id').eq('id',project).single();if(!record)throw new Error('Project access denied.');
 const path=`${project}/${crypto.randomUUID()}.${file.type==='application/pdf'?'pdf':file.type.split('/')[1]}`;const {error}=await s.storage.from('project-files').upload(path,file,{contentType:file.type});if(error)throw error;
 const {error:insertError}=await s.from('project_files').insert({project_id:project,path,name:file.name.slice(0,200),owner_id:user.id});if(insertError){await s.storage.from('project-files').remove([path]);throw insertError;}return NextResponse.json({ok:true});}
 const b=z.record(z.unknown()).parse(await req.json());
 if(action[0]==='auth'){
 const email=z.string().trim().email().parse(b.email).toLowerCase();let result;
 if(action[1]==='reset'){result=await s.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=/reset-password',req.url).href});}
 else {const password=z.string().min(10).max(128).parse(b.password);result=action[1]==='signup'?await s.auth.signUp({email,password,options:{emailRedirectTo:new URL('/auth/callback',req.url).href,data:{name:String(b.name||'Customer').slice(0,100)}}}):await s.auth.signInWithPassword({email,password});}
 if(result.error)throw result.error;
 if(action[1]==='login'){const signedIn=await identity();if(b.portal==='admin'&&!signedIn?.is_admin){await s.auth.signOut();return NextResponse.json({error:'This account does not have admin access. Please use the customer portal.'},{status:403});}return NextResponse.json({ok:true,redirect:signedIn?.is_admin?'/admin':'/customer'});}
 return NextResponse.json({ok:true});}
 if(action[0]==='contact'){const input=contact.parse(b);input.email=input.email.toLowerCase();const {error}=await s.from('leads').insert(input);if(error)throw error;return NextResponse.json({ok:true});}
 if(!user)return NextResponse.json({error:'Please sign in to save your project.'},{status:401});
 if(action[0]==='profile'){const input=contact.omit({email:true,message:true}).parse(b);const {error}=await s.rpc('update_customer_profile',{input});if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='logout'){await s.auth.signOut();return NextResponse.json({ok:true});}
 if(action[0]==='password'){const {error}=await s.auth.updateUser({password:z.string().min(10).max(128).parse(b.password)});if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='estimate'){const input=estimate.parse(b);const c=contact.parse(b);const {data,error}=await s.rpc('create_estimate',{input:{...input,...c}});if(error)throw error;return NextResponse.json({id:data});}
 if(action[0]==='message'){const text=z.string().trim().min(1).max(3000).parse(b.body);const {error}=await s.from('messages').insert({project_id:b.project_id,author_id:user.id,body:text,kind:['revision','service'].includes(String(b.kind))?String(b.kind):'message'});if(error)throw error;return NextResponse.json({ok:true});}
 if(!user.is_admin)return NextResponse.json({error:'Admin access required.'},{status:403});
 if(action[0]==='customer-update'){const input=contact.omit({email:true,message:true}).extend({id:z.string().uuid()}).parse(b);const {id,...fields}=input;const {data,error}=await s.from('profiles').update({...fields,updated_at:new Date().toISOString()}).eq('id',id).eq('is_admin',false).select('id').single();if(error||!data)throw error||new Error('Customer not found.');return NextResponse.json({ok:true});}
 if(action[0]==='purchase'){
 const input=z.object({customer_id:z.string().uuid(),project_id:z.string().uuid().nullable(),description:z.string().trim().min(2).max(500),reference:z.string().trim().min(2).max(100),purchased_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),amount:z.number().positive().max(100000000),paid_amount:z.number().nonnegative().max(100000000)}).refine(v=>v.paid_amount<=v.amount,'Recorded payment cannot exceed the order total.').parse(b);
 const {error}=await s.from('purchases').insert({...input,recorded_by:user.id});if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='purchase-update'){
 const input=z.object({id:z.string().uuid(),paid_amount:z.number().nonnegative().max(100000000)}).parse(b);const {data,error}=await s.from('purchases').update({paid_amount:input.paid_amount}).eq('id',input.id).eq('status','Recorded').select('id').single();if(error||!data)throw error||new Error('Purchase not found or already voided.');return NextResponse.json({ok:true});}
 if(action[0]==='purchase-void'){
 const input=z.object({id:z.string().uuid(),reason:z.string().trim().min(3).max(500)}).parse(b);const {data,error}=await s.from('purchases').update({status:'Voided',void_reason:input.reason}).eq('id',input.id).eq('status','Recorded').select('id').single();if(error||!data)throw error||new Error('Purchase not found or already voided.');return NextResponse.json({ok:true});}
 if(action[0]==='update-project'){const input=z.object({id:z.string().uuid(),status:z.enum(['New','Contacted','Quoted','Approved','Installed','Completed']),approved_total:z.number().nonnegative().max(100000000).nullable(),payment_url:z.union([z.literal(''),z.string().url().refine(v=>/^https:\/\/(rzp.io|razorpay.com|buy.stripe.com)\//.test(v),'Use a Razorpay or Stripe payment link.')])}).parse(b);const {id,...changes}=input;const {error}=await s.from('projects').update(changes).eq('id',id);if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='pricing'){const input=z.object({id:z.string(),rate:z.number().positive().max(100000),description:z.string().min(10).max(2000)}).parse(b);const {id,...changes}=input;const {error}=await s.from('services').update(changes).eq('id',id);if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='lead'){const {error}=await s.from('leads').update({status:z.enum(['New','Contacted','Quoted','Approved','Installed','Completed']).parse(b.status)}).eq('id',z.string().uuid().parse(b.id));if(error)throw error;return NextResponse.json({ok:true});}
 return NextResponse.json({error:'Not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to complete request.'},{status:400});}}
