import { NextRequest,NextResponse } from 'next/server';
import {db,configured,identity} from '@/lib/supabase';
import {z} from 'zod';
const contact=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(200),phone:z.string().regex(/^[+\d ()-]{8,20}$/),message:z.string().max(3000).default('')});
const estimate=z.object({service_id:z.string().min(1),width:z.number().positive().max(100),height:z.number().positive().max(100),quantity:z.number().int().min(1).max(100),material:z.enum(['Clear','Frosted','Tinted']),finish:z.enum(['Chrome','Matte black','Brushed steel'])});
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{const {action}=await params;const user=await identity();if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});const s=await db();
 if(action[0]==='projects'){const {data,error}=await s.from('projects').select('*,services(name)').order('created_at',{ascending:false});if(error)throw error;return NextResponse.json({data});}
 if(action[0]==='project'){const {data,error}=await s.from('projects').select('*,services(name),messages(*),project_files(*)').eq('id',action[1]).single();if(error)return NextResponse.json({error:'Project not found or access denied.'},{status:404});return NextResponse.json({data});}
 if(action[0]==='leads'&&user.is_admin){const {data,error}=await s.from('leads').select('*').order('created_at',{ascending:false});if(error)throw error;return NextResponse.json({data});}
 if(action[0]==='file'){const {data:f}=await s.from('project_files').select('*').eq('id',action[1]).single();if(!f)return NextResponse.json({error:'File not found.'},{status:404});const {data,error}=await s.storage.from('project-files').createSignedUrl(f.path,60);if(error)throw error;return NextResponse.json({url:data.signedUrl});}
 return NextResponse.json({error:'Not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Request failed.'},{status:400});}}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{
 const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)return NextResponse.json({error:'Invalid request origin'},{status:403});
 if(!configured())return NextResponse.json({error:'Online booking is being configured. Please call +91 98764 50935. Nothing has been saved.'},{status:503});
 const {action}=await params;const s=await db();const user=await identity();
 if(action[0]==='upload'){
 if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});const form=await req.formData();const project=String(form.get('project_id'));const file=form.get('file') as File;
 if(!file||file.size>10*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Choose a JPG, PNG, WebP or PDF under 10 MB.');
 const {data:record}=await s.from('projects').select('id').eq('id',project).single();if(!record)throw new Error('Project access denied.');
 const path=`${project}/${crypto.randomUUID()}.${file.type==='application/pdf'?'pdf':file.type.split('/')[1]}`;const {error}=await s.storage.from('project-files').upload(path,file,{contentType:file.type});if(error)throw error;
 const {error:insertError}=await s.from('project_files').insert({project_id:project,path,name:file.name.slice(0,200),owner_id:user.id});if(insertError){await s.storage.from('project-files').remove([path]);throw insertError;}return NextResponse.json({ok:true});}
 const b=z.record(z.unknown()).parse(await req.json());
 if(action[0]==='auth'){
 const email=z.string().email().parse(b.email);let result;
 if(action[1]==='reset'){result=await s.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=/reset-password',req.url).href});}
 else {const password=z.string().min(10).max(128).parse(b.password);result=action[1]==='signup'?await s.auth.signUp({email,password,options:{emailRedirectTo:new URL('/auth/callback',req.url).href,data:{name:String(b.name||'Customer').slice(0,100)}}}):await s.auth.signInWithPassword({email,password});}
 if(result.error)throw result.error;return NextResponse.json({ok:true});}
 if(action[0]==='contact'){const input=contact.parse(b);const {error}=await s.from('leads').insert(input);if(error)throw error;return NextResponse.json({ok:true});}
 if(!user)return NextResponse.json({error:'Please sign in to save your project.'},{status:401});
 if(action[0]==='logout'){await s.auth.signOut();return NextResponse.json({ok:true});}
 if(action[0]==='password'){const {error}=await s.auth.updateUser({password:z.string().min(10).max(128).parse(b.password)});if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='estimate'){const input=estimate.parse(b);const c=contact.parse(b);const {data,error}=await s.rpc('create_estimate',{input:{...input,...c}});if(error)throw error;return NextResponse.json({id:data});}
 if(action[0]==='message'){const text=z.string().trim().min(1).max(3000).parse(b.body);const {error}=await s.from('messages').insert({project_id:b.project_id,author_id:user.id,body:text,kind:['revision','service'].includes(String(b.kind))?String(b.kind):'message'});if(error)throw error;return NextResponse.json({ok:true});}
 if(!user.is_admin)return NextResponse.json({error:'Admin access required.'},{status:403});
 if(action[0]==='update-project'){const input=z.object({id:z.string().uuid(),status:z.enum(['New','Contacted','Quoted','Approved','Installed','Completed']),approved_total:z.number().nonnegative().max(100000000).nullable(),payment_url:z.union([z.literal(''),z.string().url().refine(v=>/^https:\/\/(rzp.io|razorpay.com|buy.stripe.com)\//.test(v),'Use a Razorpay or Stripe payment link.')])}).parse(b);const {id,...changes}=input;const {error}=await s.from('projects').update(changes).eq('id',id);if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='pricing'){const input=z.object({id:z.string(),rate:z.number().positive().max(100000),description:z.string().min(10).max(2000)}).parse(b);const {id,...changes}=input;const {error}=await s.from('services').update(changes).eq('id',id);if(error)throw error;return NextResponse.json({ok:true});}
 if(action[0]==='lead'){const {error}=await s.from('leads').update({status:z.enum(['New','Contacted','Quoted','Approved','Installed','Completed']).parse(b.status)}).eq('id',z.string().uuid().parse(b.id));if(error)throw error;return NextResponse.json({ok:true});}
 return NextResponse.json({error:'Not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to complete request.'},{status:400});}}
