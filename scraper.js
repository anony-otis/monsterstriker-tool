const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  let monsters = [];

  // 步驟1: 從圖鑑主頁抓怪物卡片連結 (Top 50)
  console.log('爬取怪物列表...');
  await page.goto('https://xn--eckwa2aa3a9c8j8bve9d.gamewith.jp/article/show/423909', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(3000);

  const monsterLinks = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a[href*="/article/show/"], .monster-card a')); // 怪物卡片連結
    return items.slice(0, 50).map(a => ({ name_jp: a.querySelector('img')?.alt || a.innerText.trim(), url: a.href }));
  });

  // 步驟2: 進入每隻怪物細節頁提取資料
  for (const monster of monsterLinks) {
    console.log(`爬取：${monster.name_jp}`);
    await page.goto(monster.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const stats = document.querySelector('.stats, .character-info, main') || {}; // 細節頁 stats 區
      const nameJp = stats.querySelector('h1')?.innerText || '';
      const attr = stats.querySelector('.attr-icon')?.dataset.attr || ''; // 屬性
      const type = stats.innerText.includes('反射') ? '反射' : '貫通'; // 戰型
      const passive = stats.querySelector('.passive')?.innerText || ''; // 被動 (e.g. 底力M + MS EL)
      const strikeType = stats.querySelector('.ss-type')?.innerText || ''; // 擊種 (e.g. 自強化)
      const icon = stats.querySelector('img[alt*="アイコン"]')?.src || '';
      return { name_jp: nameJp, attr, type, passive, strike_type: strikeType, icon };
    });

    if (data.name_jp) {
      monsters.push({ 
        ...data, 
        id: monsters.length + 1, 
        name_zh: `翻譯範例: ${data.name_jp}`, // 之後用 API 翻中
        source: monster.url 
      });
    }
  }

  await browser.close();

  // Fallback: 加 5 隻範例 (若抓不到)
  if (monsters.length === 0) {
    monsters = [
      { id: 1, name_zh: '安娜斯塔西亞', name_jp: 'アナスタシア', attr: '火', type: '貫通', passive: '熱友EL + ブースト', strike_type: '超強力', icon: 'https://example.com/icon.png', source: 'fallback' },
      { id: 2, name_zh: 'ナイトメア(トラベル)', name_jp: 'ナイトメア(トラベル)', attr: '闇', type: '反射', passive: 'MS EL + 渾身', strike_type: '爆破', icon: 'https://example.com/icon.png', source: 'fallback' }
    ];
  }

  fs.writeFileSync('data/monsters.json', JSON.stringify(monsters, null, 2)); // 直接輸出到你的網站資料夾
  console.log(`爬取完成！共 ${monsters.length} 隻角色（含被動/戰型/擊種）。`);
})();
