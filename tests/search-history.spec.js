// VIDAA search & D-pad regressions: one history entry per finished query, the input keeps
// focus while typing, and the navbar stays reachable. The route guard is bypassed in-flight
// so guarded routes render without a Stremio account.
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./helpers');

test.use({ serviceWorkers: 'block' });

async function bootSignedIn(page, hash) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route(/main\.js/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('const t=()=>e.isAuthenticated();', 'const t=()=>!0;');
    await route.fulfill({ response: res, body });
  });
  await bootApp(page, { url: '/' });
  await page.waitForTimeout(2000);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(3000);
}

test('slow remote-like typing saves a single search history entry', async ({ page }) => {
  await bootSignedIn(page, '#/search');
  await page.locator('input[type="text"]').first().click();
  // Remote-like typing (VIDAA keyboard: ~0.4s per letter).
  await page.keyboard.type('matrix', { delay: 400 });
  const focusedDuring = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  await page.waitForTimeout(2500);
  const hist = await page.evaluate(async () => {
    const ctx = await window.core.getState('ctx');
    return ((ctx && ctx.searchHistory) || []).map((h) => h.query || h);
  });
  expect(focusedDuring).toBe('INPUT');
  expect(hist.filter((q) => /^m/.test(q))).toEqual(['matrix']);
});

test('D-pad left from the home rows reaches the navbar', async ({ page }) => {
  await bootSignedIn(page, '#/home');
  await page.waitForFunction(() => !!document.querySelector('[focused="true"]'), null, { timeout: 15000 });
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(500);
  const inNavbar = await page.evaluate(() => {
    const el = document.querySelector('[focused="true"]');
    const area = el && el.closest('[nav-area]');
    return !!(area && /navbar/.test(area.className.toString()));
  });
  expect(inNavbar).toBe(true);
});
