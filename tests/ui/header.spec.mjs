import { test, expect } from '@playwright/test';
import { createBackend, ids } from './support.mjs';

test('long admin names keep the role badge fully visible in every language and theme', async ({ page, context }, testInfo) => {
  const backend = await createBackend();
  try {
    await backend.db.query('update public.users set full_name=$1 where id=$2', [
      'Long administrator display name for header layout', ids.admin,
    ]);
    await backend.attach(context, ids.admin);
    const labels = { zh: '管理员', en: 'Admin', ja: '管理者' };
    const languageLabels = { zh: '中文', en: 'English', ja: '日本語' };
    const darkThemeLabels = { zh: '切换到深色主题', en: 'Switch to dark theme', ja: 'ダークテーマへ切り替え' };
    for (const language of ['zh', 'en', 'ja']) {
      for (const theme of ['light', 'dark']) {
        for (const width of [1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto('/user/dashboard');
          const header = page.locator('header');
          await header.getByRole('button', { name: '切换语言', exact: true }).click();
          await page.getByRole('menuitem', { name: languageLabels[language], exact: true }).click();
          if (theme === 'dark') {
            await header.getByRole('button', { name: darkThemeLabels[language], exact: true }).click();
          }
          await expect(page.locator('.user-theme').first()).toHaveAttribute('data-theme', theme);
          const badge = header.getByText(labels[language], { exact: true });
          await expect(badge).toBeVisible();
          await expect(badge).toBeInViewport({ ratio: 1 });
          await expect(badge).toHaveCSS('white-space', 'nowrap');
          await header.screenshot({ path: testInfo.outputPath(`header-${language}-${theme}-${width}.png`) });
        }
      }
    }
  } finally {
    await context.close();
    await backend.db.close();
  }
});
