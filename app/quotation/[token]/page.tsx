import {database} from '@/lib/operations';
import {notFound} from 'next/navigation';
import Accept from './review';
export const dynamic='force-dynamic';
export const metadata={title:'Your quotation | RAMSON Glass',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();
 const q=await database().prepare("SELECT q.*,(SELECT COALESCE(SUM(amount),0) FROM request_payments WHERE request_id=q.request_id AND voided_at IS NULL) recorded_paid,r.name,r.city,r.customer_type,r.status,(SELECT MAX(id) FROM request_quotes WHERE request_id=q.request_id) latest FROM request_quotes q JOIN consultation_requests r ON r.id=q.request_id WHERE q.token=?").bind(token).first();if(!q)notFound();
 return <Accept quote={JSON.parse(JSON.stringify(q))}/>;
}
