import {readFile,writeFile} from 'node:fs/promises';
// Standalone Cloudflare hosting uses Supabase authentication, not Sites identity headers.
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
config.name='ramson-glass';
config.vars={...(config.vars||{}),HOSTING_MODE:'standalone'};
// The Sites-managed D1 database cannot be referenced by its placeholder ID from another account.
config.d1_databases=[];
config.r2_buckets=[];
await writeFile('dist/server/wrangler.standalone.json',JSON.stringify(config,null,2)+'\n');
console.log('Standalone Worker configuration prepared. Supabase runtime secrets must be configured before deployment.');
