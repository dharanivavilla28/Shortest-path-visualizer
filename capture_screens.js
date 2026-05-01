import puppeteer from 'puppeteer';

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log("Navigating to local app...");
  await page.goto('http://localhost:5173/');
  await delay(1000);
  
  console.log("Capturing Simulation Modes...");
  await page.select('#mode-selector', 'uber');
  await delay(500);
  await page.screenshot({ path: 'screenshots/simulation_modes.png' });
  
  console.log("Capturing Confidence Pruning...");
  await page.evaluate(() => {
    document.getElementById('conf-slider').value = 30;
    document.getElementById('conf-slider').dispatchEvent(new Event('input'));
  });
  await delay(500);
  await page.screenshot({ path: 'screenshots/confidence_pruning.png' });
  
  console.log("Capturing K-Value Sensitivity...");
  await page.evaluate(() => {
    document.getElementById('k-slider').value = 500;
    document.getElementById('k-slider').dispatchEvent(new Event('input'));
  });
  await delay(500);
  await page.screenshot({ path: 'screenshots/k_value_sensitivity.png' });

  console.log("Capturing Multi-Path Discovery...");
  await page.select('#dataset-selector', 'india');
  await delay(500);
  // Need to wait for nodes to populate
  await page.select('#source-node', 'DEL');
  await page.select('#target-node', 'JAI');
  await page.click('#btn-run-all');
  await delay(2000);
  await page.screenshot({ path: 'screenshots/multipath_discovery.png' });

  await browser.close();
  console.log("Done!");
})();
