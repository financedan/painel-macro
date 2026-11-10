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
const manifesto = { gerado_em: new Date().toISOString(), viewport: [1600, 900], dpr: DPR, frames: {} };

// fuso só para a saudação sair "Boa tarde" (as datas do painel usam sempre o fuso de Brasília)
function fusoDaTarde() {
  const off = ((15 - new Date().getUTCHours()) + 36) % 24 - 12;
  return off >= 0 ? 'Etc/GMT-' + off : 'Etc/GMT+' + (-off);
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR, timezoneId: fusoDaTarde() });
  await ctx.addInitScript(() => { try { localStorage.setItem('pm-nome', ''); } catch (e) { /* ok */ } });
  const p = await ctx.newPage();
  const espera = (ms) => p.waitForTimeout(ms);
  // para registrar as animações reais quadro a quadro, elas rodam 10x mais devagar só durante as sequências
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  const lento = (sim) => cdp.send('Animation.setPlaybackRate', { playbackRate: sim ? 0.1 : 1 });
  manifesto.sequencias = {};
  async function sequencia(nome, n, acao, seletores = {}, vista = '') {
    await lento(true);
    await acao();
    const t0 = Date.now();
    manifesto.sequencias[nome] = [];
    for (let i = 0; i < n; i++) {
      const ms = Math.round((Date.now() - t0) / 10);  // tempo real da animação
      await foto(nome + '-' + i, seletores, { vista });
      manifesto.sequencias[nome].push({ frame: nome + '-' + i, ms });
      await espera(900);
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
  async function centralizar(id) {
    await p.evaluate((id) => document.querySelector('article[aria-labelledby="' + id + '"]').scrollIntoView({ block: 'center' }), id);
    await espera(500);
  }
  async function ir(vista) {
    await p.goto(BASE + '#' + vista, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await espera(3200);  // números e cartões terminam de aparecer
  }

  console.log('Visão geral');
  await ir('visao');
  await foto('visao-topo', {
    kpis: 'article[style*="padding: 20px"]', nav: 'nav.pm-topnav a', titulo: '#t-overview',
    explica: '[title^="Mostra uma explicação"]', sino: 'button[aria-controls="pm-alertas"]', copomPill: 'main .pm-pill[style*="cursor: default"]',
  }, { vista: 'visao' });
  await foto('visao-pagina', { cards: 'main article[aria-labelledby]' }, { pagina: true, vista: 'visao' });
  manifesto.contagem = { blocos_visao: await p.$$eval('main article[aria-labelledby]', (a) => a.length) };

  await centralizar('t-bars');
  await foto('visao-barras', { card: artigo('t-bars'), barras: artigo('t-bars') + ' rect.pm-bar', chip: artigo('t-bars') + ' .pm-chip', copom: artigo('t-copom') }, { vista: 'visao' });
  await p.hover(artigo('t-bars') + ' rect.pm-bar >> nth=3');
  await espera(400);
  await foto('visao-barras-2020', { card: artigo('t-bars'), barras: artigo('t-bars') + ' rect.pm-bar', chip: artigo('t-bars') + ' .pm-chip' }, { vista: 'visao' });

  await centralizar('t-infl');
  const inflSel = { card: artigo('t-infl'), segs: artigo('t-infl') + ' .pm-segs button', contador: artigo('t-infl') + ' span[style*="border-radius: 9999px"][style*="color: #161616"]', ultimo: artigo('t-infl') + ' circle', ancoragem: artigo('t-anc') };
  await foto('visao-inflacao', inflSel, { vista: 'visao' });
  await p.click(artigo('t-infl') + ' .pm-segs button >> text=Desde');
  await espera(2400);
  await foto('visao-inflacao-desde', inflSel, { vista: 'visao' });
  await p.click(artigo('t-infl') + ' .pm-segs button >> text=3 anos');

  await centralizar('t-ibov');
  await foto('visao-ibov', { card: artigo('t-ibov'), chip: artigo('t-ibov') + ' .pm-chip', legenda: artigo('t-ibov') + ' p.pm-cap', pregoes: artigo('t-pregoes') }, { vista: 'visao' });

  await centralizar('t-comp');
  const compSel = { card: artigo('t-comp'), segs: artigo('t-comp') + ' .pm-segs button', legenda: artigo('t-comp') + ' p.pm-cap', calc: artigo('t-calc') };
  await foto('visao-comp-reais', compSel, { vista: 'visao' });
  await p.click(artigo('t-comp') + ' .pm-segs button >> text=Descontada');
  await espera(2400);
  await foto('visao-comp-inflacao', compSel, { vista: 'visao' });
  await p.click(artigo('t-comp') + ' .pm-segs button >> text=Em dólar');
  await espera(2400);
  await foto('visao-comp-dolar', compSel, { vista: 'visao' });

  await centralizar('t-medo');
  await foto('visao-medo', { medo: artigo('t-medo'), sim: artigo('t-sim'), mundo: artigo('t-world'), leitura: artigo('t-note'), pill: artigo('t-medo') + ' span[style*="color: #161616"]' }, { vista: 'visao' });

  // modo explicativo
  await p.evaluate(() => window.scrollTo(0, 0));
  await espera(300);
  await p.click('[title^="Mostra uma explicação"]');
  await espera(2600);
  await foto('visao-explicativo', { explica: '.pm-explica', fonte: '.pm-explica .pm-fonte-inline', botao: '[title^="Mostra uma explicação"]' }, { vista: 'visao' });
  await p.click('[title^="Mostra uma explicação"]');
  await espera(300);

  // navegação real: Visão geral -> Expectativas (os cartões sobem ao entrar)
  console.log('Navegação');
  await p.evaluate(() => window.scrollTo(0, 0));
  await espera(300);
  await sequencia('nav-exp', 9, () => p.click('nav.pm-topnav a[href="#expectativas"]'), { nav: 'nav.pm-topnav a' }, 'expectativas');

  console.log('Expectativas');
  await ir('expectativas');
  await foto('exp-topo', { tabela: artigo('t-table'), linhas: artigo('t-table') + ' tbody tr', nav: 'nav.pm-topnav a' }, { vista: 'expectativas' });
  await centralizar('t-moves');
  await foto('exp-mudancas', { card: artigo('t-moves'), itens: artigo('t-moves') + ' .pm-row', traj: artigo('t-traj') }, { vista: 'expectativas' });
  await centralizar('t-hist');
  const histSel = { card: artigo('t-hist'), segs: artigo('t-hist') + ' .pm-segs button', legenda: artigo('t-hist') + ' p.pm-cap', reunioes: artigo('t-reun') };
  await foto('exp-hist-ipca', histSel, { vista: 'expectativas' });
  await sequencia('hist-selic', 8, () => p.click(artigo('t-hist') + ' .pm-segs button >> text=Selic'), histSel, 'expectativas');
  await espera(1600);
  await foto('exp-hist-selic', histSel, { vista: 'expectativas' });
  await p.click(artigo('t-hist') + ' .pm-segs button >> text=2028');
  await espera(2400);
  await foto('exp-hist-selic-2028', histSel, { vista: 'expectativas' });
  await centralizar('t-tes');
  await foto('exp-tesouro', { card: artigo('t-tes') }, { vista: 'expectativas' });

  console.log('Economia');
  await ir('economia');
  await foto('eco-topo', { selic: artigo('t-sl'), ciclo: artigo('t-ciclo') }, { vista: 'economia' });
  await centralizar('t-grp');
  await foto('eco-grupos', { grupos: artigo('t-grp'), nucleos: artigo('t-nuc') }, { vista: 'economia' });
  await centralizar('t-mm');
  await foto('eco-mundo', { mundo: artigo('t-mm') }, { vista: 'economia' });

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
  await centralizar('t-refs');
  await foto('met-referencias', { refs: artigo('t-refs'), glossario: artigo('t-glo') }, { vista: 'metodologia' });

  fs.writeFileSync(path.join(SAIDA, 'manifesto.json'), JSON.stringify(manifesto, null, 1));
  for (const [de, para] of [['dados.json', 'dados-video.json'], ['manual.json', 'manual-video.json']]) {
    fs.copyFileSync(path.join(RAIZ, 'site', de), path.join(RAIZ, 'site', 'apresentacao', para));
  }
  console.log(Object.keys(manifesto.frames).length + ' frames em ' + SAIDA);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
