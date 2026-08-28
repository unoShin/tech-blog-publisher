/**
 * Universal Headless Chrome Diagram Capturer
 * Captures interactive SVG, CSS diagram cards, and DOM components from any technical blog.
 * 
 * Usage: node capture_diagrams.js <URL> <OUTPUT_DIR>
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const targetUrl = process.argv[2];
  const outDir = process.argv[3] || './';

  if (!targetUrl) {
    console.error('Usage: node capture_diagrams.js <URL> [OUTPUT_DIR]');
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`🌐 Launching Headless Chrome to capture diagrams from: ${targetUrl}`);

  const port = 9222 + Math.floor(Math.random() * 500);
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,10000',
    '--force-device-scale-factor=2',
    targetUrl
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 4500));

  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page') || tabs[0];
    if (!tab) throw new Error('No page tab found in Chrome.');

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');

    await new Promise(r => setTimeout(r, 2500));

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const article = document.querySelector('article') || document.querySelector('main') || document.body;
          const candidates = Array.from(article.querySelectorAll('.rounded-xl, .rounded-lg, .rounded-2xl, [class*="border"], figure, [class*="diagram"], [class*="card"]'));
          
          const filtered = candidates.filter(c => {
            const hasVisual = c.querySelector('svg, canvas, img') || c.className.includes('diagram');
            const rect = c.getBoundingClientRect();
            return hasVisual && rect.width > 250 && rect.height > 80 && rect.height < 2000;
          });

          // Deduplicate to top-level containers
          const topLevel = [];
          for (const f of filtered) {
            if (!topLevel.some(t => t.contains(f))) {
              topLevel.push(f);
            }
          }

          return topLevel.map((el, i) => {
            const rect = el.getBoundingClientRect();
            return {
              index: i + 1,
              className: el.className,
              rect: {
                x: rect.x + window.scrollX,
                y: rect.y + window.scrollY,
                width: rect.width,
                height: rect.height
              }
            };
          });
        })()
      `,
      returnByValue: true
    });

    const diagrams = evalResult.result.value || [];
    console.log(`📸 Detected ${diagrams.length} interactive visual diagram components.`);

    for (const d of diagrams) {
      const fileName = `diagram_fig${d.index}.png`;
      const filePath = path.join(outDir, fileName);
      console.log(`Capturing Figure ${d.index} -> ${filePath}...`);

      const screenshot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: {
          x: d.rect.x,
          y: d.rect.y,
          width: d.rect.width,
          height: d.rect.height,
          scale: 1
        }
      });

      const buf = Buffer.from(screenshot.data, 'base64');
      fs.writeFileSync(filePath, buf);
      console.log(`✅ Saved ${filePath} (${buf.length} bytes)`);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('❌ Capture Error:', err);
  process.exit(1);
});
