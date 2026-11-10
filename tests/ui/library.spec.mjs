import { test, expect } from '@playwright/test';
import { createBackend, ids } from './support.mjs';

let backend;
test.beforeEach(async () => { backend=await createBackend(); });
test.afterEach(async () => { await backend.db.close(); });
const errorsFor=page=> { const errors=[]; page.on('pageerror',error=>errors.push(error.message)); return errors; };

test('reader requests, gets scannable ticket; staff confirm checkout and return',async({browser},testInfo)=>{
  const readerContext=await browser.newContext(); await backend.attach(readerContext);
  const reader=await readerContext.newPage(),errors=errorsFor(reader);
  await reader.goto('/user/books/'+ids.book);
  await expect(reader.getByRole('heading',{name:'测试图书（第一册）',exact:true})).toBeVisible();
  reader.on('dialog',dialog=>dialog.accept());
  await reader.getByRole('button',{name:'申请借阅',exact:true}).click();
  await expect(reader.getByRole('button',{name:'待确认',exact:true})).toBeDisabled();
  await reader.goto('/user/my-borrowings');
  const code=await reader.getByTestId('pickup-code').innerText(); expect(code).toMatch(/^\d{8}$/);
  expect(await reader.locator('.borrowing-ticket svg').count()).toBe(2);
  const decoded=await reader.evaluate(async()=>{
    const {BrowserMultiFormatReader}=await import('/node_modules/.vite/deps/@zxing_browser.js');
    const values=[];
    for(const svg of document.querySelectorAll('.borrowing-ticket svg')) {
      const image=new Image(); image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)); await image.decode();
      values.push((await new BrowserMultiFormatReader().decodeFromImageElement(image)).getText());
    }
    return values;
  });
  expect(decoded).toEqual([code,code]);
  await reader.screenshot({path:testInfo.outputPath('reader-ticket.png'),fullPage:true});
  expect((await backend.db.query('select available_quantity from public.books where id=$1',[ids.book])).rows[0].available_quantity).toBe(2);
  const adminContext=await browser.newContext(); await backend.attach(adminContext,ids.admin);
  const admin=await adminContext.newPage(); errorsFor(admin);
  await admin.goto('/admin/borrowings');
  await admin.getByLabel('输入 8 位数字码').fill(code); await admin.getByLabel('输入 8 位数字码').press('Enter');
  const result=admin.getByTestId('lookup-result'); await expect(result).toContainText('测试图书（第一册）'); await expect(result).toContainText('Test Reader');
  await admin.screenshot({path:testInfo.outputPath('admin-checkout.png'),fullPage:true});
  admin.on('dialog',dialog=>dialog.accept());
  await result.getByRole('button',{name:'确认借出',exact:true}).click();
  await expect(result.getByRole('button',{name:'确认归还',exact:true})).toBeVisible();
  await reader.reload(); await reader.getByRole('button',{name:'当前借阅',exact:true}).click();
  await expect(reader.getByText('请到馆归还图书，由管理员确认收书。')).toBeVisible();
  await expect(reader.getByRole('button',{name:'归还',exact:true})).toHaveCount(0);
  expect((await backend.db.query('select available_quantity from public.books where id=$1',[ids.book])).rows[0].available_quantity).toBe(1);
  await result.getByRole('button',{name:'确认归还',exact:true}).click();
  await expect(result).toContainText('已归还'); await expect(result.getByRole('button',{name:'确认归还',exact:true})).toHaveCount(0);
  expect((await backend.db.query('select available_quantity from public.books where id=$1',[ids.book])).rows[0].available_quantity).toBe(2);
  expect(errors).toEqual([]);
  await readerContext.close(); await adminContext.close();
});

test('cancellation and rejection are visible in reader history',async({page,context})=>{
  const a=await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await backend.attach(context); page.on('dialog',dialog=>dialog.accept());
  await page.goto('/user/my-borrowings'); await expect(page.getByTestId('pickup-code')).toHaveText(a.pickup_code);
  await page.getByRole('button',{name:'取消申请',exact:true}).click();
  await expect(page.getByTestId('pickup-code')).toHaveCount(0);
  const b=await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await backend.rpc(ids.admin,'close_borrow_request',[b.request_id,'rejected','实物正在修复']);
  await page.reload(); await page.getByRole('button',{name:'历史记录',exact:true}).click();
  await expect(page.getByText('实物正在修复',{exact:false})).toBeVisible();
  await expect(page.getByText('已取消',{exact:true})).toBeVisible();
});

