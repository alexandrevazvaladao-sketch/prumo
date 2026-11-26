// Teste de fumaça do app. Uso: python3 -m http.server 8765 &  node tests/smoke.js
// Cobre: abrir sem erro de script, abrir offline (service worker), diálogos próprios, Visitas -> Método.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if(!c) falhas++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 } }); const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(URL); await p.waitForTimeout(2500);
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.getElementById('dob-gate') && document.getElementById('dob-gate').remove());
  ok(/^v\d{4}\./.test(await p.evaluate(() => document.getElementById('dob-versao').textContent)), 'versão aparece');
  // diálogo próprio (Método > Nova fase)
  await p.evaluate(() => document.getElementById('dob-btn-metodo').click()); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('dob-met-nova-fase').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.getElementById('dob-dlg-in')), 'diálogo próprio abre (sem prompt nativo)');
  await p.click('#dob-dlg-nao'); await p.evaluate(() => document.getElementById('dob-btn-metodo').click());
  // Visitas -> etapa -> Método
  await p.evaluate(() => document.getElementById('dob-btn-visitas').click()); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.dob-vis-chip').click()); await p.waitForTimeout(400);
  await p.selectOption('.dob-vis-obs-add', { index: 2 }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.dob-vis-imp[data-k="boa"]').click());
  const pid = await p.evaluate(() => document.querySelector('.dob-vis-obs-del').dataset.p);
  await p.evaluate(() => document.getElementById('dob-btn-visitas').click());
  await p.evaluate(() => document.getElementById('dob-btn-metodo').click()); await p.waitForTimeout(600);
  await p.evaluate((id) => document.querySelector('.dob-met-det-bt[data-id="' + id + '"]').click(), pid); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('.dob-met-vis')), 'observação da visita aparece no Método');
  // offline
  await ctx.setOffline(true); await p.reload().catch(() => {}); await p.waitForTimeout(1500);
  ok((await p.title()) === 'Gestão de Obra', 'abre sem internet');
  ok(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
  await b.close(); process.exit(falhas ? 1 : 0);
})();
