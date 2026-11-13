import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '../docs/screenshots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:1420';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const opts = { type: 'jpeg', quality: 84 };

await page.addInitScript(() => localStorage.removeItem('codeci-settings'));

// 1) Home — Liquid Glass (default)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.rail-card img', { timeout: 45000 }).catch(() => {});
await page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('.rail-card img')];
  return imgs.filter((i) => i.complete && i.naturalWidth > 0).length >= 5;
}, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/hero-liquid-glass.jpg`, ...opts });

// 2) Search — NetEase only (fast, real famous music results)
await page.getByText('Search', { exact: true }).first().click();
await page.getByRole('button', { name: 'NetEase' }).first().click();
await page.locator('input[aria-label="Search music"]').fill('kanye west');
await page.waitForSelector('.track-row .track-title', { timeout: 90000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/search-kanye.jpg`, ...opts });

// 3) Play first result, open Now Playing
await page.locator('.track-row .icon-btn').first().click();
await page.waitForTimeout(900);
await page.locator('.player-bar button.truncate').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/now-playing-liquid.jpg`, ...opts });

// 4) PixelOS Material — home
await page.getByText('Home', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByText('PixelOS Material', { exact: true }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/pixelos-material.jpg`, ...opts });

// 5) Settings — Appearance group
await page.getByText('Settings', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.locator('section.glass').first().scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/settings-themes.jpg`, ...opts });

// 6) Mobile layout (responsive preview, 412×915)
const mobile = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1.5 });
const m = await mobile.newPage();
await m.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await m.waitForTimeout(1500);
await m.screenshot({ path: `${OUT}/mobile-responsive.jpg`, ...opts });

await browser.close();
console.log('screenshots done');
