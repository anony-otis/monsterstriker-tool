const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  // 爬怪物 (Gamewith 屬性排行，抓 Top 50 熱門適正怪物)
  console.log('爬怪物...');
  await page.goto('https://xn--eckwa2aa3a9c8j8bve9d.gamewith.jp/article/show/423909', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000);
  const monsters = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div[data-monster], .monster-card')); // 調整 selector 基於實際
    return items.slice(0, 50).map((item, i) => ({
      id: i + 1,
      name_zh: item.querySelector('.name-zh')?.innerText || `怪物${i}`, // 假設有中翻
      name_jp: item.querySelector('h3')?.innerText || `モンスター${i}`,
      attr: item.querySelector('.attr')?.dataset.attr || '火',
      type: item.innerText.includes('反射') ? '反射' : '貫通',
      ss_type: '自強化', // 從細節頁擴充
      max_atk: parseInt(item.querySelector('.atk')?.innerText) || 50000,
      friends_type: '超強力'
    }));
  });

  // 爬關卡 (Altema 降臨スケジュール，抓最新 20 個)
  console.log('爬關卡...');
  await page.goto('https://altema.jp/monsuto/korin', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000);
  const quests = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="korin"], .quest-item'));
    return links.slice(0, 20).map((link, i) => {
      const name = link.innerText.trim();
      const difficulty = name.includes('轟絶') ? '轟' : name.includes('爆絶') ? '爆' : '超';
      const attr = name.includes('火') ? '火' : name.includes('水') ? '水' : '木'; // 簡化推斷
      return {
        id: i + 1,
        name,
        attr,
        difficulty,
        shouha: '將', // 預設，實際從描述
        guardian_id: i + 1,
        apt_types: ['反射', '貫通']
      };
    });
  });

  // 爬守護獸 (Altema 守護獸リスト，抓 Top 10)
  console.log('爬守護獸...');
  await page.goto('https://altema.jp/monsuto/syugoju', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000);
  const guardians = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.guardian-item, a[href*="syugoju"]'));
    return items.slice(0, 10).map((item, i) => ({
      id: i + 1,
      name: item.innerText.trim(),
      effect_desc: '範例效果：SS短縮',
      max_effect: { ss_shorten: 8 }
    }));
  });

  // 輸出 JSON
  fs.writeFileSync('monsters.json', JSON.stringify(monsters, null, 2));
  fs.writeFileSync('quests.json', JSON.stringify(quests, null, 2));
  fs.writeFileSync('guardians.json', JSON.stringify(guardians, null, 2));

  await browser.close();
  console.log('更新完成！');
})();
