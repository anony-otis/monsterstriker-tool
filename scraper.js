// scraper.js - 2025終極大量爬取版：自動翻頁抓 800+ 隻，防 ban + 更新檢查
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const agents = [ // 輪換 UA 防 ban
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ];
  await page.setUserAgent(agents[Math.floor(Math.random() * agents.length)]);
  await page.setViewport({ width: 1920, height: 1080 });

  const allMonsters = [];
  let pageNum = 1;
  let hasNext = true;
  const MAX_PAGES = 50; // 每日定量：50頁 ≈ 500隻，調高抓更多（風險增）

  // 檢查網站更新（抓主頁最後更新日期）
  console.log('檢查網站更新...');
  await page.goto('https://xn--eckwa2aa3a9c8j8bve9d.gamewith.jp/article/show/423909', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const lastUpdate = await page.evaluate(() => getText('.update-date'));
  const oldUpdate = fs.existsSync('last_update.txt') ? fs.readFileSync('last_update.txt', 'utf8') : '';

  if (lastUpdate === oldUpdate) {
    console.log('無更新，結束。');
    await browser.close();
    return;
  }
  fs.writeFileSync('last_update.txt', lastUpdate); // 記錄更新

  console.log('開始爬取全圖鑑...');

  while (hasNext && pageNum <= MAX_PAGES) {
    const url = `https://xn--eckwa2aa3a9c8j8bve9d.gamewith.jp/article/show/423909?page=${pageNum}`;
    console.log(`第 ${pageNum} 頁 → ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000 + Math.random() * 2000); // 隨機延遲 3-5 秒

      hasNext = await page.$('a[rel="next"]') !== null;

      const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/article/show/"]'))
        .filter(a => a.href.includes('article/show/') && a.querySelector('img'))
        .map(a => a.href)
      );

      console.log(`  找到 ${urls.length} 隻`);

      for (let i = 0; i < urls.length; i++) {
        try {
          await page.goto(urls[i], { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(1500 + Math.random() * 1000); // 單隻延遲

          const data = await page.evaluate(() => {
            const get = (text) => {
              const td = Array.from(document.querySelectorAll('td')).find(td => td.innerText.includes(text));
              return td ? td.nextElementSibling?.innerText.trim() : '';
            };
            const getAll = (sel) => Array.from(document.querySelectorAll(sel))
              .map(el => el.innerText.trim()).filter(Boolean);

            return {
              name_jp: document.querySelector('h1')?.innerText.trim() || '',
              icon: document.querySelector('img.character_icon')?.src || '',
              attr: [...document.querySelectorAll('img')].find(i => i.src.includes('attribute'))?.src.match(/attribute_(.+?)\./)?.[1] || '',
              type_of_shot: get('撃種') || '不明',
              passive: getAll('.ability_list a'),
              race: get('種族') || '不明',
              luck_skills: getAll('.luck_skill_list a'),
              source: location.href
            };
          });

          if (data.name_jp) {
            allMonsters.push({
              name_jp: data.name_jp,
              name_zh: "",
              attr: data.attr,
              type_of_shot: data.type_of_shot,
              passive: data.passive.length ? data.passive : ['無'],
              race: data.race,
              luck_skills: data.luck_skills.length ? data.luck_skills : ['無'],
              icon: data.icon,
              source: data.source
            });
          }
        } catch (e) {
          console.log('  單隻失敗');
        }
      }
    } catch (e) {
      console.log(`第 ${pageNum} 頁失敗`);
    }
    pageNum++;
  }

  await browser.close();

  const output = path.join(__dirname, 'data', 'monsters.json');
  fs.writeFileSync(output, JSON.stringify(allMonsters, null, 2));

  console.log(`完成！抓到 ${allMonsters.length} 隻，已覆蓋 data/monsters.json`);
})();