test('admin manual/scanner input validates codes and camera failure has a fallback',async({page,context})=>{
  await backend.attach(context,ids.admin); await page.goto('/admin/borrowings');
  await page.getByLabel('输入 8 位数字码').fill('bad-code'); await page.getByRole('button',{name:'查询凭证',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('请输入 8 位数字码');
  await page.getByLabel('输入 8 位数字码').fill('12345678'); await page.getByLabel('输入 8 位数字码').press('Enter');
  await expect(page.getByRole('alert')).toContainText('未找到对应凭证');
  await page.evaluate(()=>{ Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}}); });
  await page.getByRole('button',{name:'摄像头扫码'}).click();
  await expect(page.getByText('无法打开摄像头，请允许摄像头权限，或使用扫码枪、手动输入数字码。')).toBeVisible();
  await page.getByRole('button',{name:'关闭摄像头'}).click(); await expect(page.locator('video')).toHaveCount(0);
});

test('all reader/admin routes load and regular users cannot open admin pages',async({page,context,browser})=>{
  await backend.attach(context); const errors=errorsFor(page);
  for(const [route,heading] of [['/user/dashboard','新上架'],['/user/home','图书浏览'],['/user/my-borrowings','我的借阅'],['/user/my-favorites','我的收藏'],['/user/profile','个人中心']]) {
    await page.goto(route); await expect(page.getByRole('heading',{name:heading,exact:true}).first()).toBeVisible();
  }
  await page.goto('/admin/borrowings'); await expect(page).toHaveURL(/\/user\/dashboard$/);
  const adminContext=await browser.newContext(); await backend.attach(adminContext,ids.admin); const admin=await adminContext.newPage();
  for(const route of ['/admin/dashboard','/admin/borrowings']) { await admin.goto(route); await expect(admin.getByRole('button',{name:route.endsWith('dashboard')?'添加图书':'查询凭证',exact:true})).toBeVisible(); }
  expect(errors).toEqual([]); await adminContext.close();
});

test('file chooser, existing cover preview and same-file reselection work',async({page,context})=>{
  await backend.attach(context,ids.admin); await page.goto('/admin/dashboard');
  await page.getByRole('button',{name:'添加图书',exact:true}).click();
  const chooserPromise=page.waitForEvent('filechooser'); await page.getByText('点击选择文件',{exact:true}).click();
  const chooser=await chooserPromise;
  const file={name:'cover.png',mimeType:'image/png',buffer:await readIcon()}; await chooser.setFiles(file);
  await expect(page.locator('img[alt^="Cover preview"]')).toBeVisible();
  await expect(page.locator('img[alt^="Cover preview"]')).toHaveJSProperty('naturalWidth',501);
  await page.getByRole('button',{name:/移除|清除|删除封面/}).click();
  await page.locator('#cover-image-input').setInputFiles(file);
  await expect(page.locator('img[alt^="Cover preview"]')).toBeVisible();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();
  await expect(page.locator('img[alt^="Cover preview"]')).toBeVisible();
  expect(backend.calls.filter(call=>call.table==='books'&&call.method==='PATCH')).toHaveLength(0);
});
async function readIcon() { const {readFile}=await import('node:fs/promises'); return readFile('public/app-icon.png'); }

test('search punctuation and clearing search restore the full list',async({page,context})=>{
  await backend.attach(context); await page.goto('/user/home?search='+encodeURIComponent('测试图书（第一册）'));
  await expect(page.locator('.user-book-card')).toHaveCount(1);
  await page.getByRole('link',{name:'图书浏览',exact:true}).first().click();
  await expect(page.locator('.user-book-card')).toHaveCount(10);
  const search=page.getByPlaceholder('搜索书名或作者...').filter({visible:true});
  await search.fill('missing,(book)'); await search.press('Enter');
  await expect(page.locator('.user-book-card')).toHaveCount(0);
  await search.fill(''); await search.press('Enter'); await expect(page.locator('.user-book-card')).toHaveCount(10);
});

