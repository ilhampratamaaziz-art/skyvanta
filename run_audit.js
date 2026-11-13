const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/ADVAN/.gemini/antigravity/brain/8aa833a7-1cc5-4301-b680-894861d3f3f8');

(async () => {
  console.log('🚀 Starting SkyVanta Final Quality Audit...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // 1. Visit Landing Page
  console.log('👉 Testing Landing Page...');
  await page.goto('http://localhost:3000/#landing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_1_landing.png') });

  // 2. Visit Dashboard
  console.log('👉 Testing Dashboard Page...');
  await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_2_dashboard.png') });

  // 3. Visit Forecast 72-Hour (Verifying the new White Liquid Glass Cards!)
  console.log('👉 Testing 72-Hour Forecast & Weekly Cards...');
  await page.goto('http://localhost:3000/#forecast', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_3_forecast_white_cards.png') });

  // 4. Visit Weather Map
  console.log('👉 Testing Weather Map...');
  await page.goto('http://localhost:3000/#map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_4_weather_map.png') });

  // 5. Visit Comparison Page and test live filtering
  console.log('👉 Testing Location Comparison (38 Provinces & live search)...');
  await page.goto('http://localhost:3000/#comparison', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Test search filter input
  const filterInput = await page.$('#compare-search-a');
  if (filterInput) {
    await filterInput.fill('Bali');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_5_compare.png') });

  // 6. Visit Rainfall Map
  console.log('👉 Testing Rainfall Page...');
  await page.goto('http://localhost:3000/#rainfall', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_6_rainfall.png') });

  // 7. Visit Earthquake / TEWS
  console.log('👉 Testing Earthquake / TEWS Page...');
  await page.goto('http://localhost:3000/#earthquake', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_7_gempa.png') });

  // 8. Visit AeroAI Chat
  console.log('👉 Testing AeroAI Page...');
  await page.goto('http://localhost:3000/#ai', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_8_ai.png') });

  // 9. Mobile Viewport Audit (375x812)
  console.log('👉 Testing Mobile Viewport (iPhone X: 375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_9_mobile_dashboard.png') });

  // Test location switch via pill in mobile or desktop
  console.log('👉 Testing Location Change (Surabaya Quick Pill)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle' });
  const surabayaPill = await page.$('button:has-text("Surabaya")');
  if (surabayaPill) {
    await surabayaPill.click();
    await page.waitForTimeout(1500);
  }
  const cityTitle = await page.$eval('#hero-city-title', el => el.textContent);
  console.log('📍 Active City after switch:', cityTitle);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_10_switched_surabaya.png') });

  console.log('\n--- AUDIT SUMMARY ---');
  console.log('Console Errors:', consoleErrors.length === 0 ? '0 (Clean ✅)' : consoleErrors);
  console.log('Page Errors:', pageErrors.length === 0 ? '0 (Clean ✅)' : pageErrors);
  console.log('Switched City Verification:', cityTitle.includes('Surabaya') ? 'SUCCESS ✅' : 'FAILED ❌');

  await browser.close();
  console.log('✅ Audit script completed successfully.');
})();

