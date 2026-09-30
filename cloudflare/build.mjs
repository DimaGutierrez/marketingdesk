import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await mkdir(new URL('marketingdesk/',out),{recursive:true});
const schemas=await readFile(new URL('cloudflare/schemas.json',base),'utf8'),source=await readFile(new URL('cloudflare/worker.template.js',base),'utf8');
await writeFile(new URL('_worker.js',out),'const SCHEMAS='+schemas+';\n'+source);
await writeFile(new URL('_routes.json',out),JSON.stringify({version:1,include:['/marketingdesk','/marketingdesk/*'],exclude:[]}));
for(const f of ['index.html','app.js','style.css','base.css','demo.json']){
 let text=await readFile(new URL('web/'+f,base),'utf8');
 if(f==='index.html')text=text.replace('href="/style.css"','href="/marketingdesk/style.css"').replace('src="/app.js"','src="/marketingdesk/app.js"').replace('Disponible en <code>data/workspace.key</code> al iniciar la aplicación.','Acceso privado para el responsable del espacio.').replace('<title>','<meta name="description" content="Marketing Desk: campañas, contenidos, métricas y coordinación en un solo espacio. Proyecto fullstack de Diego Gutierrez."><meta property="og:image" content="https://diegogutierrez.pages.dev/marketingdesk/hero.png"><meta property="og:title" content="Marketing Desk — Del plan a la evidencia"><title>');
 if(f==='app.js')text=text.replace("fetch('/api/'","fetch('/marketingdesk/api/'").replaceAll('marketing-desk-backup.sqlite3','marketingdesk-backup.json');
 if(f==='style.css')text=text.replace('/base.css','/marketingdesk/base.css');
 await writeFile(new URL('marketingdesk/'+f,out),text);
}
await copyFile(new URL('assets/hero.png',base),new URL('marketingdesk/hero.png',out));
console.log('Cloudflare build complete.');
