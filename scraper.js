// scraper.js —— 2025 終極版（已加入ゲージ聚能被動）
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  const allMonsters = [];
  let pageNum = 1;
  const MAX_PAGES = 60;  // 每天抓 60 頁 ≈ 600 隻，安全又夠多

  while (pageNum <= MAX_PAGES) {
    const url = `https://xn--eckwa2aa3a9c8j8bve9d.gamewith.jp/article/show/423909?page=${pageNum}`;
    console.log(`\n第 ${pageNum}/${MAX_PAGES} 頁 → ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000 + Math.random() * 2000);

      const urls = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a[href^="/article/show/"]'))
          .filter(a => a.href.includes('article/show/') && a.querySelector('img'))
          .map(a => a.href)
      );

      for (const detailUrl of urls) {
        try {
          await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(1800 + Math.random() * 1200);

          const data = await page.evaluate(() => {
            const get = (text) => {
              const td = Array.from(document.querySelectorAll('td')).find(td => td.innerText.includes(text));
              return td ? td.nextElementSibling?.innerText.trim() : '';
            };
            const getAll = (sel) => Array.from(document.querySelectorAll(sel))
              .map(el => el.innerText.trim()).filter(Boolean);

            // 通常アビリティ和ゲージ分開顯示
            const mainPassive = getAll('.ability_list a, .ability');
            const gaugeText = get('ゲージ') || get('ゲージショット') || '';
            const gaugePassive = gaugeText ? [`ゲージ：${gaugeText}`] : [];

            return {
              name_jp: document.querySelector('h1')?.innerText.trim() || '',
              icon: document.querySelector('img.character_icon, img[alt*="アイコン"]')?.src || '',
              attr: [...document.querySelectorAll('img')].find(i => i.src.includes('attribute'))?.src.match(/attribute_(.+?)\./)?.[1] || '',
              type_of_shot: get('撃種') || '不明',
              passive: [...mainPassive, ...gaugePassive],  // 主被動 + 聚能被動一起放
              race: get('種族') || '不明',
              luck_skills: getAll('.luck_skill_list a, .luck_skill'),
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
              icon: data.icon.includes('http') ? data.icon : '',
              source: data.source
            });
          }
        } catch (e) { /* 單隻失敗就跳過 */ }
      }
    } catch (e) {
      console.log(`第 ${pageNum} 頁失敗，停止`);
      break;
    }
    pageNum++;
  }

  await browser.close();

  const output = path.join(__dirname, 'data', 'monsters.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(allMonsters, null, 2));

  console.log(`\n完成！共抓到 ${allMonsters.length} 隻（含ゲージ聚能被動）`);
  console.log(`已自動覆蓋：${output}`);
  console.log(`上傳 data 資料夾到 GitHub 即可使用！`);
})();
