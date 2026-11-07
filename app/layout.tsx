import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'RAMSON Glass | Spaces, beautifully reimagined.',icons:{icon:'/favicon.svg'},description:'Custom glass partitions, railings, showers, doors and mirrors in Ludhiana. Estimate your project and manage every step with RAMSON Glass.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