test('read failures are shown as errors, with a working retry',async({page,context})=>{
  await backend.attach(context); backend.failures.add('borrowing_requests');
  await page.goto('/user/my-borrowings'); await expect(page.getByRole('alert')).toContainText('测试：网络读取失败');
  backend.failures.clear(); await page.getByRole('button',{name:'刷新',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0); await expect(page.getByText('暂无匹配记录')).toBeVisible();
});

test('phone layout exposes navigation and keeps tickets within the viewport',async({page,context},testInfo)=>{
  await backend.attach(context); await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await page.setViewportSize({width:390,height:844}); await page.goto('/user/my-borrowings');
  await expect(page.getByTestId('pickup-code')).toBeVisible();
  await expect(page.getByRole('link',{name:'图书浏览',exact:true}).filter({visible:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('reader-phone.png'),fullPage:true});
  await page.getByRole('button',{name:'切换到深色主题'}).click(); await expect(page.locator('.user-theme')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'切换到浅色主题'}).click(); await expect(page.locator('.user-theme')).toHaveAttribute('data-theme','light');
});

test('camera decoding selects the request and stops scanning before any approval',async({page,context})=>{
  const request=await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await backend.attach(context,ids.admin); await page.goto('/admin/borrowings');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {createElement}=await import('react'); const {QRCodeSVG}=await import('qrcode.react');
  await expect(page.getByRole('button',{name:'摄像头扫码'})).toBeVisible();
  const svg=renderToStaticMarkup(createElement(QRCodeSVG,{value:request.pickup_code,size:256,marginSize:4})).replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
  await page.evaluate(async(svg)=>{
    const canvas=document.createElement('canvas'); canvas.width=480; canvas.height=480;
    const image=new Image(); image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); await image.decode();
    const ctx=canvas.getContext('2d'); const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.drawImage(image,80,80,320,320);}; draw();
    window.__testCameraStream=canvas.captureStream(10); window.__drawCodeTimer=setInterval(draw,100);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>window.__testCameraStream});
  },svg);
  await page.getByRole('button',{name:'摄像头扫码'}).click();
  await expect(page.getByTestId('lookup-result')).toContainText('Test Reader');
  await expect(page.locator('video')).toHaveCount(0);
  expect(await page.evaluate(()=>{clearInterval(window.__drawCodeTimer);return window.__testCameraStream.getTracks().every(track=>track.readyState==='ended');})).toBe(true);
  expect((await backend.db.query('select * from public.borrowing_records')).rows).toHaveLength(0);
});

