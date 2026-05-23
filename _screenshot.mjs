import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'screenshot-desktop.png', fullPage: false });

// Mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'screenshot-mobile.png', fullPage: false });

// Tablet
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'screenshot-tablet.png', fullPage: false });

await browser.close();
console.log('Screenshots saved');