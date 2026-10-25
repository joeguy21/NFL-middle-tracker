const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {Pool}=require("pg"),PORT=process.env.PORT||10000,API_KEY=process.env.FANLINE_API_KEY,ACCESS=process.env.TRACKER_ACCESS_KEY,DB=process.env.DATABASE_URL,SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/$/,""),SUPABASE_PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY,BASE="https://api.fanlinewire.com",ROOT=__dirname;
const pool=DB?new Pool({connectionString:DB,ssl:process.env.PGSSLMODE==="disable"?false:{rejectUnauthorized:false},max:5}):null;let ready=false;
const send=(r,s,o)=>{r.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});r.end(JSON.stringify(o))};
async function schema(){if(!pool)throw Error("Database not configured");if(ready)return;await pool.query("CREATE TABLE IF NOT EXISTS tracker_records(record_id TEXT PRIMARY KEY,record_type TEXT NOT NULL,game_key TEXT NOT NULL,payload JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");await pool.query("CREATE TABLE IF NOT EXISTS tracker_user_records(user_id UUID NOT NULL,record_id TEXT NOT NULL,record_type TEXT NOT NULL,game_key TEXT NOT NULL,payload JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,record_id))");await pool.query("CREATE INDEX IF NOT EXISTS tracker_user_records_updated_idx ON tracker_user_records(user_id,updated_at)");ready=true}
async function readBody(req){let b="";for await(const x of req){b+=x;if(b.length>500000)throw Error("Body too large")}return JSON.parse(b||"{}")}
function auth(req){let k=req.headers["x-tracker-key"];return !!ACCESS&&typeof k==="string"&&k.length===ACCESS.length&&crypto.timingSafeEqual(Buffer.from(k),Buffer.from(ACCESS))}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host||"localhost"}`);
if(u.pathname==="/api/health")return send(res,200,{ok:true,keyConfigured:!!API_KEY,ledgerConfigured:!!pool&&!!ACCESS});
if(req.method==="GET"&&u.pathname==="/api/auth-config"){if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return send(res,503,{ok:false,error:"Authentication configuration is missing."});return send(res,200,{ok:true,url:SUPABASE_URL,publishableKey:SUPABASE_PUBLISHABLE_KEY})}

// The former global-key ledger exposed one shared collection. It is intentionally retired.
if(u.pathname.startsWith("/api/ledger"))return send(res,410,{ok:false,error:"The shared ledger has been retired. Sign-in based sync is being introduced; legacy cloud records were not copied to user accounts."});
if(u.pathname.startsWith("/api/my-ledger")){
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return send(res,503,{ok:false,error:"SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured."});
 if(!pool)return send(res,503,{ok:false,error:"DATABASE_URL must be configured."});
 const authorization=req.headers.authorization||"",match=authorization.match(/^Bearer (.+)$/);
 if(!match)return send(res,401,{ok:false,error:"Sign in is required."});
 try{
  // Ask Supabase Auth to validate the supplied user access token; never trust a client-supplied user ID.
  const verified=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+match[1]},signal:AbortSignal.timeout(10000)});
  if(!verified.ok)return send(res,401,{ok:false,error:"Your session is invalid or expired. Please sign in again."});
  const account=await verified.json();if(!account||typeof account.id!=="string")return send(res,401,{ok:false,error:"Could not verify signed-in user."});
  await schema();
  if(req.method==="GET"&&u.pathname==="/api/my-ledger"){const rows=await pool.query("SELECT payload FROM tracker_user_records WHERE user_id=$1 ORDER BY updated_at",[account.id]);return send(res,200,{ok:true,records:rows.rows.map(x=>x.payload)})}
  if(req.method==="POST"&&u.pathname==="/api/my-ledger/sync"){
   const data=await readBody(req);if(!Array.isArray(data.records)||data.records.length>2000)return send(res,400,{ok:false,error:"Expected up to 2,000 records."});
   // Reject malformed batches before writing anything; never silently drop rows.
   const ids=new Set();for(const r of data.records){if(!r||typeof r!=="object"||Array.isArray(r)||typeof r.id!=="string"&&typeof r.id!=="number"||String(r.id).length<1||String(r.id).length>180||typeof r.game!=="string"||!r.game.trim()||r.game.length>300||typeof r.recordType!=="string"||!r.recordType.trim()||r.recordType.length>32)return send(res,400,{ok:false,error:"Each record needs a valid id, game and recordType; invalid batch rejected."});const id=String(r.id);if(ids.has(id))return send(res,400,{ok:false,error:"Duplicate record IDs in batch; no changes made."});ids.add(id);if(JSON.stringify(r).length>100000)return send(res,400,{ok:false,error:"A record is too large."});}
   const client=await pool.connect();let synced=0;
   try{await client.query("BEGIN");for(const r of data.records){await client.query("INSERT INTO tracker_user_records(user_id,record_id,record_type,game_key,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(user_id,record_id) DO UPDATE SET record_type=EXCLUDED.record_type,game_key=EXCLUDED.game_key,payload=EXCLUDED.payload,updated_at=NOW()",[account.id,String(r.id),r.recordType,r.game.trim().toLowerCase(),JSON.stringify(r)]);synced++}await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}return send(res,200,{ok:true,synced})
  }
  if(req.method==="DELETE"&&u.pathname==="/api/my-ledger/record"){const id=u.searchParams.get("id");if(!id)return send(res,400,{ok:false,error:"Record ID required"});const result=await pool.query("DELETE FROM tracker_user_records WHERE user_id=$1 AND record_id=$2",[account.id,id]);return send(res,200,{ok:true,deleted:result.rowCount})}
  return send(res,404,{ok:false,error:"Unknown account ledger endpoint"});
 }catch(e){console.error("account ledger:",e.message);return send(res,500,{ok:false,error:"Account ledger operation failed; check server logs."})}
}
if(u.pathname==="/api/spread-lines"){if(!API_KEY)return send(res,503,{ok:false,error:"FANLINE_API_KEY is not configured in Render."});try{const q=await fetch(BASE+"/v1/nj/markets?league=nfl&category=spread&period=game",{headers:{"x-api-key":API_KEY,Accept:"application/json"},signal:AbortSignal.timeout(15000)});res.writeHead(q.status,{"Content-Type":q.headers.get("content-type")||"application/json","Cache-Control":"no-store"});return res.end(await q.text())}catch{return send(res,502,{ok:false,error:"FanLine detailed spread market service could not be reached."})}}
if(u.pathname==="/api/odds"){if(!API_KEY)return send(res,503,{ok:false,error:"FANLINE_API_KEY is not configured in Render."});try{const q=await fetch(BASE+"/v1/board.json",{headers:{"x-api-key":API_KEY,Accept:"application/json"},signal:AbortSignal.timeout(12000)});res.writeHead(q.status,{"Content-Type":q.headers.get("content-type")||"application/json","Cache-Control":"no-store"});return res.end(await q.text())}catch{return send(res,502,{ok:false,error:"FanLine odds service could not be reached."})}}
const file=path.resolve(ROOT,u.pathname==="/"?"index.html":decodeURIComponent(u.pathname.slice(1)));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end("Not found")}const ext=path.extname(file),types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res)
});server.listen(PORT,"0.0.0.0",()=>console.log("NFL tracker on "+PORT));
