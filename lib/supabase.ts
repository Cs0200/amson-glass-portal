import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const configured=()=>Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
export async function db(){
 if(!configured()) throw new Error('Database setup is pending. Please call RAMSON Glass to book.');
 const jar=await cookies();
 return createServerClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:(items:{name:string;value:string;options:CookieOptions}[])=>{try{items.forEach(({name,value,options})=>jar.set(name,value,{...options,secure:process.env.NODE_ENV==='production',sameSite:'lax',httpOnly:true}));}catch{}}}});
}
export async function identity(){if(!configured())return null;const s=await db();const {data:{user}}=await s.auth.getUser();if(!user)return null;const {data}=await s.from('profiles').select('is_admin,name').eq('id',user.id).single();return {id:user.id,email:user.email,...data};}
