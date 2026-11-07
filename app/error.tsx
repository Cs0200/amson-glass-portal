'use client';
export default function Error({reset}:{reset:()=>void}){return <main className="empty"><h1>Let’s get a clearer view.</h1><p>We couldn’t load this page. Please try again or call +91 98764 50935.</p><button className="button" onClick={reset}>Try again</button><a href="/">Return home</a></main>}
