import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {operator} from '@/lib/operations';
import Operations from './workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Enquiry desk | RAMSON Glass',robots:{index:false,follow:false}};
export default async function Page(){await requireChatGPTUser('/operations');const user=await operator();if(!user)return <main className="ops-denied"><h1>Owner access required.</h1><p>This workspace is restricted to the RAMSON business owner.</p><a href="/">Return to RAMSON Glass</a></main>;return <Operations name={user.displayName}/>;}
