import Portal from '../portal';
import {configured,db,identity} from '@/lib/supabase';
import {services as fallback} from '@/lib/catalog';
import {redirect,notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params; const route='/'+path.join('/');const user=await identity();
 if((path[0]==='admin'||path[0]==='project'||path[0]==='projects')&&!user)redirect('/login');
 if(path[0]==='admin'&&!user?.is_admin)redirect('/projects');
 let catalog=fallback;if(configured()){const s=await db();const {data}=await s.from('services').select('*').order('sort_order');if(data?.length)catalog=data;}
 const valid=['/','/services','/services/drone-steam-cleaning','/estimate','/portfolio','/about','/contact','/login','/signup','/forgot-password','/reset-password','/projects','/admin','/demo'];
 if(!valid.includes(route)&&!(path[0]==='services'&&path.length===2&&catalog.some(s=>s.id===path[1]))&&!(path[0]==='project'&&path.length===2))notFound();
 return <Portal route={route} catalog={catalog} configured={configured()} user={user}/>;
}
