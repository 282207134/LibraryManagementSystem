import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const reader = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const admin = '10000000-0000-4000-8000-000000000003';
const book = '20000000-0000-4000-8000-000000000001';
const book2 = '20000000-0000-4000-8000-000000000002';
const query = async (sql, params=[]) => (await db.query(sql, params)).rows;
const rpc = async (name, params) => (await query(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) as result`, params))[0].result;
const login = async id => {
  await db.exec('RESET ROLE');
  await query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[id || '']);
  await db.exec(`SET LOCAL ROLE ${id ? 'authenticated' : 'anon'}`);
};
before(async () => {
  for (const file of ['tests/fixtures/database.sql','tests/fixtures/legacy-inventory.sql','supabase/migrations/20261109000000_fix_auth_user_profile_sync.sql','supabase/migrations/20261110000000_borrowing_approval.sql']) await db.exec(await readFile(file,'utf8'));
  // Re-applying the migration must also be safe.
  await db.exec(await readFile('supabase/migrations/20261110000000_borrowing_approval.sql','utf8'));
});
after(async () => { await db.close(); });

const scenario = (name, fn) => test(name, async () => {
  await db.exec('BEGIN');
  try {
    await query("INSERT INTO auth.users(id,email) VALUES($1,'reader@example.invalid'),($2,'other@example.invalid'),($3,'admin@example.invalid')",[reader,other,admin]);
    await query("UPDATE public.users SET role='admin' WHERE id=$1",[admin]);
    await query("INSERT INTO public.books(id,title,author,quantity,cover_image_url) VALUES($1,'Test book','Test author',1,'original-cover.png'),($2,'Other book','Test author',1,'other-cover.png')",[book,book2]);
    await fn();
  } finally { await db.exec('ROLLBACK'); }
});
scenario('request -> staff checkout -> staff return, with legacy inventory triggers', async () => {
  await login(reader);
  const request = await rpc('request_borrow_book',[book,30]);
  assert.equal(request.success,true); assert.equal(request.status,'pending'); assert.match(request.pickup_code,/^\d{8}$/);
  assert.equal((await query('select * from public.borrowing_records')).length,0);
  assert.equal((await query('select available_quantity from public.books where id=$1',[book]))[0].available_quantity,1);
  assert.equal((await rpc('approve_borrow_request',[request.pickup_code])).success,false);
  await login(admin);
  const approved = await rpc('approve_borrow_request',[request.pickup_code]); assert.equal(approved.success,true);
  const loan = (await query('select * from public.borrowing_records'))[0];
  assert.equal(new Date(loan.due_date)-new Date(loan.borrowed_at),30*86400000);
  assert.equal((await query('select available_quantity from public.books where id=$1',[book]))[0].available_quantity,0);
  assert.equal((await rpc('approve_borrow_request',[request.pickup_code])).success,false);
  await login(reader); assert.equal((await rpc('return_book',[loan.id])).success,false);
  await login(admin); assert.equal((await rpc('return_book',[loan.id])).success,true);
  assert.equal((await rpc('return_book',[loan.id])).success,false);
  const row=(await query('select available_quantity,cover_image_url from public.books where id=$1',[book]))[0];
  assert.equal(row.available_quantity,1); assert.equal(row.cover_image_url,'original-cover.png');
});
scenario('two readers request the last copy; only one can check out', async () => {
  await login(reader); const a=await rpc('request_borrow_book',[book,30]);
  await login(other); const b=await rpc('request_borrow_book',[book,30]);
  await login(admin); assert.equal((await rpc('approve_borrow_request',[a.pickup_code])).success,true);
  assert.equal((await rpc('approve_borrow_request',[b.pickup_code])).success,false);
  assert.equal((await query('select count(*) as n from public.borrowing_records'))[0].n,1);
  assert.equal((await query('select available_quantity from public.books where id=$1',[book]))[0].available_quantity,0);
});
scenario('duplicate application, pending quota, invalid duration and impersonation blocked', async () => {
  await query('update public.users set max_borrow_limit=1 where id=$1',[reader]);
  await login(reader);
  assert.equal((await rpc('request_borrow_book',[book,0])).success,false);
  assert.equal((await rpc('request_borrow_book',[book,null])).success,false);
  assert.equal((await rpc('borrow_book',[book,other,30])).success,false);
  assert.equal((await rpc('request_borrow_book',[book,30])).success,true);
  assert.equal((await rpc('request_borrow_book',[book,30])).success,false);
  assert.equal((await rpc('request_borrow_book',[book2,30])).success,false);
});
scenario('cancellation, rejection and expired applications never create a loan', async () => {
  await login(reader); const a=await rpc('request_borrow_book',[book,30]);
  await login(other); assert.equal((await rpc('close_borrow_request',[a.request_id,'cancelled',null])).success,false);
  await login(reader); assert.equal((await rpc('close_borrow_request',[a.request_id,'rejected','no'])).success,false);
  assert.equal((await rpc('close_borrow_request',[a.request_id,'cancelled',null])).success,true);
  const b=await rpc('request_borrow_book',[book,30]);
  await login(admin); assert.equal((await rpc('close_borrow_request',[b.request_id,'rejected',''])).success,false);
  assert.equal((await rpc('close_borrow_request',[b.request_id,'rejected','Not available'])).success,true);
  await login(reader); const c=await rpc('request_borrow_book',[book,30]);
  await db.exec('RESET ROLE'); await query("update public.borrowing_requests set expires_at=now()-interval '1 second' where id=$1",[c.request_id]);
  await login(admin); assert.equal((await rpc('approve_borrow_request',[c.pickup_code])).success,false);
  assert.equal((await query('select count(*) as n from public.borrowing_records'))[0].n,0);
});
scenario('overdue books remain borrowed and can be returned exactly once', async () => {
  const loan=(await query("insert into public.borrowing_records(book_id,user_id,due_date,status) values($1,$2,now()-interval '1 day','overdue') returning id",[book,reader]))[0];
  await login(reader); assert.equal((await rpc('request_borrow_book',[book,30])).success,false);
  await login(admin); assert.equal((await rpc('return_book',[loan.id])).success,true);
  assert.equal((await query('select available_quantity from public.books where id=$1',[book]))[0].available_quantity,1);
});
scenario('requests are private; readers cannot modify protected records or promote themselves', async () => {
  await login(reader); const a=await rpc('request_borrow_book',[book,30]);
  await login(other); assert.equal((await query('select * from public.borrowing_requests')).length,0);
  await login(reader);
  for(const sql of ["update public.users set role='admin'",'update public.users set max_borrow_limit=100',"insert into public.borrowing_records(book_id,user_id,due_date) values('"+book+"','"+reader+"',now())",'update public.borrowing_requests set status=\'approved\'']) {
    await db.exec('SAVEPOINT protected_write'); await assert.rejects(db.exec(sql)); await db.exec('ROLLBACK TO protected_write');
  }
  await query("update public.users set full_name='Updated reader' where id=$1",[reader]);
  assert.equal((await query('select role from public.users where id=$1',[reader]))[0].role,'user');
  assert.equal((await query("update public.books set quantity=99 where id=$1 returning id",[book])).length,0);
  assert.equal((await query('select status from public.borrowing_requests where id=$1',[a.request_id]))[0].status,'pending');
  await login(null);
  await assert.rejects(rpc('request_borrow_book',[book,30]));
});
scenario('history cannot be deleted and inventory cannot shrink below outstanding copies', async () => {
  await query("insert into public.borrowing_records(book_id,user_id,due_date,status) values($1,$2,now()+interval '30 days','borrowed')",[book,reader]);
  await login(admin);
  for(const sql of ['delete from public.books where id=\''+book+'\'', 'update public.books set quantity=0 where id=\''+book+'\'']) {
    await db.exec('SAVEPOINT keep_history'); await assert.rejects(db.exec(sql)); await db.exec('ROLLBACK TO keep_history');
  }
  assert.equal((await query('select available_quantity from public.books where id=$1',[book]))[0].available_quantity,0);
  const counts=await query('select * from public.get_book_borrow_counts()'); assert.equal(Number(counts[0].borrow_count),1);
});