test('favorites, reviews and profile changes work without changing user privileges',async({page,context})=>{
  await backend.attach(context); page.on('dialog',dialog=>dialog.accept());
  await page.goto('/user/books/'+ids.book);
  await page.getByRole('button',{name:/☆\s*收藏/}).click();
  await expect(page.getByRole('button',{name:/⭐\s*已收藏/})).toBeVisible();
  await page.getByRole('button',{name:'添加评论',exact:true}).click();
  await page.getByRole('button',{name:'5 / 5',exact:true}).click();
  await page.getByPlaceholder('分享你的阅读体验...').fill('回归测试评论');
  await page.getByRole('button',{name:'提交评论',exact:true}).click();
  await expect(page.getByText('回归测试评论').first()).toBeVisible();
  await page.goto('/user/my-favorites'); await expect(page.getByRole('heading',{name:'测试图书（第一册）',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'取消收藏',exact:true}).click(); await expect(page.getByText('暂无收藏的图书')).toBeVisible();
  await page.goto('/user/profile'); await page.getByRole('button',{name:'编辑信息',exact:true}).click();
  await page.getByPlaceholder('请输入您的姓名').fill(''); await page.getByRole('button',{name:'保存更改',exact:true}).click();
  await expect(page.getByText('姓名不能为空')).toBeVisible();
  await page.getByPlaceholder('请输入您的姓名').fill('修改后的姓名'); await page.getByRole('button',{name:'保存更改',exact:true}).click();
  await expect(page.getByText('个人信息更新成功！')).toBeVisible();
  expect((await backend.db.query('select role from public.users where id=$1',[ids.reader])).rows[0].role).toBe('user');
});

test('expired requests and overdue loans display the correct actions',async({page,context})=>{
  const request=await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await backend.db.query("update public.borrowing_requests set expires_at=now()-interval '1 minute' where id=$1",[request.request_id]);
  await backend.db.query("insert into public.borrowing_records(book_id,user_id,due_date,status) values($1,$2,now()-interval '1 hour','borrowed')",[ids.book,ids.reader]);
  await backend.attach(context); await page.goto('/user/my-borrowings');
  await page.getByRole('button',{name:'历史记录',exact:true}).click(); await expect(page.getByText('已过期',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'取消申请',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'当前借阅',exact:true}).click(); await expect(page.getByText('已逾期',{exact:true})).toBeVisible();
  await expect(page.getByText('逾期 1 天',{exact:true})).toBeVisible();
});

test('admin adds/edits books and deleting the last row on a page returns to a valid page',async({page,context})=>{
  await backend.attach(context,ids.admin); page.on('dialog',dialog=>dialog.accept()); await page.goto('/admin/dashboard');
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'删除',exact:true}).filter({visible:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.getByRole('button',{name:'下一页',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'添加图书',exact:true}).click();
  await page.getByTitle('书名',{exact:true}).fill('新添加测试图书'); await page.getByTitle('作者',{exact:true}).fill('测试作者');
  await page.getByRole('button',{name:'添加',exact:true}).click();
  await expect(page.getByText('图书添加成功！')).toBeVisible();
  const row=page.locator('tbody tr').filter({hasText:'新添加测试图书'});
  await expect(row).toBeVisible(); await row.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByTitle('书名',{exact:true}).fill('编辑后的测试图书');
  await page.getByRole('button',{name:'更新',exact:true}).click();
  await expect(page.getByText('图书更新成功！')).toBeVisible(); await expect(page.locator('tbody tr').filter({hasText:'编辑后的测试图书'})).toBeVisible();
});

test('a slow old search cannot replace newer search results',async({page,context})=>{
  await backend.attach(context); backend.delays['测试图书 2']=500;
  await page.goto('/user/home'); await expect(page.locator('.user-book-card')).toHaveCount(10);
  const input=page.getByPlaceholder('搜索书名或作者...').filter({visible:true});
  const oldResponse=page.waitForResponse(response=>new URL(response.url()).searchParams.get('or')?.includes('测试图书 2'));
  await input.fill('测试图书 2'); await input.press('Enter');
  await expect.poll(()=>backend.calls.some(call=>decodeURIComponent(call.search).includes('测试图书+2')||decodeURIComponent(call.search).includes('测试图书 2'))).toBe(true);
  await input.fill('测试图书 3'); await input.press('Enter');
  await expect(page.locator('.user-book-card')).toHaveCount(1); await expect(page.locator('.user-book-card')).toContainText('测试图书 3');
  await oldResponse; await expect(page.locator('.user-book-card')).toContainText('测试图书 3');
});

test('admin can reject with a reason on a phone without horizontal overflow',async({page,context})=>{
  await backend.attach(context,ids.admin); await backend.rpc(ids.reader,'request_borrow_book',[ids.book,30]);
  await page.setViewportSize({width:390,height:844}); await page.goto('/admin/borrowings');
  await expect(page.getByRole('heading',{name:'借阅申请与记录',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'拒绝申请',exact:true}).click();
  await page.getByLabel('拒绝原因（必填，最多 500 字）').fill('图书修复中');
  await page.getByRole('button',{name:'拒绝申请',exact:true}).last().click();
  await expect(page.getByRole('region',{name:'借阅申请',exact:true}).locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'历史记录',exact:true}).click();
  await expect(page.getByText('处理说明: 图书修复中')).toBeVisible();
  expect((await backend.db.query('select * from public.borrowing_records')).rows).toHaveLength(0);
});

test('admin separates pending requests, outstanding loans and completed history',async({page,context})=>{
  const book=index=>'20000000-0000-4000-8000-'+String(index).padStart(12,'0');
  const loanIds={};
  for(const [index,status,due] of [[2,'borrowed','1 day'],[6,'returned','1 day'],[7,'borrowed','-1 hour'],[8,'lost','-1 day']]) {
    loanIds[index]=(await backend.db.query("insert into public.borrowing_records(book_id,user_id,status,due_date,returned_at) values($1,$2,$3::text,now()+$4::interval,case when $3::text='returned' then now() end) returning id",[book(index),ids.reader,status,due])).rows[0].id;
  }
  for(const [index,status] of [[1,'pending'],[2,'approved'],[3,'cancelled'],[4,'rejected'],[5,'pending'],[6,'approved']]) {
    await backend.db.query("insert into public.borrowing_requests(book_id,user_id,pickup_code,status,expires_at,borrowing_id) values($1,$2,$3,$4,now()+$5::interval,$6)",[book(index),ids.reader,String(12345670+index),status,index===5?'-1 minute':'1 day',loanIds[index]??null]);
  }
  await backend.attach(context,ids.admin); page.on('dialog',dialog=>dialog.accept());
  await page.goto('/admin/borrowings');
  const pending=page.getByRole('region',{name:'借阅申请',exact:true});
  await expect(pending.locator('article')).toHaveCount(1);
  await expect(pending).toContainText('测试图书（第一册）');
  await expect(page.getByRole('combobox')).toHaveCount(0);

  await page.getByRole('button',{name:'当前借阅',exact:true}).click();
  const current=page.getByRole('region',{name:'当前借阅',exact:true});
  await expect(current.locator('article')).toHaveCount(3);
  await expect(page.getByRole('combobox').locator('option')).toHaveText(['全部','借阅中','已逾期','已遗失']);
  for(const [status,title] of [['borrowed','测试图书 2'],['overdue','测试图书 7'],['lost','测试图书 8']]) {
    await page.getByRole('combobox').selectOption(status);
    await expect(current.locator('article')).toHaveCount(1);
    await expect(current).toContainText(title);
  }
  await expect(current.getByRole('button',{name:'确认归还',exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'历史记录',exact:true}).click();
  const history=page.getByRole('region',{name:'历史记录',exact:true});
  await expect(history.locator('article')).toHaveCount(6);
  await expect(page.getByRole('combobox').locator('option')).toHaveText(['全部','已确认借出','已拒绝','已取消','已过期','已归还']);
  await expect(history.getByRole('button')).toHaveCount(0);
  for(const [status,count] of [['approved',2],['rejected',1],['cancelled',1],['expired',1],['returned',1]]) {
    await page.getByRole('combobox').selectOption(status);
    await expect(history.locator('article')).toHaveCount(count);
  }

  await page.getByRole('button',{name:'借阅申请',exact:true}).click();
  await pending.getByRole('button',{name:'确认借出',exact:true}).click();
  await expect(pending.locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'当前借阅',exact:true}).click();
  await expect(current.locator('article')).toHaveCount(4);
  await current.locator('article').filter({hasText:'测试图书（第一册）'}).getByRole('button',{name:'确认归还',exact:true}).click();
  await expect(current.locator('article')).toHaveCount(3);
  await page.getByRole('button',{name:'历史记录',exact:true}).click();
  await page.getByRole('combobox').selectOption('returned');
  await expect(history.locator('article')).toHaveCount(2);
});

test('login errors, signup confirmation and password reset forms behave correctly without sending mail',async({page,context})=>{
  const requests=[];
  await context.route('https://fmilpfmdvpbpomygpxtz.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()); requests.push({path:url.pathname,search:url.search,body:req.postDataJSON()});
    if(url.pathname.endsWith('/token')) return route.fulfill({status:400,json:{code:'email_not_confirmed',msg:'Email not confirmed'}});
    if(url.pathname.endsWith('/signup')) return route.fulfill({status:200,json:{id:ids.reader,email:'new@example.invalid',user_metadata:{name:'注册测试'},identities:[]}});
    return route.fulfill({status:200,json:{}});
  });
  await page.goto('/'); await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
  await page.locator('input[type="email"]').fill('new@example.invalid'); await page.locator('input[type="password"]').fill('test-only-pass');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('邮箱尚未验证，请先打开确认邮件中的链接，再登录。')).toBeVisible();
  await page.getByRole('button',{name:'重新发送确认邮件',exact:true}).click();
  await expect.poll(()=>requests.some(req=>req.path.endsWith('/resend'))).toBe(true);
  await page.getByRole('button',{name:'立即注册',exact:true}).click();
  await page.locator('input[type="text"]').fill('注册测试'); await page.locator('input[type="email"]').fill('new@example.invalid');
  await page.locator('input[type="password"]').nth(0).fill('test-only-pass'); await page.locator('input[type="password"]').nth(1).fill('other-test-pass');
  await page.getByRole('button',{name:'创建账户',exact:true}).click(); await expect.poll(()=>requests.filter(req=>req.path.endsWith('/signup')).length).toBe(0);
  await page.locator('input[type="password"]').nth(1).fill('test-only-pass'); await page.getByRole('button',{name:'创建账户',exact:true}).click();
  await expect.poll(()=>requests.filter(req=>req.path.endsWith('/signup')).length).toBe(1);
  expect(decodeURIComponent(requests.find(req=>req.path.endsWith('/signup')).search)).toContain('redirect_to=http://127.0.0.1:5173/');
  expect(requests.some(req=>req.path.includes('/rest/v1/users'))).toBe(false);
  await page.getByRole('button',{name:'立即登录',exact:true}).click(); await page.getByRole('button',{name:'忘记密码？',exact:true}).click();
  await page.locator('input[type="email"]').fill('new@example.invalid'); await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading',{name:'邮件已发送',exact:true})).toBeVisible();
  expect(decodeURIComponent(requests.find(req=>req.path.endsWith('/recover')).search)).toContain('redirect_to=http://127.0.0.1:5173/reset-password');
  await page.goto('/reset-password'); await expect(page.getByText('无效的密码重置链接，请重新申请')).toBeVisible();
});
