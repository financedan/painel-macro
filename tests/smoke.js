/*
 * tests/smoke.js — abre o painel num navegador de verdade e confere o que a pessoa usa.
 * Rodar:  node tests/smoke.js            (precisa de: npm install playwright && npx playwright install chromium)
 * Sai com código 1 se alguma verificação falhar.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const RAIZ = path.join(__dirname, '..', 'site');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml' };

function servidor(ajustes = {}) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const nome = url === '/' ? '/index.html' : url;
      if (ajustes[nome]) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(ajustes[nome]); return; }
      const arq = path.join(RAIZ, nome);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
    });
    s.listen(0, () => ok(s));
  });
}

const falhas = [];
const checar = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALHOU ') + msg); if (!cond) falhas.push(msg); };

(async () => {
  const srv = await servidor();
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const erros = [];
  const espera = (p) => p.waitForTimeout(200);  // o painel redesenha no próximo quadro
  // visitante que já passou pela saudação (a primeira visita é testada à parte)
  const nova = async (opc = {}, primeiraVisita = false) => {
    const ctx = await b.newContext({ timezoneId: 'America/Sao_Paulo', acceptDownloads: true, viewport: { width: 1440, height: 900 }, ...opc });
    if (!primeiraVisita) await ctx.addInitScript(() => { if (localStorage.getItem('pm-nome') === null) localStorage.setItem('pm-nome', ''); });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    return { ctx, p };
  };

  console.log('Primeira visita');
  let { ctx, p } = await nova({}, true);
  await p.goto(base + '#metodologia', { waitUntil: 'networkidle' });
  await p.waitForSelector('#t-welcome');
  checar(await p.isVisible('#t-welcome') && !(await p.$('#t-overview')) && !(await p.$('#t-met')), 'primeira visita abre na saudação, antes do painel');
  checar(await p.evaluate(() => document.activeElement && document.activeElement.id === 'pm-nome'), 'campo do nome já vem selecionado');
  await p.fill('#pm-nome', 'Bia');
  await p.click('button:has-text("Entrar no painel")'); await p.waitForSelector('#t-met');
  checar(await p.isVisible('#t-met'), 'depois da saudação abre a aba do link (#metodologia)');
  await p.click('nav.pm-topnav a[href="#visao"]'); await p.waitForSelector('#t-overview');
  checar((await p.textContent('#t-overview')).includes('Bia'), 'saudação usa o nome digitado');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForSelector('#t-overview');
  checar(!(await p.$('#t-welcome')), 'na volta não pergunta o nome de novo');
  await ctx.close();
  ({ ctx, p } = await nova({}, true));
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForSelector('#t-welcome');
  await p.click('button:has-text("Continuar sem nome")'); await p.waitForSelector('#t-overview');
  checar(await p.isVisible('#t-overview'), '"Continuar sem nome" entra no painel');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForSelector('#t-overview');
  checar(!(await p.$('#t-welcome')), 'quem pulou não vê a pergunta de novo');
  await ctx.close();

  console.log('Desktop');
  ({ ctx, p } = await nova());
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.waitForSelector('#t-overview');
  checar(await p.isVisible('#t-overview'), 'visitante que já passou pela saudação abre direto no painel');
  checar((await p.$$('article.pm-glass')).length >= 14, 'visão geral tem os blocos principais');
  checar(await p.isVisible('nav.pm-topnav') && await p.isVisible('nav.pm-dock'), 'no computador: abas no topo e barra lateral (layout original)');
  checar((await p.$$('nav.pm-topnav a')).length === 4, 'quatro abas: Visão geral, Expectativas, Agenda e Metodologia');
  checar(!(await p.$('#t-comp')) && !(await p.$('#t-calc')), 'visão geral sem os blocos que foram para outras abas');

  // alertas: abre, fecha com Esc e com clique fora; selo some depois de visto
  await p.click('button[aria-label^="Alertas"][aria-controls]'); await espera(p);
  checar(await p.isVisible('#pm-alertas'), 'sino abre os alertas');
  checar((await p.getAttribute('button[aria-controls="pm-alertas"]', 'aria-expanded')) === 'true', 'aria-expanded="true" com os alertas abertos');
  await p.keyboard.press('Escape'); await espera(p);
  checar(!(await p.isVisible('#pm-alertas')), 'Esc fecha os alertas');
  checar((await p.getAttribute('button[aria-controls="pm-alertas"]', 'aria-expanded')) === 'false', 'aria-expanded="false" com os alertas fechados');
  await p.click('button[aria-controls="pm-alertas"]'); await espera(p);
  await p.mouse.click(700, 700); await espera(p);
  checar(!(await p.isVisible('#pm-alertas')), 'clique fora fecha os alertas');
  checar((await p.$$('button[aria-controls="pm-alertas"] span')).length === 0, 'selo de alertas some depois de vistos');

  // modo explicativo
  checar(!(await p.$('button[aria-pressed]:has-text("Modo explicativo")')), 'sem botão Modo explicativo no topo');
  await p.click('.pm-help >> nth=0'); await espera(p);
  checar((await p.$$('.pm-explica')).length === 1, 'o ? de um bloco mostra só a explicação dele');
  await p.click('.pm-help >> nth=0'); await espera(p);

  // nome: definir, cancelar, remover
  await p.click('.pm-avatar');
  await p.fill('#pm-nome', 'Ana Souza');
  await p.click('text=Salvar e voltar ao painel');
  checar((await p.textContent('#t-overview')).includes('Ana Souza'), 'saudação usa o nome salvo');
  checar((await p.textContent('.pm-avatar')).trim() === 'AS', 'avatar mostra as iniciais');
  await p.click('.pm-avatar');
  await p.fill('#pm-nome', 'Outro');
  await p.click('text=Cancelar');
  checar((await p.textContent('#t-overview')).includes('Ana Souza'), 'Cancelar não muda o nome');

  // números e textos coerentes
  const corpo = await p.textContent('main');
  checar(!/NaN|undefined|null/.test(corpo), 'nenhum NaN/undefined/null na visão geral');
  checar(/último corte em 16\/09/.test(corpo), 'data do último corte da Selic é 16/09 (corrigida)');

  // calculadora (fica na Metodologia)
  await p.click('nav.pm-topnav a[href="#metodologia"]'); await espera(p);
  await p.fill('#pm-calc-valor', '5000'); await espera(p);
  checar((await p.textContent('#t-calc >> xpath=ancestor::article')).includes('R$ 5.'), 'calculadora recalcula com o valor digitado');
  await p.click('nav.pm-topnav a[href="#visao"]'); await espera(p);

  // navegação por endereço e botão Voltar
  // fontes ficam na Metodologia e no rodapé, não dentro dos blocos
  checar((await p.$$('main article .pm-fonte')).length === 0, 'blocos sem linha de fonte (fontes na Metodologia e no rodapé)');
  checar(/Metodologia/.test(await p.textContent('footer')), 'rodapé aponta a Metodologia para as fontes');
  for (const v of ['expectativas', 'agenda', 'metodologia']) {
    await p.click('nav.pm-topnav a[href="#' + v + '"]');
    await p.waitForTimeout(300);
    checar(p.url().endsWith('#' + v), 'endereço muda para #' + v);
    const txt = await p.textContent('main');
    checar(!/NaN|undefined|null/.test(txt), 'nenhum NaN/undefined/null em #' + v);
  }
  await p.click('nav.pm-topnav a[href="#expectativas"]'); await espera(p);
  checar(!!(await p.$('#t-sl')) && !!(await p.$('#t-grp')) && !!(await p.$('#t-mm')), 'conteúdo da antiga aba Economia está em Expectativas');
  await p.click('nav.pm-topnav a[href="#metodologia"]'); await espera(p);
  checar(!!(await p.$('#t-comp')) && !!(await p.$('#t-calc')), 'bolsa x CDI e calculadora estão na Metodologia');
  checar((await p.$$('article[aria-labelledby="t-refs"] a[href^="http"]')).length >= 20, 'Metodologia lista todas as fontes com link');
  await p.goto(base + '#economia'); await espera(p);
  checar(await p.isVisible('#t-focus'), 'link antigo #economia abre Expectativas');
  checar(!/yahoo|yfinance/i.test(await p.content()), 'nenhuma referência ao Yahoo no site');
  await p.click('nav.pm-topnav a[href="#agenda"]'); await espera(p);
  await p.click('nav.pm-topnav a[href="#metodologia"]'); await espera(p);
  await p.goBack(); await p.waitForTimeout(300);
  checar(await p.isVisible('#t-agenda'), 'Voltar do navegador volta para a aba anterior');

  // agenda: navegar meses e baixar .ics
  await p.click('button[aria-label="Próximo mês"]'); await espera(p);
  checar(await p.isVisible('text=Hoje'), 'agenda navega para o próximo mês');
  const [ics] = await Promise.all([p.waitForEvent('download'), p.click('text=Adicionar à minha agenda')]);
  checar(ics.suggestedFilename().endsWith('.ics'), 'agenda exporta .ics');

  // metodologia: CSV
  await p.goto(base + '#metodologia'); await p.waitForSelector('#t-met');
  const [csv] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Focus da semana")')]);
  checar(csv.suggestedFilename().endsWith('.csv'), 'metodologia baixa CSV');

  // perguntas: resposta aparece e fica salva
  await p.goto(base + '#expectativas'); await p.waitForSelector('#t-q');
  await p.check('.pm-check >> nth=0'); await espera(p);
  checar(await p.isVisible('text=Resposta do painel'), 'marcar pergunta mostra a resposta do painel');
  await p.reload(); await p.waitForSelector('#t-q');
  checar(await p.isChecked('.pm-check >> nth=0'), 'marcação da pergunta fica salva');
  await ctx.close();

  console.log('Novidades desde a última visita');
  ({ ctx, p } = await nova());
  await p.addInitScript(() => {
    if (!sessionStorage.getItem('feito')) {
      localStorage.setItem('pm-visita', JSON.stringify({ atual: { atualizado: '2000-01-01T10:00-03:00', selic: 14, ipca: 4.2, ipcaMes: '2026-08', coleta: '2026-10-23', focusIpca: 5.19, focusAno: 2026, ibov: 160000, ibovData: '2026-11-01', visto: '2026-11-02' }, anterior: null }));
      sessionStorage.setItem('feito', '1');
    }
  });
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.click('button[aria-controls="pm-alertas"]'); await espera(p);
  checar(await p.isVisible('text=Desde a sua visita'), 'alertas mostram as novidades desde a visita anterior');
  await ctx.close();

  console.log('Celular');
  ({ ctx, p } = await nova({ ...devices['iPhone 13'] }));
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.waitForSelector('#t-overview');
  checar(await p.isVisible('nav.pm-dock') && !(await p.isVisible('nav.pm-topnav')), 'no celular há só a barra do rodapé');
  const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  checar(sw <= iw, 'sem rolagem horizontal no celular');
  await ctx.close();

  console.log('Menos movimento');
  ({ ctx, p } = await nova({ reducedMotion: 'reduce' }));
  await p.goto(base); await p.waitForSelector('#t-overview');
  const kpi = await p.textContent('article.pm-glass div[style*="font-size: 34px"]');
  checar(kpi.trim() === (await p.evaluate(() => PM.pct(painel.D.selic.valor))), 'números aparecem prontos, sem contagem animada');
  await ctx.close();

  console.log('Fonte faltando');
  srv.close();
  const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados.json'), 'utf8'));
  delete dados.tesouro; delete dados.comparacao; delete dados.economia;
  dados.fontes = Object.assign({}, dados.fontes, { tesouro: { ok: false, atualizado_em: '2026-11-01T19:00-03:00', erro: 'teste' } });
  const srv2 = await servidor({ '/dados.json': JSON.stringify(dados) });
  ({ ctx, p } = await nova());
  await p.goto('http://localhost:' + srv2.address().port + '/', { waitUntil: 'networkidle' });
  checar(await p.isVisible('#t-overview'), 'painel abre mesmo sem algumas fontes');
  await p.goto('http://localhost:' + srv2.address().port + '/#metodologia'); await p.waitForSelector('#t-met');
  checar(!(await p.isVisible('#t-comp')) && await p.isVisible('#t-src'), 'bloco sem dados some, sem quebrar o resto');
  await p.goto('http://localhost:' + srv2.address().port + '/'); await p.waitForSelector('#t-overview');
  checar(await p.isVisible('text=Não foi possível atualizar na última coleta'), 'avisa a fonte que falhou');
  await ctx.close();
  srv2.close();

  const inesperados = erros.filter((e) => !/não pôde ser montado/.test(e));
  checar(inesperados.length === 0, 'nenhum erro de JavaScript' + (inesperados.length ? ': ' + inesperados.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(falhas.length ? '\n' + falhas.length + ' verificação(ões) falharam.' : '\nTudo certo.');
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
