import Portal from '../portal';
import {configured,db,identity} from '@/lib/supabase';
import {services as fallback} from '@/lib/catalog';
import {redirect,notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params;const route='/'+path.join('/');const user=await identity();
 if(route==='/login')redirect('/customer/login');
 if(route==='/projects')redirect(user?.is_admin?'/admin':'/customer');
 if(route==='/demo')redirect('/demo/admin');
 if(path[0]==='project'&&path.length===2)redirect((user?.is_admin?'/admin/project/':'/customer/project/')+path[1]);
 if(!configured()&&path[0]==='admin')redirect('/operations');
 if(!configured()&&(['customer','signup','forgot-password','reset-password'].includes(path[0])))redirect('/my-requests');
 const adminArea=path[0]==='admin'&&route!=='/admin/login';const customerArea=path[0]==='customer'&&route!=='/customer/login';
 if(adminArea&&!user)redirect('/admin/login');
 if(adminArea&&!user?.is_admin)redirect('/customer?notice=admin-only');
 if(customerArea&&!user)redirect('/customer/login');
 if(customerArea&&user?.is_admin)redirect('/admin');
 if((route==='/admin/login'||route==='/customer/login')&&user)redirect(user.is_admin?'/admin':'/customer');
 let catalog=fallback;if(configured()){const s=await db();const {data}=await s.from('services').select('*').order('sort_order');if(data?.length)catalog=data;}
 const valid=['/','/services','/services/drone-steam-cleaning','/estimate','/portfolio','/about','/contact','/signup','/forgot-password','/reset-password','/customer/login','/customer','/admin/login','/admin','/demo/customer','/demo/admin'];
 const projectRoute=(path[0]==='admin'||path[0]==='customer')&&path[1]==='project'&&path.length===3;
 if(!valid.includes(route)&&!(path[0]==='services'&&path.length===2&&catalog.some(s=>s.id===path[1]))&&!projectRoute)notFound();
 return <Portal route={route} catalog={catalog} configured={configured()} user={user}/>;
}
