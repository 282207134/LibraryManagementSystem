// Run from the repository root while npm run dev serves port 5173.
// All account and book changes below affect the temporary test database only.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createBackend, ids } from '../tests/ui/support.mjs';

const output = 'docs/screenshots';
const baseURL = 'http://127.0.0.1:5173';
const backend = await createBackend();
const browser = await chromium.launch({ channel: 'chrome' });
await mkdir(output, { recursive: true });
try {
  const titles = [
    ['思考，快与慢', '丹尼尔·卡尼曼', '心理学', '#324f52'],
    ['人类简史', '尤瓦尔·赫拉利', '历史', '#9b5c3c'],
    ['小王子', '圣埃克苏佩里', '文学', '#395574'],
    ['活着', '余华', '文学', '#963f37'],
    ['银河铁道之夜', '宫泽贤治', '文学', '#41456a'],
    ['时间简史', '史蒂芬·霍金', '科普', '#273c55'],
    ['围城', '钱锺书', '文学', '#7b6045'],
    ['局外人', '阿尔贝·加缪', '文学', '#59684c'],
    ['乡土中国', '费孝通', '社会学', '#8a6e4b'],
    ['设计心理学', '唐纳德·诺曼', '设计', '#475f65'],
    ['瓦尔登湖', '亨利·戴维·梭罗', '文学', '#3e6359'],
  ];
  const books = (await backend.db.query('select id from public.books order by id')).rows;
  await backend.db.query('update public.users set full_name=$1 where id=$2', ['演示读者', ids.reader]);
  await backend.db.query('update public.users set full_name=$1 where id=$2', ['演示管理员', ids.admin]);
  for (const [i, [title, author, category, color]] of titles.entries()) {
    // Original, plain typographic demo covers; these are not publisher artwork.
    const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="500" viewBox="0 0 360 500"><rect width="360" height="500" fill="${color}"/><path d="M28 0v500M42 36h276v428H42" fill="none" stroke="#fff" stroke-opacity=".2"/><text x="62" y="85" fill="#fff" opacity=".65" font-size="13" font-family="sans-serif" letter-spacing="3">LIBRARY · READING</text><text x="62" y="200" fill="#fff" font-size="${title.length > 6 ? 28 : 34}" font-family="sans-serif">${title}</text><path d="M62 235h64" stroke="#e8d4ab" stroke-width="3"/><text x="62" y="280" fill="#f2e8d7" font-size="18" font-family="sans-serif">${author}</text><text x="62" y="420" fill="#fff" opacity=".6" font-size="14" font-family="sans-serif">${category} / 演示封面</text></svg>`;
    await backend.db.query('update public.books set title=$1,author=$2,category=$3,cover_image_url=$4,description=$5,publisher=$6,publication_year=2024,quantity=5,available_quantity=5 where id=$7',
      [title, author, category, 'data:image/svg+xml;base64,' + Buffer.from(cover).toString('base64'), `《${title}》图书详情演示。可查看馆藏、收藏图书和提交借阅申请；到馆后由管理员核对凭证并确认借出。`, '演示出版社', books[i].id]);
    await backend.db.query('insert into public.reviews(user_id,book_id,rating,comment) values($1,$2,5,$3)', [ids.reader, books[i].id, '值得慢慢阅读，也欢迎分享你的阅读感受。']);
  }
  for (const book of books.slice(0, 3)) await backend.db.query('insert into public.book_favorites(user_id,book_id) values($1,$2)', [ids.reader, book.id]);
  const pending = await backend.rpc(ids.reader, 'request_borrow_book', [books[0].id, 30]);
  const current = await backend.rpc(ids.reader, 'request_borrow_book', [books[1].id, 30]);
  await backend.rpc(ids.admin, 'approve_borrow_request', [current.pickup_code]);
  const returned = await backend.rpc(ids.reader, 'request_borrow_book', [books[2].id, 30]);
  await backend.rpc(ids.admin, 'approve_borrow_request', [returned.pickup_code]);
  const loan = (await backend.db.query('select borrowing_id from public.borrowing_requests where id=$1', [returned.request_id])).rows[0];
  await backend.rpc(ids.admin, 'return_book', [loan.borrowing_id]);

  const readerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await backend.attach(readerContext, ids.reader);
  const reader = await readerContext.newPage();
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await backend.attach(adminContext, ids.admin);
  const admin = await adminContext.newPage();
  const guest = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // Prevent anonymous production requests in the unauthenticated login preview.
  await guest.route('https://*.supabase.co/**', route => route.fulfill({ json: {} }));
  async function visit(page, path) {
    await page.goto(baseURL + path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  async function capture(page, name) {
    await page.evaluate(async () => {
      await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    });
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: name !== '10-book-editor', animations: 'disabled' });
    console.log(`Captured ${name}`);
  }
  await visit(guest, '/'); await capture(guest, '01-login');
  await visit(reader, '/user/dashboard'); await capture(reader, '02-reader-dashboard');
  await visit(reader, '/user/home'); await capture(reader, '03-book-catalog');
  await visit(reader, '/user/books/' + books[3].id); await capture(reader, '04-book-detail');
  await visit(reader, '/user/my-borrowings'); await expect(reader.getByTestId('pickup-code')).toHaveText(pending.pickup_code); await capture(reader, '05-borrowing-pass');
  await reader.getByRole('button', { name: '当前借阅', exact: true }).click(); await capture(reader, '06-current-loans');
  await visit(reader, '/user/my-favorites'); await capture(reader, '07-favorites');
  await visit(reader, '/user/profile'); await capture(reader, '08-profile');
  await visit(admin, '/admin/dashboard'); await capture(admin, '09-book-management');
  await admin.getByRole('button', { name: '添加图书', exact: true }).click(); await capture(admin, '10-book-editor');
  await visit(admin, '/admin/borrowings'); await capture(admin, '11-pass-lookup');
  await admin.getByLabel('输入 8 位数字码').fill(pending.pickup_code);
  await admin.getByLabel('输入 8 位数字码').press('Enter');
  await expect(admin.getByTestId('lookup-result')).toContainText('思考，快与慢'); await capture(admin, '12-admin-checkout');
  await reader.setViewportSize({ width: 390, height: 844 });
  await visit(reader, '/user/my-borrowings'); await capture(reader, '13-mobile-pass');
  await admin.setViewportSize({ width: 390, height: 844 });
  await visit(admin, '/admin/borrowings'); await capture(admin, '14-mobile-admin');
  await reader.setViewportSize({ width: 1440, height: 1000 });
  await visit(reader, '/user/home');
  await reader.locator('header').getByRole('button', { name: '切换语言', exact: true }).click();
  await reader.getByRole('menuitem', { name: '日本語', exact: true }).click();
  await reader.getByRole('button', { name: 'ダークテーマへ切り替え', exact: true }).click();
  await capture(reader, '15-japanese-dark');
} finally {
  await browser.close();
  await backend.db.close();
}
