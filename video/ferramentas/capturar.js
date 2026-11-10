/*
 * capturar.js — tira os frames reais do painel usados no vídeo e na apresentação interativa.
 *
 * Rodar (com o site servido em http://localhost:8765, ex.: cd site && python -m http.server 8765):
 *   node video/ferramentas/capturar.js
 *
 * Saída: site/apresentacao/frames/*.jpg (3200x1800, tela de 1600x900 com densidade 2)
 *        site/apresentacao/frames/manifesto.json (tamanho de cada frame e a caixa de cada elemento real)
 *        site/apresentacao/dados-video.json e manual-video.json (os dados exatos dos frames)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.PAINEL_URL || 'http://localhost:8765/';
const RAIZ = path.join(__dirname, '..', '..');
const SAIDA = path.join(RAIZ, 'site', 'apresentacao', 'frames');
const DPR = 2;
const NOME = 'Daniel';
const manifesto = { gerado_em: new Date().toISOString(), viewport: [1600, 900], dpr: DPR, frames: {}, sequencias: {} };

// fuso só para a saudação sair "Boa tarde" (as datas do painel usam sempre o fuso de Brasília)
function fusoDaTarde() {
  const off = ((15 - new Date().getUTCHours()) + 36) % 24 - 12;
  return off >= 0 ? 'Etc/GMT-' + off : 'Etc/GMT+' + (-off);
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR, timezoneId: fusoDaTarde() });
  // relógio "lento" para registrar quadro a quadro também o que é animado por JavaScript (números contando)
  await ctx.addInitScript(() => {
    let fator = 1, base = performance.now(), virt = base;
    const agoraReal = performance.now.bind(performance);
    const agora = () => virt + (agoraReal() - base) * fator;
    window.__lento = (f) => { virt = agora(); base = agoraReal(); fator = f; };
    performance.now = agora;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => cb(agora()));
  });
  const p = await ctx.newPage();
  const espera = (ms) => p.waitForTimeout(ms);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  const lento = async (sim) => {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: sim ? 0.1 : 1 });
    await p.evaluate((f) => window.__lento && window.__lento(f), sim ? 0.1 : 1);
  };
  // sequência real: a ação acontece com tudo 10x mais devagar e os quadros registram o tempo real da animação
  async function sequencia(nome, n, acao, seletores = {}, vista = '', passo = 900) {
    await lento(true);
    await acao();
    const t0 = Date.now();
    manifesto.sequencias[nome] = [];
    for (let i = 0; i < n; i++) {
      const ms = Math.round((Date.now() - t0) / 10);
      await foto(nome + '-' + i, seletores, { vista });
      manifesto.sequencias[nome].push({ frame: nome + '-' + i, ms });
      await espera(passo);
    }
    await lento(false);
    await espera(400);
  }

  // caixas (em pixels do frame) de cada seletor, só o que aparece na tela
  async function caixas(seletores, pagina) {
    return p.evaluate(({ seletores, pagina, dpr }) => {
      const r = {};
      for (const [nome, sel] of Object.entries(seletores)) {
        r[nome] = [...document.querySelectorAll(sel)].map((el) => {
          const b = el.getBoundingClientRect();
          const dx = pagina ? window.scrollX : 0, dy = pagina ? window.scrollY : 0;
          return [b.x + dx, b.y + dy, b.width, b.height].map((v) => Math.round(v * dpr));
        }).filter((c) => c[2] > 0 && c[3] > 0 && (pagina || (c[1] + c[3] > 0 && c[1] < 900 * dpr)));
      }
      return r;
    }, { seletores, pagina: !!pagina, dpr: DPR });
  }

  async function foto(nome, seletores = {}, opc = {}) {
    const arq = path.join(SAIDA, nome + '.jpg');
    await p.screenshot({ path: arq, type: 'jpeg', quality: 88, fullPage: !!opc.pagina });
    const dim = await p.evaluate((pg) => (pg ? [document.documentElement.scrollWidth, document.documentElement.scrollHeight] : [innerWidth, innerHeight]), !!opc.pagina);
    manifesto.frames[nome] = { arquivo: nome + '.jpg', w: dim[0] * DPR, h: dim[1] * DPR, caixas: await caixas(seletores, opc.pagina), vista: opc.vista || '' };
    console.log('  ' + nome);
  }

  const artigo = (id) => 'article[aria-labelledby="' + id + '"]';
  async function centralizar(sel, ms = 3400) {
    await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel);
    await espera(ms);  // o bloco entra e os gráficos terminam de se desenhar
  }
  // passa pela página toda para os blocos que entram ao rolar já estarem visíveis
  async function revelarTudo() {
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 450) { await p.evaluate((y) => window.scrollTo(0, y), y); await espera(250); }
    await espera(2600);
    await p.evaluate(() => window.scrollTo(0, 0));
    await espera(600);
  }
  async function ir(vista) {
    await p.goto(BASE + '#' + vista, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await espera(4200);  // números contam e os gráficos terminam de crescer
  }

  // ---------- primeiro contato: a saudação
  console.log('Saudação');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await espera(2200);
  const sSel = { card: '.pm-welcome-card', campo: '#pm-nome', entrar: 'button:has-text("Entrar no painel")', previa: '.pm-welcome-card [aria-live]' };
  const sSelCss = { card: '.pm-welcome-card', campo: '#pm-nome', entrar: '.pm-welcome-card button.pm-cta', previa: '.pm-welcome-card [aria-live]' };
  await foto('boasvindas', sSelCss, { vista: 'visao' });
  for (let i = 1; i <= NOME.length; i++) {
    await p.fill('#pm-nome', NOME.slice(0, i));
    await espera(120);
    if (i === 3) await foto('boasvindas-dig', sSelCss, { vista: 'visao' });
  }
  await espera(300);
  await foto('boasvindas-nome', sSelCss, { vista: 'visao' });
  // abertura real: o painel aparece e os números contam, as barras crescem (10x mais devagar só na captura)
  console.log('Abertura');
  await sequencia('abertura', 14, () => p.click(sSel.entrar), { kpis: 'main article[style*="padding: 20px"]', nav: 'nav.pm-topnav a', titulo: '#t-overview' }, 'visao', 1700);
  await espera(4000);

  console.log('Visão geral');
  await ir('visao');
  await foto('visao-topo', {
    kpis: 'main article[style*="padding: 20px"]', nav: 'nav.pm-topnav a', titulo: '#t-overview',
    sino: 'button[aria-controls="pm-alertas"]', copomPill: 'main .pm-pill[style*="cursor: default"]', ajuda: artigo('t-bars') + ' .pm-help',
  }, { vista: 'visao' });
  await revelarTudo();
  await foto('visao-pagina', { cards: 'main article' }, { pagina: true, vista: 'visao' });
  manifesto.contagem = { blocos_visao: await p.$$eval('main article', (a) => a.length) };

  await centralizar(artigo('t-bars'));
  await foto('visao-barras', { card: artigo('t-bars'), barras: artigo('t-bars') + ' rect.pm-bar', chip: artigo('t-bars') + ' .pm-chip', copom: artigo('t-copom'), ajuda: artigo('t-bars') + ' .pm-help' }, { vista: 'visao' });
  await p.hover(artigo('t-bars') + ' rect.pm-bar >> nth=3');
  await espera(400);
  await foto('visao-barras-2020', { card: artigo('t-bars'), barras: artigo('t-bars') + ' rect.pm-bar', chip: artigo('t-bars') + ' .pm-chip' }, { vista: 'visao' });
  // o "?" de um bloco abre a explicação dele
  await p.mouse.move(10, 10);
  await p.click(artigo('t-bars') + ' .pm-help');
  await espera(1200);
  await foto('visao-ajuda', { card: artigo('t-bars'), explica: artigo('t-bars') + ' .pm-explica', ajuda: artigo('t-bars') + ' .pm-help' }, { vista: 'visao' });
  await p.click(artigo('t-bars') + ' .pm-help');
  await espera(400);

  await centralizar(artigo('t-infl'));
  const inflSel = { card: artigo('t-infl'), segs: artigo('t-infl') + ' .pm-segs button', contador: artigo('t-infl') + ' span[style*="border-radius: 9999px"][style*="color: #161616"]', ultimo: artigo('t-infl') + ' circle', ancoragem: artigo('t-anc') };
  await foto('visao-inflacao', inflSel, { vista: 'visao' });
  await p.click(artigo('t-infl') + ' .pm-segs button >> text=Desde');
  await espera(3200);
  await foto('visao-inflacao-desde', inflSel, { vista: 'visao' });
  await p.click(artigo('t-infl') + ' .pm-segs button >> text=3 anos');

  await centralizar(artigo('t-ibov'));
  await foto('visao-ibov', { card: artigo('t-ibov'), chip: artigo('t-ibov') + ' .pm-chip', legenda: artigo('t-ibov') + ' p.pm-cap', pregoes: artigo('t-pregoes') }, { vista: 'visao' });

  await centralizar('main article.pm-lift');
  await foto('visao-economia', { cards: 'main article.pm-lift', titulo: 'main section > .pm-cab' }, { vista: 'visao' });

  await centralizar(artigo('t-medo'));
  await foto('visao-medo', { medo: artigo('t-medo'), sim: artigo('t-sim'), mundo: artigo('t-world'), leitura: artigo('t-note'), pill: artigo('t-medo') + ' span[style*="color: #161616"]' }, { vista: 'visao' });

  // simulador: e se a Selic mudar? (o controle é arrastado de verdade, por evento de entrada)
  const simSel = { card: artigo('t-sim'), selic: '#pm-sim-selic', resultado: artigo('t-sim') + ' span[style*="font-size: 32px"]' };
  const polegar = async (v) => p.evaluate(({ v, dpr }) => {
    const r = document.getElementById('pm-sim-selic'); const b = r.getBoundingClientRect();
    const f = (v - Number(r.min)) / (Number(r.max) - Number(r.min));
    return [Math.round((b.x + 8 + f * (b.width - 16) - 8) * dpr), Math.round((b.y + b.height / 2 - 8) * dpr), 16 * dpr, 16 * dpr];
  }, { v, dpr: DPR });
  const mover = (v) => p.evaluate((v) => { const r = document.getElementById('pm-sim-selic'); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  for (const [nome, v] of [['sim-a', null], ['sim-b', 10], ['sim-c', 7]]) {
    if (v != null) { await mover(v); await espera(900); }
    const valor = v ?? Number(await p.$eval('#pm-sim-selic', (r) => r.value));
    await foto(nome, simSel, { vista: 'visao' });
    manifesto.frames[nome].caixas.polegar = [await polegar(valor)];
  }
  await p.click(artigo('t-sim') + ' button:has-text("Dados atuais")');
  await espera(400);

  // navegação real: Visão geral -> Expectativas (os cartões sobem ao entrar)
  console.log('Navegação');
  await p.evaluate(() => window.scrollTo(0, 0));
  await espera(400);
  await sequencia('nav-exp', 9, () => p.click('nav.pm-topnav a[href="#expectativas"]'), { nav: 'nav.pm-topnav a' }, 'expectativas');

  console.log('Expectativas');
  await ir('expectativas');
  await foto('exp-topo', { tabela: artigo('t-table'), linhas: artigo('t-table') + ' tbody tr', nav: 'nav.pm-topnav a' }, { vista: 'expectativas' });
  await centralizar(artigo('t-moves'));
  await foto('exp-mudancas', { card: artigo('t-moves'), itens: artigo('t-moves') + ' .pm-row', traj: artigo('t-traj') }, { vista: 'expectativas' });
  await centralizar(artigo('t-hist'));
  const histSel = { card: artigo('t-hist'), segs: artigo('t-hist') + ' .pm-segs button', legenda: artigo('t-hist') + ' p.pm-cap', reunioes: artigo('t-reun') };
  await foto('exp-hist-ipca', histSel, { vista: 'expectativas' });
  await sequencia('hist-selic', 8, () => p.click(artigo('t-hist') + ' .pm-segs button >> text=Selic'), histSel, 'expectativas');
  await espera(2600);
  await foto('exp-hist-selic', histSel, { vista: 'expectativas' });
  await p.click(artigo('t-hist') + ' .pm-segs button >> text=2028');
  await espera(3200);
  await foto('exp-hist-selic-2028', histSel, { vista: 'expectativas' });
  await centralizar(artigo('t-tes'));
  await foto('exp-tesouro', { card: artigo('t-tes') }, { vista: 'expectativas' });
  await centralizar(artigo('t-sl'));
  await foto('exp-contexto', { selic: artigo('t-sl'), ciclo: artigo('t-ciclo') }, { vista: 'expectativas' });
  await centralizar(artigo('t-grp'));
  await foto('exp-grupos', { grupos: artigo('t-grp'), nucleos: artigo('t-nuc') }, { vista: 'expectativas' });

  console.log('Agenda');
  await ir('agenda');
  const agSel = { calendario: artigo('t-cal'), dia: artigo('t-dayinfo'), proximo: 'button[aria-label="Próximo mês"]', ics: 'main .pm-pill:has(svg path[d^="M12 4v12"])' };
  await foto('agenda', agSel, { vista: 'agenda' });
  await p.click('button[aria-label="Próximo mês"]');
  await espera(500);
  await foto('agenda-dez', agSel, { vista: 'agenda' });

  console.log('Metodologia');
  await ir('metodologia');
  await foto('met-topo', { fontes: artigo('t-src'), linhas: artigo('t-src') + ' tbody tr' }, { vista: 'metodologia' });
  await centralizar(artigo('t-refs'));
  await foto('met-referencias', { refs: artigo('t-refs'), glossario: artigo('t-glo') }, { vista: 'metodologia' });

  fs.writeFileSync(path.join(SAIDA, 'manifesto.json'), JSON.stringify(manifesto, null, 1));
  for (const [de, para] of [['dados.json', 'dados-video.json'], ['manual.json', 'manual-video.json']]) {
    fs.copyFileSync(path.join(RAIZ, 'site', de), path.join(RAIZ, 'site', 'apresentacao', para));
  }
  console.log(Object.keys(manifesto.frames).length + ' frames em ' + SAIDA);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
