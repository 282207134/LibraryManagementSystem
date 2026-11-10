import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export const ids = { reader:'10000000-0000-4000-8000-000000000001', other:'10000000-0000-4000-8000-000000000002', admin:'10000000-0000-4000-8000-000000000003', book:'20000000-0000-4000-8000-000000000001' };
export async function createBackend() {
  const db = new PGlite();
  for (const file of ['tests/fixtures/database.sql','tests/fixtures/legacy-inventory.sql','supabase/migrations/20261109000000_fix_auth_user_profile_sync.sql','supabase/migrations/20261110000000_borrowing_approval.sql']) await db.exec(await readFile(file,'utf8'));
  await db.query("insert into auth.users(id,email) values($1,'reader@example.invalid'),($2,'other@example.invalid'),($3,'admin@example.invalid')",[ids.reader,ids.other,ids.admin]);
  await db.query("update public.users set role='admin',full_name='Test Admin' where id=$1",[ids.admin]);
  await db.query("update public.users set full_name='Test Reader' where id=$1",[ids.reader]);
  for(let i=1;i<=11;i++) await db.query("insert into public.books(id,title,author,quantity,cover_image_url,category) values($1,$2,'Test Author',2,'http://127.0.0.1:5173/app-icon.png','文学')",['20000000-0000-4000-8000-'+String(i).padStart(12,'0'),i===1?'测试图书（第一册）':`测试图书 ${i}`]);
  await db.exec("create table public.book_favorites(id uuid default gen_random_uuid(),user_id uuid,book_id uuid,favorited_at timestamptz default now()); create table public.reviews(id uuid default gen_random_uuid(),user_id uuid,book_id uuid,rating integer,comment text,created_at timestamptz default now(),updated_at timestamptz default now()); grant all on public.book_favorites,public.reviews to authenticated");
  let chain=Promise.resolve();
  const as = (id, action) => {
    const result=chain.then(async()=>{
      await db.exec('BEGIN');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[id]);
        await db.exec('SET LOCAL ROLE authenticated');
        const result=await action(); await db.exec('COMMIT'); return result;
      } catch(error) { await db.exec('ROLLBACK'); throw error; }
    });
    chain=result.catch(()=>{}); return result;
  };
  const rpc=async(id,name,args)=>as(id,async()=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result);
  const calls=[];
  const delays={};
  const failures=new Set();
  async function attach(context,id=ids.reader) {
    const authUser={id,aud:'authenticated',role:'authenticated',email:id===ids.admin?'admin@example.invalid':'reader@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{name:id===ids.admin?'Test Admin':'Test Reader'},created_at:new Date().toISOString()};
    await context.addInitScript(({user})=>{
      const encode=value=>btoa(JSON.stringify(value));
      const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
      localStorage.setItem('sb-fmilpfmdvpbpomygpxtz-auth-token',JSON.stringify({access_token:token,refresh_token:'local-test-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
      localStorage.setItem('user-theme','light');
      localStorage.setItem('library_app_language','zh');
    },{user:authUser});
    await context.route('https://fmilpfmdvpbpomygpxtz.supabase.co/**',async route=>{
      const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1),method=req.method();
      calls.push({table,method,search:url.search});
      const send=(data,status=200,headers={})=>route.fulfill({status,json:data,headers});
      if(failures.has(table)) return send({message:'测试：网络读取失败'},503);
      if(url.pathname.includes('/auth/')) return send(table==='logout'?{}:authUser);
      if(url.pathname.includes('/rpc/')) {
        const body=req.postDataJSON()||{};
        const mappings={request_borrow_book:['p_book_id','p_days'],approve_borrow_request:['p_code'],close_borrow_request:['p_request_id','p_action','p_note'],return_book:['p_borrowing_id'],get_book_borrow_counts:[]};
        if(!mappings[table]) return send({message:'Unknown test RPC'},400);
        try {
          const data=table==='get_book_borrow_counts'?await as(id,async()=>(await db.query('select * from public.get_book_borrow_counts()')).rows):await rpc(id,table,mappings[table].map(key=>body[key]??null));
          return send(data);
        } catch(error){return send({message:error.message},400);}
      }
      const allowed=['users','books','borrowing_records','borrowing_requests','book_favorites','reviews'];
      if(!allowed.includes(table)) return send({message:'Unexpected request'},400);
      try {
        let rows=await as(id,async()=> (await db.query('select * from public.'+table)).rows);
        for(const [key,value] of url.searchParams) {
          if(['select','order','limit','offset','or'].includes(key)) continue;
          if(value.startsWith('eq.')) rows=rows.filter(row=>String(row[key])===value.slice(3));
          else if(value.startsWith('in.(')) rows=rows.filter(row=>value.slice(4,-1).split(',').includes(String(row[key])));
          else if(value.startsWith('gt.')) rows=rows.filter(row=>new Date(row[key])>new Date(value.slice(3)));
        }
        const or=url.searchParams.get('or');
        if(or) {
          const delay=Object.entries(delays).find(([term])=>or.includes(term))?.[1];
          if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
          const match=or.match(/title\.ilike\."%((?:\\.|[^"\\])*)%"/);
          if(!match) return send({message:'Unquoted search filter'},400);
          const term=match[1].replace(/\\(.)/g,'$1').toLowerCase();
          rows=rows.filter(row=>[row.title,row.author].some(value=>value?.toLowerCase().includes(term)));
        }
        if(method==='POST'||method==='PATCH') {
          const input=req.postDataJSON(),body=Array.isArray(input)?input[0]:input;
          const columns=Object.keys(body);
          const sql=method==='POST'?`insert into public.${table}(${columns.join(',')}) values(${columns.map((_,i)=>'$'+(i+1)).join(',')}) returning *`:`update public.${table} set ${columns.map((key,i)=>key+'=$'+(i+1)).join(',')} where id=$${columns.length+1} returning *`;
          rows=await as(id,async()=>(await db.query(sql,method==='POST'?Object.values(body):[...Object.values(body),rows[0]?.id])).rows);
        }
        if(method==='DELETE') {
          for(const row of rows) await as(id,async()=>db.query('delete from public.'+table+' where id=$1',[row.id]));
          return route.fulfill({status:204});
        }
        if(['borrowing_records','borrowing_requests','book_favorites'].includes(table)) {
          const books=(await db.query('select * from public.books')).rows;
          const users=(await db.query('select * from public.users')).rows;
          rows=rows.map(row=>({...row,books:books.find(book=>book.id===row.book_id),...(table==='borrowing_requests'?{users:users.find(user=>user.id===row.user_id)}:{})}));
        }
        rows.sort((a,b)=>String(b.created_at||b.id).localeCompare(String(a.created_at||a.id)));
        const count=rows.length,offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);
        rows=rows.slice(offset,offset+limit);
        const headers={'content-range':`${offset}-${Math.max(offset,offset+rows.length-1)}/${count}`,'access-control-expose-headers':'content-range'};
        if(method==='HEAD') return route.fulfill({status:200,body:'',headers});
        const single=req.headers()['accept']?.includes('application/vnd.pgrst.object+json');
        if(single && !rows.length) return send({code:'PGRST116',details:'The result contains 0 rows'},406);
        return send(single?rows[0]:rows,200,headers);
      } catch(error){return send({message:error.message},400);}
    });
  }
  return {db,attach,rpc,calls,delays,failures};
}
