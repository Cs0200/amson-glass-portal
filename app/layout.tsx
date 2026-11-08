import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'RAMSON Glass | Spaces, beautifully reimagined.',icons:{icon:'/favicon.svg'},description:'Residential and commercial glass solutions in Ludhiana: partitions, railings, shower cubicles, doors, mirrors and films. Estimate your project and manage every step with RAMSON Glass.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
