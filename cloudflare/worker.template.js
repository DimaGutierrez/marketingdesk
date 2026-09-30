// Bundled with schemas.json by build.mjs. All private routes require the workspace key.
const BASE='/marketingdesk';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const enc=new TextEncoder();
const stamp=()=>new Date().toISOString();
const serialize=r=>({id:r.id,version:r.version,updated:r.updated,...JSON.parse(r.data)});
export function validate(kind,body){
 const schema=SCHEMAS[kind];if(!schema)fail(404,'Sección inexistente.');
 if(!body||typeof body!=='object'||Array.isArray(body))fail(422,'Se esperaba un objeto.');
 for(const key of Object.keys(body))if(!Object.hasOwn(schema.properties,key))fail(422,'Campo no admitido: '+key);
 const result={};for(const [key,s]of Object.entries(schema.properties)){
 let v=body[key];if(v===undefined){if(Object.hasOwn(s,'default'))v=s.default;else fail(422,'Falta el campo: '+key)}
 if(s.type==='string'){if(typeof v!=='string')fail(422,'Texto inválido: '+key);v=v.trim();if(v.length<(s.minLength||0)||v.length>(s.maxLength||12000))fail(422,'Longitud inválida: '+key);if(s.enum&&!s.enum.includes(v))fail(422,'Opción inválida: '+key);if(s.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))fail(422,'Fecha inválida: '+key)}
 if(s.type==='integer'&&(!Number.isSafeInteger(v)||v<s.minimum||v>s.maximum))fail(422,'Número fuera de rango: '+key);
 result[key]=v;
 }
 if(kind==='campaigns'&&result.end<result.start)fail(422,'La fecha final debe ser posterior a la inicial.');
 if(kind==='content'){
 if(result.url){let u;try{u=new URL(result.url)}catch{fail(422,'Usá una URL HTTPS válida.')}if(u.protocol!=='https:'||u.username||u.password)fail(422,'Usá una URL HTTPS sin credenciales.');}
 if(result.status==='Publicado'&&!result.url)fail(422,'Agregá el enlace publicado.');
 }
 return result;
}
export function parseCSV(text){
 const rows=[];let row=[],value='',quoted=false,closed=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
 if(c==='"'){if(value||closed)fail(422,'CSV: comillas inválidas.');quoted=true;continue}
 if(c===','||c==='\n'||c==='\r'){row.push(value);value='';closed=false;if(c!==','){if(c==='\r'&&s[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[]}continue}
 if(closed)fail(422,'CSV: caracteres después de comillas.');value+=c;
 }
 if(quoted)fail(422,'CSV: comillas sin cerrar.');if(value||row.length||closed){row.push(value);rows.push(row)}
 const columns=Object.keys(SCHEMAS.metrics.properties),header=rows.shift()||[];
 if(header.length!==columns.length||new Set(header).size!==columns.length||columns.some(c=>!header.includes(c)))fail(422,'Columnas requeridas: '+columns.join(','));
 if(!rows.length||rows.length>2000)fail(422,'El archivo debe tener entre 1 y 2000 filas.');
 const seen=new Set();return rows.map((r,i)=>{if(r.length!==header.length)fail(422,`Fila ${i+2}: cantidad incorrecta de columnas.`);const o=Object.fromEntries(header.map((k,j)=>[k,['campaign','day'].includes(k)?r[j]:/^\d+$/.test(r[j])?Number(r[j]):NaN]));let m;try{m=validate('metrics',o)}catch(e){fail(422,`Fila ${i+2}: ${e.message}`)}const key=m.campaign+'|'+m.day;if(seen.has(key))fail(422,'Campaña y fecha duplicadas en el CSV.');seen.add(key);return m});
}
async function readBody(request,max=6000000){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'El archivo o solicitud supera el límite permitido.')}chunks.push(value)}const out=new Uint8Array(size);let p=0;for(const c of chunks){out.set(c,p);p+=c.length}return out}
async function readJSON(req){try{return JSON.parse(new TextDecoder().decode(await readBody(req,2200000)))}catch(e){if(e.status)throw e;fail(422,'JSON inválido.')}}
async function authorized(req,env){if(!env.MARKETING_KEY||env.MARKETING_KEY.length<24)fail(503,'Espacio todavía no configurado.');const a=await crypto.subtle.digest('SHA-256',enc.encode(req.headers.get('Authorization')||'')),b=await crypto.subtle.digest('SHA-256',enc.encode('Bearer '+env.MARKETING_KEY));if(!crypto.subtle.timingSafeEqual(a,b))fail(401,'Clave de acceso incorrecta.');}
const audit=(db,action,subject)=>db.prepare('INSERT INTO activity(at,action,subject) VALUES(?,?,?)').bind(stamp(),action,subject);
async function refs(db,body){if(body.campaign&&!await db.prepare("SELECT id FROM records WHERE id=? AND kind='campaigns'").bind(body.campaign).first())fail(422,'La campaña no existe.');if(body.asset&&!await db.prepare('SELECT id FROM assets WHERE id=?').bind(body.asset).first())fail(422,'La pieza no existe.');}
async function getWorkspace(db){const results=await db.batch([db.prepare('SELECT * FROM records ORDER BY updated DESC LIMIT 2001'),db.prepare('SELECT * FROM metrics ORDER BY day DESC LIMIT 10001'),db.prepare('SELECT id,name,mime,size FROM assets'),db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 80')]);if(results[0].results.length>2000||results[1].results.length>10000)fail(413,'El espacio supera la capacidad de esta versión.');const result={campaigns:[],content:[],tasks:[],ideas:[],metrics:results[1].results,assets:results[2].results,activity:results[3].results};for(const r of results[0].results)result[r.kind].push(serialize(r));return result;}
async function saveMetrics(db,rows){const payload=JSON.stringify(rows);await db.batch([db.prepare(`INSERT INTO metrics(campaign,day,impressions,clicks,leads,conversions,spend_cents,revenue_cents) SELECT json_extract(value,'$.campaign'),json_extract(value,'$.day'),json_extract(value,'$.impressions'),json_extract(value,'$.clicks'),json_extract(value,'$.leads'),json_extract(value,'$.conversions'),json_extract(value,'$.spend_cents'),json_extract(value,'$.revenue_cents') FROM json_each(?) WHERE true ON CONFLICT(campaign,day) DO UPDATE SET impressions=excluded.impressions,clicks=excluded.clicks,leads=excluded.leads,conversions=excluded.conversions,spend_cents=excluded.spend_cents,revenue_cents=excluded.revenue_cents`).bind(payload),audit(db,'Métricas guardadas',`${rows.length} filas`)]);}
async function checkMetrics(db,rows){const ids=new Set((await db.prepare("SELECT id FROM records WHERE kind='campaigns'").all()).results.map(x=>x.id));for(const r of rows)if(!ids.has(r.campaign))fail(422,'Campaña desconocida: '+r.campaign);const count=await db.prepare('SELECT COUNT(*) n FROM metrics').first();const old=await db.prepare("SELECT COUNT(*) n FROM json_each(?) j JOIN metrics m ON m.campaign=json_extract(j.value,'$.campaign') AND m.day=json_extract(j.value,'$.day')").bind(JSON.stringify(rows)).first();if(count.n+rows.length-old.n>10000)fail(422,'Máximo 10.000 registros diarios por espacio.');return old.n;}
async function api(req,env,path){
 await authorized(req,env);const db=env.MARKETING_DB;if(!db)fail(503,'Base de datos no configurada.');const url=new URL(req.url),method=req.method;
 if(path==='/workspace'&&method==='GET')return json(await getWorkspace(db));
 const record=path.match(/^\/records\/(campaigns|content|tasks|ideas)(?:\/([a-zA-Z0-9-]+))?$/);
 if(record&&['POST','PUT'].includes(method)){
 const [,kind,id]=record,body=validate(kind,await readJSON(req));await refs(db,body);const time=stamp();
 if(method==='POST'&&!id){const count=await db.prepare('SELECT COUNT(*) n FROM records').first();if(count.n>=2000)fail(422,'Máximo 2000 registros en este espacio.');const rid=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO records(id,kind,data,updated) VALUES(?,?,?,?)').bind(rid,kind,JSON.stringify(body),time),audit(db,'Creado',body.name||body.title)]);return json({id:rid,version:1,updated:time,...body},201)}
 if(method==='PUT'&&id){const version=Number(url.searchParams.get('version'));if(!Number.isSafeInteger(version)||version<1)fail(422,'Versión inválida.');const r=await db.prepare('UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND kind=? AND version=?').bind(JSON.stringify(body),time,id,kind,version).run();if(r.meta.changes!==1)fail(409,'Otra edición cambió este registro. Recargá antes de editarlo.');await audit(db,'Actualizado',body.name||body.title).run();return json({id,version:version+1,updated:time,...body})}
 }
 if(path==='/metrics'&&method==='PUT'){const row=validate('metrics',await readJSON(req));await checkMetrics(db,[row]);await saveMetrics(db,[row]);return json({saved:1})}
 if(path==='/import'&&method==='POST'){const body=await readJSON(req);if(typeof body.csv!=='string'||body.csv.length>2000000||!['boolean','undefined'].includes(typeof body.confirm))fail(422,'Importación inválida.');const rows=parseCSV(body.csv),replaced=await checkMetrics(db,rows);if(body.confirm)await saveMetrics(db,rows);return json({rows:rows.length,replaced,saved:!!body.confirm,preview:rows.slice(0,8)})}
 if(path==='/assets'&&method==='POST'){
 const bytes=await readBody(req,5000000),mime=req.headers.get('Content-Type'),head=new TextDecoder().decode(bytes.slice(0,12));const valid=(mime==='image/png'&&bytes[0]===137&&head.slice(1,4)==='PNG')||(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(mime==='image/webp'&&head.startsWith('RIFF')&&head.slice(8,12)==='WEBP')||(mime==='application/pdf'&&head.startsWith('%PDF-'));
 if(!valid||!bytes.length)fail(422,'Usá PNG, JPEG, WebP o PDF válidos.');const hash=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),name=(url.searchParams.get('name')||'pieza').split(/[\\/]/).pop().slice(0,150);
 if(await db.prepare('SELECT id FROM assets WHERE id=?').bind(id).first())return json({id,name,mime},201);
 const capacity=await db.prepare('SELECT COALESCE(SUM(size),0) total FROM assets').first();if(capacity.total+bytes.length>20000000)fail(422,'Límite del espacio: 20 MB de piezas.');
 const parts=[];for(let i=0;i<bytes.length;i+=60000){let str='';for(const b of bytes.slice(i,i+60000))str+=String.fromCharCode(b);parts.push(btoa(str))}
 await db.batch([db.prepare('INSERT INTO assets(id,name,mime,size) VALUES(?,?,?,?)').bind(id,name,mime,bytes.length),db.prepare('INSERT INTO asset_chunks(asset,part,body) SELECT ?,CAST(key AS INTEGER),value FROM json_each(?)').bind(id,JSON.stringify(parts)),audit(db,'Pieza adjunta',name)]);return json({id,name,mime},201);
 }
 const asset=path.match(/^\/assets\/([a-f0-9]{64})$/);if(asset&&method==='GET'){const row=await db.prepare('SELECT * FROM assets WHERE id=?').bind(asset[1]).first();if(!row)fail(404,'Adjunto no encontrado.');const chunks=(await db.prepare('SELECT body FROM asset_chunks WHERE asset=? ORDER BY part').bind(asset[1]).all()).results;const bytes=new Uint8Array(row.size);let p=0;for(const c of chunks){const s=atob(c.body);for(let i=0;i<s.length;i++)bytes[p++]=s.charCodeAt(i)}return new Response(bytes,{headers:{'Content-Type':row.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.name)}})}
 if(path==='/backup'&&method==='GET'){const r=await db.batch(['records','metrics','assets','asset_chunks','activity'].map(t=>db.prepare('SELECT * FROM '+t)));return new Response(JSON.stringify({format:'marketingdesk-d1-v1',created:stamp(),tables:Object.fromEntries(['records','metrics','assets','asset_chunks','activity'].map((t,i)=>[t,r[i].results]))}),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="marketingdesk-backup.json"'}})}
 fail(404,'Ruta no encontrada.');
}
export default {async fetch(request,env){const url=new URL(request.url);if(!url.pathname.startsWith(BASE+'/')&&url.pathname!==BASE)return env.ASSETS.fetch(request);let response;try{
 if(url.pathname===BASE)return Response.redirect(url.origin+BASE+'/',308);
 if(url.pathname===BASE+'/health')response=json({status:'ok',storage:'cloudflare-d1'});
 else if(url.pathname.startsWith(BASE+'/api/')){const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)fail(403,'Origen no permitido.');response=await api(request,env,url.pathname.slice((BASE+'/api').length));}
 else response=await env.ASSETS.fetch(request);
 }catch(e){response=json({detail:e.status?e.message:'No se pudo completar la operación. Intentá nuevamente.'},e.status||500);if(!e.status)console.error(JSON.stringify({event:'marketingdesk_error',message:e.message}));}
 const out=new Response(response.body,response);out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','no-referrer');out.headers.set('X-Frame-Options','DENY');out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");out.headers.set('Cache-Control','no-store');return out;
}};
