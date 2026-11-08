/*
 * apresentacao.js — motor e roteiro da apresentação do Painel Macro Brasil.
 *
 * Tudo é função do tempo t (segundos): render(t) desenha o quadro exato daquele instante.
 * Assim a mesma página serve para:
 *   - assistir no navegador (versão interativa, com capítulos, atalhos e controles);
 *   - gerar o vídeo quadro a quadro (?render=1, usado por video/ferramentas/renderizar.js).
 *
 * Os frames são capturas reais do painel (frames/*.jpg, com a posição de cada elemento em
 * frames/manifesto.json). Os números escritos na tela vêm de dados-video.json e manual-video.json,
 * os mesmos dados que o painel mostrava na hora da captura.
 */
(function () {
  const P = window.PM;
  const W = 1920, H = 1080, DUR = 85;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.documentElement.classList.add('render'), document.body.classList.add('render');
  const CAPITULOS = [[0, 'Introdução'], [10, 'O painel'], [25, 'Indicadores'], [50, 'Interatividade'], [70, 'Encerramento']];
  const COR = { azul: '#8fb0ff', ambar: '#f0b37a', osso: '#ededed', cinza: '#c2c2c2' };
  const ICONE = 'M3 17h18M6 17a6 6 0 0 1 12 0M12 5v2M5.6 7.6l1.4 1.4M18.4 7.6 17 9';

  // ---------- curvas
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const sai = (x) => 1 - Math.pow(1 - x, 3.2);  // como o cubic-bezier(.16,.84,.24,1) do painel
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const env = (t, t0, t1, fi = 0.6, fo = 0.45) => (t < t0 || t > t1 ? 0 : Math.min(fi ? clamp((t - t0) / fi) : 1, fo ? clamp((t1 - t) / fo) : 1));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const palco = document.getElementById('palco');
  const tomadasEl = document.getElementById('tomadas');
  const camada = document.getElementById('camada');
  const fundo = document.getElementById('fundo');
  const escuro = document.getElementById('escuro');

  let D, M, MF;
  const tomadas = [], itens = [], destaques = [], estado = {};
  let cursor = null;

  // ---------- geometria dos frames reais
  const quadro = (f) => MF.frames[f];
  const caixa = (f, nome, i = 0) => { const c = quadro(f).caixas[nome]; if (!c || !c[i]) throw new Error('caixa ' + f + ':' + nome + '[' + i + ']'); return c[i]; };
  const uniao = (cs) => { const x0 = Math.min(...cs.map((c) => c[0])), y0 = Math.min(...cs.map((c) => c[1])); return [x0, y0, Math.max(...cs.map((c) => c[0] + c[2])) - x0, Math.max(...cs.map((c) => c[1] + c[3])) - y0]; };
  const centro = (c) => [c[0] + c[2] / 2, c[1] + c[3] / 2];

  /*
   * Tomada = um frame real (ou uma sequência de frames do mesmo enquadramento) com câmera.
   * cam: chaves {t, x, y, z, jan, ax, ay, ox, oy}: (x,y) ponto do frame que vai para a âncora (ax,ay) da janela;
   * z = zoom sobre o encaixe que cobre a janela; jan = tamanho da janela (1 = tela cheia).
   */
  function tomada(def) {
    const div = el('div', 'tomada');
    const imgs = {};
    def.frames.forEach((k) => {
      if (imgs[k.f]) return;
      const img = el('img'); img.alt = ''; img.src = 'frames/' + quadro(k.f).arquivo;
      img.style.width = quadro(k.f).w + 'px'; img.style.height = quadro(k.f).h + 'px';
      div.appendChild(img); imgs[k.f] = img;
    });
    tomadasEl.appendChild(div);
    const t = Object.assign({ fi: 0.6, fo: 0.5, div, imgs }, def);
    tomadas.push(t);
    return t;
  }
  function camEm(keys, t) {
    let a = keys[0], b = keys[keys.length - 1];
    if (t <= a.t) return Object.assign({}, a);
    if (t >= b.t) return Object.assign({}, b);
    for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
    const p = io((t - a.t) / (b.t - a.t));
    const r = {};
    for (const k of ['x', 'y', 'z', 'jan', 'ax', 'ay', 'ox', 'oy']) r[k] = a[k] + (b[k] - a[k]) * p;
    return r;
  }
  // completa as chaves com os valores anteriores (só escreve o que muda)
  function chaves(f, lista) {
    const q = quadro(f);
    let prev = { x: q.w / 2, y: q.h / 2, z: 1, jan: 1, ax: 0.5, ay: 0.5, ox: 0, oy: 0 };
    return lista.map((k) => (prev = Object.assign({}, prev, k)));
  }
  function desenharTomada(tm, t) {
    const a = env(t, tm.t0, tm.t1, tm.fi, tm.fo);
    if (a <= 0) { tm.div.style.display = 'none'; delete estado[tm.id]; return; }
    tm.div.style.display = 'block';
    const c = camEm(tm.cam, t);
    const q = quadro(tm.frames[0].f);
    const ww = W * c.jan, wh = H * c.jan, wx = (W - ww) / 2 + c.ox, wy = (H - wh) / 2 + c.oy;
    const s = Math.max(ww / q.w, wh / q.h) * c.z;
    let tx = ww * c.ax - c.x * s, ty = wh * c.ay - c.y * s;
    tx = clamp(tx, ww - q.w * s, 0); ty = clamp(ty, wh - q.h * s, 0);
    Object.assign(tm.div.style, { left: wx + 'px', top: wy + 'px', width: ww + 'px', height: wh + 'px', opacity: a });
    tm.div.classList.toggle('janela', c.jan < 0.995);
    // frame da vez, com dissolve curto entre estados (sequências reais ou antes/depois de um clique)
    let i = 0;
    tm.frames.forEach((k, j) => { if (t >= k.t) i = j; });
    const atual = tm.frames[i], ant = tm.frames[i - 1];
    const mix = ant ? clamp((t - atual.t) / (atual.d ?? 0.4)) : 1;
    for (const [f, img] of Object.entries(tm.imgs)) {
      let op = 0;
      if (f === atual.f) op = 1;
      else if (ant && f === ant.f && mix < 1) op = 1;
      img.style.opacity = f === atual.f ? (ant && ant.f !== atual.f ? mix : 1) : op;
      img.style.zIndex = f === atual.f ? 2 : 1;
      img.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + s.toFixed(5) + ')';
      img.style.display = op || f === atual.f ? 'block' : 'none';
    }
    estado[tm.id] = { wx, wy, tx, ty, s, a };
  }
  const naTela = (id, px, py) => { const e = estado[id]; return e ? [e.wx + e.tx + px * e.s, e.wy + e.ty + py * e.s] : null; };

  // ---------- itens de texto e componentes (entram como os cartões do painel: sobem, focam e aparecem)
  function item(html, cls, t0, t1, pos, opc = {}) {
    const e = el(opc.tag || 'div', 'item ' + (cls || ''), html);
    if (opc.href) { e.href = opc.href; if (opc.novaAba) e.target = '_blank'; }
    Object.assign(e.style, pos);
    camada.appendChild(e);
    const it = Object.assign({ e, t0, t1, fi: 0.9, fo: 0.45, sobe: true }, opc);
    itens.push(it);
    return it;
  }
  function desenharItem(it, t) {
    const a = env(t, it.t0, it.t1, 0, it.fo);
    if (a <= 0) { it.e.style.display = 'none'; return; }
    it.e.style.display = '';
    const p = sai(prog(t, it.t0, it.t0 + it.fi));
    const desloc = it.sobe ? (1 - p) * 22 : 0;
    it.e.style.opacity = Math.min(p, a);
    it.e.style.filter = it.sobe && p < 1 ? 'blur(' + ((1 - p) * 12).toFixed(1) + 'px)' : 'none';
    it.e.style.transform = (it.base || '') + ' translateY(' + desloc.toFixed(1) + 'px) scale(' + (0.985 + 0.015 * p).toFixed(4) + ')';
    if (it.quadro) it.quadro(t, it);
  }

  function destaque(id, f, alvo, t0, t1, opc = {}) {
    const e = el('div', 'destaque ' + (opc.pilula ? 'pilula-d ' : '') + (opc.leve ? 'leve' : ''));
    camada.appendChild(e);
    destaques.push(Object.assign({ e, id, f, alvo, t0, t1, pad: 14 }, opc));
  }
  function desenharDestaque(d, t) {
    const a = env(t, d.t0, d.t1, 0.4, 0.35);
    const e = estado[d.id];
    if (a <= 0 || !e) { d.e.style.display = 'none'; return; }
    const c = d.alvo;
    const p1 = naTela(d.id, c[0], c[1]), p2 = naTela(d.id, c[0] + c[2], c[1] + c[3]);
    Object.assign(d.e.style, { display: 'block', opacity: a * e.a, left: (p1[0] - d.pad) + 'px', top: (p1[1] - d.pad) + 'px', width: (p2[0] - p1[0] + 2 * d.pad) + 'px', height: (p2[1] - p1[1] + 2 * d.pad) + 'px' });
  }

  // ---------- cursor (cliques reais: os alvos são as caixas dos botões no frame)
  function criarCursor() {
    const c = el('div', 'cursor', '<svg viewBox="0 0 24 24" width="40" height="40"><path d="M5 3l13.5 9.2-6.1 1.2 3.6 6.9-2.7 1.4-3.6-6.9L5 19z" fill="#ffffff" stroke="#161616" stroke-width="1.4" stroke-linejoin="round"/></svg>');
    const r = el('div', 'clique');
    camada.appendChild(r); camada.appendChild(c);
    cursor = { e: c, r, chaves: [], cliques: [] };
  }
  function desenharCursor(t) {
    const ks = cursor.chaves;
    const vis = ks.length && t >= ks[0].t - 0.3 && t <= ks[ks.length - 1].fim;
    if (!vis) { cursor.e.style.display = 'none'; cursor.r.style.display = 'none'; return; }
    const pos = (k) => {
      if (!k.alvo) return [k.x, k.y];
      const p = naTela(k.id, ...centro(k.alvo));
      if (p) { k.ultima = p; return p; }
      return k.ultima || [W * 0.62, H * 0.72];  // tomada ainda não visível: última posição conhecida
    };
    let a = ks[0], b = ks[0];
    for (let i = 0; i < ks.length; i++) { if (t >= ks[i].t) { a = ks[i]; b = ks[i + 1] || ks[i]; } }
    const pa = pos(a), pb = pos(b);
    const p = b === a ? 1 : io(clamp((t - a.t) / Math.max(0.01, (b.t - a.t) * 0.85)));
    const x = pa[0] + (pb[0] - pa[0]) * p, y = pa[1] + (pb[1] - pa[1]) * p;
    const op = Math.min(clamp((t - ks[0].t + 0.3) / 0.3), clamp((ks[ks.length - 1].fim - t) / 0.3));
    const clique = cursor.cliques.find((c) => t >= c && t < c + 0.5);
    const aperta = clique != null && t < clique + 0.12 ? 0.86 : 1;
    Object.assign(cursor.e.style, { display: 'block', opacity: op, left: (x - 6) + 'px', top: (y - 4) + 'px', transform: 'scale(' + aperta + ')' });
    if (clique != null) {
      const q = (t - clique) / 0.5;
      Object.assign(cursor.r.style, { display: 'block', left: x + 'px', top: y + 'px', opacity: (1 - q) * 0.8, transform: 'scale(' + (0.3 + q * 0.9) + ')' });
    } else cursor.r.style.display = 'none';
  }

  // ---------- números a partir dos dados do painel
  function numeros() {
    const F = D.focus, anos = F.anos;
    const foco = (ind, k) => F.tabela.find((r) => r.indicador === ind).valores[k];
    const antes = (x) => Math.round((x.mediana - x.variacao) * 100) / 100;
    const S1 = foco('Selic', 1), I1 = foco('IPCA', 1);
    const r2020 = D.juro_real.por_ano.find((r) => r.ano === 2020);
    const mov = [];
    F.tabela.forEach((r) => r.valores.forEach((v) => { if (v.variacao) mov.push([r.indicador, v.ano, Math.abs(v.variacao)]); }));
    mov.sort((a, b) => b[2] - a[2]);
    const B = D.ibovespa;
    return {
      selic: D.selic.valor, ipca: D.ipca12m.valor, ipcaMes: D.ipca12m.mes, real: P.fisher(D.selic.valor, D.ipca12m.valor),
      ano1: anos[1], S1: S1.mediana, S1antes: antes(S1), I1: I1.mediana, coleta: P.dia(F.coleta_ate),
      idxSelic1: mov.findIndex((m) => m[0] === 'Selic' && m[1] === anos[1]),
      real2020: r2020 ? P.fisher(r2020.selic, r2020.ipca) : null,
      rank: M.ranking_mundo,
      ibov: B.fechamento, ibovData: P.dia(B.data), maxH: B.maxima_historica, distMax: (B.fechamento / B.maxima_historica.valor - 1) * 100,
      vol: B.volatilidade.atual, volPct: B.volatilidade.percentil_atual,
      blocos: MF.contagem.blocos_visao,
      dataRef: P.dia(B.data),
    };
  }

  // ---------- roteiro
  function encadear() {
    const cheias = tomadas.filter((tm) => tm.cam.every((k) => k.jan >= 0.999));
    tomadas.forEach((tm, i) => { tm.div.style.zIndex = String(10 + i); });
    cheias.forEach((tm) => {
      const prox = cheias.find((o) => o !== tm && o.t0 >= tm.t1 - 1.2 && o.t0 <= tm.t1 + 0.05);
      if (prox) { tm.t1 = Math.max(tm.t1, prox.t0 + prox.fi + 0.05); tm.fo = 0.05; }
    });
  }

  function roteiro() {
    const N = numeros();
    const ico = (d, w = 30) => '<svg class="ic" width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true"><path d="' + d + '"/></svg>';
    const fonte = (txt) => '<div class="fonte-linha">Fonte: <b>' + txt + '</b></div>';
    const cartao = (olho, numero, linhas, fnt) => '<div class="olho">' + olho + '</div><div class="numero">' + numero + '</div>' + linhas.map((l, i) => '<div class="linha' + (i ? ' cinza' : '') + '">' + l + '</div>').join('') + fonte(fnt);
    const CARTAO_POS = { left: '1268px', top: '50%', width: '600px' };
    const cartaoItem = (html, t0, t1, esq) => { const it = item(html, 'vidro-escuro cartao', t0, t1, esq ? Object.assign({}, CARTAO_POS, { left: '52px' }) : CARTAO_POS); it.base = 'translateY(-50%)'; return it; };
    const legenda = (txt, icone, t0, t1) => item((icone ? ico(icone) : '') + '<span>' + txt + '</span>', 'legenda vidro-escuro', t0, t1, {});
    const atalho = (txt, href, t0, t1, pos, sec) => item(txt, 'atalho' + (sec ? ' sec' : ''), t0, t1, pos || { right: '40px', bottom: '96px' }, { tag: 'a', href, sobe: false, fi: 0.4 });

    // ===================== CENA 1 · INTRODUÇÃO (0–10 s)
    // gráfico de fundo com as séries reais: Selic no fim de cada mês e IPCA em 12 meses, desde 2017
    const fm = D.selic.fim_de_mes.filter((x) => x.mes >= '2017-01');
    const ip = {}; D.ipca12m.historico.forEach((x) => { ip[x.mes] = x.valor; });
    const X0 = 160, X1 = 1600, Y0 = 560, Y1 = 960, TOPO = 16;
    const gx = (i) => X0 + i / (fm.length - 1) * (X1 - X0), gy = (v) => Y1 - v / TOPO * (Y1 - Y0);
    const ptsS = fm.map((x, i) => [gx(i), gy(x.valor)]), ptsI = fm.map((x, i) => (ip[x.mes] != null ? [gx(i), gy(ip[x.mes])] : null)).filter(Boolean);
    const grade = [4, 8, 12, 16].map((v) => '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + gy(v) + '" y2="' + gy(v) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (X0 - 16) + '" y="' + (gy(v) + 6) + '" fill="#c2c2c2" font-size="18" text-anchor="end">' + v + '%</text>').join('');
    const anosX = fm.map((x, i) => (x.mes.endsWith('-01') ? '<text x="' + gx(i) + '" y="' + (Y1 + 36) + '" fill="#c2c2c2" font-size="18" text-anchor="middle">' + x.mes.slice(0, 4) + '</text>' : '')).join('');
    const svg = item('<svg width="1920" height="1080" viewBox="0 0 1920 1080" style="font-family:DM Sans">' + grade + anosX
      + '<path id="g-selic" d="' + P.caminho(ptsS) + '" fill="none" stroke="#ededed" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>'
      + '<path id="g-ipca" d="' + P.caminho(ptsI) + '" fill="none" stroke="#f0b37a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>'
      + '<text id="g-ls" x="' + (X1 + 18) + '" y="' + (ptsS[ptsS.length - 1][1] + 7) + '" fill="#ededed" font-size="24" font-weight="500">Selic ' + P.pct(N.selic) + '</text>'
      + '<text id="g-li" x="' + (X1 + 18) + '" y="' + (ptsI[ptsI.length - 1][1] + 7) + '" fill="#f0b37a" font-size="24" font-weight="500">IPCA ' + P.pct(N.ipca) + '</text>'
      + '</svg>', '', 0.2, 10.1, { left: 0, top: 0 }, { sobe: false, fi: 1.2,
      quadro: (t, it) => {
        const pd = io(prog(t, 0.5, 4.4));
        it.e.querySelector('#g-selic').setAttribute('stroke-dashoffset', (1 - pd).toFixed(4));
        it.e.querySelector('#g-ipca').setAttribute('stroke-dashoffset', (1 - pd).toFixed(4));
        const lab = prog(t, 4.0, 4.6);
        it.e.querySelector('#g-ls').setAttribute('opacity', lab); it.e.querySelector('#g-li').setAttribute('opacity', lab);
        it.e.style.opacity = Math.min(it.e.style.opacity, 1 - 0.62 * io(prog(t, 4.6, 5.4)));
      } });

    item('BRASIL · ' + P.MESES_LONGOS[N.dataRef.getMonth()].toUpperCase() + ' DE ' + N.dataRef.getFullYear(), 'olho', 0.4, 4.9, { left: '160px', top: '170px' });
    const kpi = (rot, val, cor, x, t0, fmt) => item('<div class="numero" style="font-size:120px;color:' + cor + '">' + fmt(0) + '</div><div class="rotulo" style="margin-top:14px">' + rot + '</div>', '', t0, 4.9, { left: x + 'px', top: '226px' },
      { quadro: (t, it) => { it.e.firstChild.textContent = fmt(val * sai(prog(t, t0, t0 + 1.4))); } });
    kpi('Selic (meta)', N.selic, COR.osso, 160, 0.9, (v) => P.pct(v));
    kpi('IPCA em 12 meses', N.ipca, COR.ambar, 700, 1.25, (v) => P.pct(v));
    kpi('Juro real hoje', N.real, COR.azul, 1200, 1.6, (v) => P.pct(v));

    item('Selic em ' + P.pct(N.selic) + '. Inflação de ' + P.pct(N.ipca) + ' em 12 meses, ' + (N.ipca > 4.5 ? 'acima do teto da meta.' : 'dentro da meta.'), 'texto', 5.0, 9.7, { left: '160px', top: '250px', width: '1500px', fontSize: '36px' });
    item('O que os números dizem sobre o Brasil agora?', 'titulo', 5.9, 9.7, { left: '160px', top: '330px', width: '1500px' });

    // ===================== CENA 2 · O PAINEL (10–25 s)
    item('<div class="icone vidro"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ededed" style="stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + ICONE + '"/></svg></div><div class="nome">Painel Macro Brasil</div>',
      'marca', 10.2, 12.8, { left: '50%', top: '410px' }, { base: 'translateX(-50%)' }).base = 'translateX(-50%)';
    const pil = item('<span class="ponto"></span>Dados do Banco Central, IBGE, B3, Tesouro e Fed', 'pilula vidro', 10.8, 12.8, { left: '50%', top: '560px' });
    pil.base = 'translateX(-50%)';

    const topo = tomada({ id: 'topo', t0: 12.5, t1: 20.6, fi: 0.8, frames: [{ t: 0, f: 'visao-topo' }],
      cam: chaves('visao-topo', [{ t: 12.5, jan: 0.82, oy: 40 }, { t: 14.2, jan: 1, oy: 0 }, { t: 14.6 },
        { t: 16.9, z: 1.06, x: centro(uniao(quadro('visao-topo').caixas.kpis))[0], y: centro(uniao(quadro('visao-topo').caixas.kpis))[1] },
        { t: 17.5 }, { t: 19.0, z: 1.45, x: centro(uniao(quadro('visao-topo').caixas.nav))[0], y: centro(uniao(quadro('visao-topo').caixas.nav))[1], ay: 0.3 }]) });
    destaque('topo', 'visao-topo', uniao(quadro('visao-topo').caixas.kpis), 14.7, 17.3, { pad: 12 });
    legenda('Os números do dia: Selic, IPCA, juro real, Focus e Ibovespa', P.icones.bars, 14.9, 17.3);
    destaque('topo', 'visao-topo', uniao(quadro('visao-topo').caixas.nav), 18.0, 20.4, { pilula: true, pad: 10 });
    legenda('5 abas: Visão geral · Expectativas · Economia · Agenda · Metodologia', P.icones.home, 18.1, 20.4);

    const pq = quadro('visao-pagina');
    const sP = W / pq.w;
    tomada({ id: 'pagina', t0: 20.2, t1: 25.4, fi: 0.5, frames: [{ t: 0, f: 'visao-pagina' }],
      cam: chaves('visao-pagina', [{ t: 20.2, ay: 0, y: 0 }, { t: 25.4, ay: 0, y: pq.h - H / sP }]) });
    legenda(N.blocos + ' blocos na visão geral. Cada um mostra de onde vêm os dados.', P.icones.book, 20.8, 25.2);
    atalho('Abrir a visão geral ↗', '../#visao', 20.8, 25.2);

    // ===================== CENA 3 · INDICADORES (25–50 s)
    // a) juro real
    const fb = 'visao-barras', cardB = caixa(fb, 'card');
    tomada({ id: 'barras', t0: 25.0, t1: 31.8, frames: [{ t: 0, f: fb }, { t: 29.4, f: 'visao-barras-2020', d: 0.5 }],
      cam: chaves(fb, [{ t: 25, x: centro(cardB)[0], y: centro(cardB)[1], ax: 0.36 }, { t: 31.8, z: 1.1 }]) });
    destaque('barras', fb, caixa(fb, 'barras', 9), 26.6, 29.3, { pad: 10 });
    destaque('barras', 'visao-barras-2020', uniao([caixa(fb, 'barras', 3), caixa('visao-barras-2020', 'chip')]), 29.7, 31.6, { pad: 10, leve: true });
    cartaoItem(cartao('Juro real', P.pct(N.real), ['Selic de ' + P.pct(N.selic) + ' descontada a inflação de ' + P.pct(N.ipca) + ' em 12 meses.', 'No ranking de ' + N.rank.paises_no_ranking + ' países, o Brasil está em ' + N.rank.posicao_brasil + 'º.'], 'BCB · IBGE · Moneyou via Agência Brasil'), 25.6, 29.3);
    cartaoItem(cartao('Em 2020', P.pct(N.real2020), ['O juro real foi negativo: a inflação passou da Selic.', 'Passe o mouse nas barras para ver a conta de cada ano.'], 'BCB · IBGE · cálculo do painel'), 29.6, 31.6);
    atalho('Ver no painel ↗', '../#visao', 26.0, 31.4, { right: '40px', top: '40px' });

    // b) inflação contra a meta
    const fi = 'visao-inflacao', cardI = caixa(fi, 'card');
    tomada({ id: 'inflacao', t0: 31.6, t1: 37.8, frames: [{ t: 0, f: fi }],
      cam: chaves(fi, [{ t: 31.6, x: centro(cardI)[0], y: centro(cardI)[1], ax: 0.36 }, { t: 37.8, z: 1.1 }]) });
    destaque('inflacao', fi, uniao([caixa(fi, 'ultimo'), [caixa(fi, 'ultimo')[0] - 40, caixa(fi, 'ultimo')[1] - 30, 160, 80]]), 32.8, 35.0, { pad: 8, pilula: true });
    destaque('inflacao', fi, caixa(fi, 'contador'), 35.2, 37.6, { pad: 10, pilula: true });
    atalho('Ver no painel ↗', '../#visao', 32.2, 37.4, { right: '40px', top: '40px' });
    cartaoItem(cartao('Inflação', P.pct(N.ipca), ['IPCA em 12 meses até ' + P.mesLongo(N.ipcaMes) + ', ' + (N.ipca > 4.5 ? 'acima do teto da meta (4,5%).' : 'dentro da meta.'), 'Na meta contínua, 6 meses seguidos fora da banda configuram descumprimento.'], 'IBGE via BCB · Decreto 12.079/2024'), 32.2, 37.6);

    // c) expectativas (Focus)
    const fm2 = 'exp-mudancas', cardM = caixa(fm2, 'card');
    tomada({ id: 'mudancas', t0: 37.6, t1: 43.8, frames: [{ t: 0, f: fm2 }],
      cam: chaves(fm2, [{ t: 37.6, x: centro(cardM)[0], y: centro(cardM)[1], ax: 0.66 }, { t: 43.8, z: 1.12 }]) });
    if (N.idxSelic1 >= 0) destaque('mudancas', fm2, caixa(fm2, 'itens', N.idxSelic1), 38.9, 43.5, { pad: 8 });
    cartaoItem(cartao('Expectativas · Focus', P.pct(N.S1), ['Selic esperada para o fim de ' + N.ano1 + '. Uma semana antes: ' + P.pct(N.S1antes) + '.', 'IPCA esperado para ' + N.ano1 + ': ' + P.pct(N.I1) + (N.I1 > 4.5 ? ', acima do teto.' : '.')], 'BCB · Boletim Focus (coleta até ' + P.ddmm(N.coleta) + ')'), 38.2, 43.6, true);
    atalho('Abrir Expectativas ↗', '../#expectativas', 38.4, 43.4, { right: '40px', bottom: '96px' });

    // d) bolsa: distância da máxima e volatilidade
    const fo = 'visao-ibov', cardO = caixa(fo, 'card');
    tomada({ id: 'ibov', t0: 43.6, t1: 47.4, frames: [{ t: 0, f: fo }],
      cam: chaves(fo, [{ t: 43.6, x: centro(cardO)[0], y: centro(cardO)[1], ax: 0.36 }, { t: 47.4, z: 1.08 }]) });
    destaque('ibov', fo, caixa(fo, 'legenda'), 44.6, 47.1, { pad: 10 });
    atalho('Ver no painel ↗', '../#visao', 44.2, 50.0, { right: '40px', top: '40px' });
    cartaoItem(cartao('Bolsa', P.comSinal(N.distMax) + '%', ['Ibovespa abaixo da máxima histórica de ' + P.fmtPts(N.maxH.valor) + ' pontos, de ' + P.ddmmaaaa(P.dia(N.maxH.data)) + '.', 'Fechamento de ' + P.ddmm(N.ibovData) + ': ' + P.fmtPts(N.ibov) + ' pontos.'], 'B3 · Ibovespa'), 44.2, 47.2);
    const fmd = 'visao-medo';
    tomada({ id: 'medo', t0: 47.2, t1: 50.4, fi: 0.5, frames: [{ t: 0, f: fmd }],
      cam: chaves(fmd, [{ t: 47.2, x: centro(caixa(fmd, 'medo'))[0], y: centro(caixa(fmd, 'medo'))[1], z: 1.25, ax: 0.32 }, { t: 50.4, z: 1.35 }]) });
    destaque('medo', fmd, caixa(fmd, 'pill'), 48.0, 50.1, { pad: 8, pilula: true });
    cartaoItem(cartao('Volatilidade', P.pct(N.vol, 1), ['Maior que em ' + P.fmt(N.volPct, 0) + '% dos pregões desde 2000.', 'Oscilações do Ibovespa em 21 pregões, ao ano.'], 'B3 · cálculo do painel'), 47.6, 50.1);

    // ===================== CENA 4 · INTERATIVIDADE (50–70 s)
    criarCursor();
    const K = cursor.chaves, CL = cursor.cliques;
    // a) navegação entre abas (sequência real da página entrando)
    const seqNav = MF.sequencias['nav-exp'];
    const tNav = 51.9;
    tomada({ id: 'nav', t0: 50.0, t1: 54.4, fi: 0.5, frames: [{ t: 0, f: 'visao-topo' }].concat(seqNav.map((s) => ({ t: tNav + s.ms / 1000, f: s.frame, d: 0.14 }))).concat([{ t: tNav + 1.9, f: 'exp-topo', d: 0.3 }]),
      cam: chaves('visao-topo', [{ t: 50, z: 1.0 }]) });
    K.push({ t: 50.4, x: 1500, y: 900 }, { t: 51.6, id: 'nav', alvo: caixa('visao-topo', 'nav', 1) }, { t: 53.9, id: 'nav', alvo: caixa('visao-topo', 'nav', 1) });
    CL.push(51.75);
    legenda('Navegue pelas abas', P.icones.home, 50.5, 54.2);
    atalho('Experimente no painel ↗', '../#expectativas', 50.6, 54.2, { right: '40px', top: '40px' });

    // b) histórico do Focus: troca de indicador (linha desenhada de novo) e de ano
    const fh = 'exp-hist-ipca', cardH = caixa(fh, 'card');
    const seqH = MF.sequencias['hist-selic'];
    const tH = 55.6;
    tomada({ id: 'hist', t0: 54.2, t1: 58.6, fi: 0.5, frames: [{ t: 0, f: fh }].concat(seqH.map((s) => ({ t: tH + 0.05 + s.ms / 1000, f: s.frame, d: 0.12 }))).concat([{ t: tH + 1.2, f: 'exp-hist-selic', d: 0.25 }, { t: 57.7, f: 'exp-hist-selic-2028', d: 0.45 }]),
      cam: chaves(fh, [{ t: 54.2, x: centro(cardH)[0], y: centro(cardH)[1], z: 1.4 }]) });
    K.push({ t: 54.5, id: 'hist', alvo: caixa(fh, 'segs', 0) }, { t: 55.4, id: 'hist', alvo: caixa(fh, 'segs', 1) }, { t: 57.4, id: 'hist', alvo: caixa(fh, 'segs', 6) }, { t: 58.2, id: 'hist', alvo: caixa(fh, 'segs', 6) });
    CL.push(55.55, 57.6);
    legenda('Escolha o indicador e o ano', P.icones.target, 54.6, 58.4);
    atalho('Experimente no painel ↗', '../#expectativas', 54.6, 58.4, { right: '40px', top: '40px' });

    // c) período do gráfico de inflação
    const fin = 'visao-inflacao';
    tomada({ id: 'periodo', t0: 58.4, t1: 62.2, fi: 0.5, frames: [{ t: 0, f: fin }, { t: 59.9, f: 'visao-inflacao-desde', d: 0.5 }],
      cam: chaves(fin, [{ t: 58.4, x: centro(cardI)[0], y: centro(cardI)[1] - 120, z: 1.35 }]) });
    K.push({ t: 58.7, id: 'periodo', alvo: caixa(fin, 'segs', 1) }, { t: 59.6, id: 'periodo', alvo: caixa(fin, 'segs', 2) }, { t: 61.8, id: 'periodo', alvo: caixa(fin, 'segs', 2) });
    CL.push(59.8);
    legenda('Mude o período: 12 meses, 3 anos ou desde 2017', P.icones.calendar, 58.6, 62.0);
    atalho('Experimente no painel ↗', '../#visao', 58.6, 62.0, { right: '40px', top: '40px' });

    // d) bolsa x renda fixa: em reais, sem a inflação, em dólar
    const fc = 'visao-comp-reais', cardC = caixa(fc, 'card');
    tomada({ id: 'comp', t0: 62.0, t1: 66.4, fi: 0.5, frames: [{ t: 0, f: fc }, { t: 63.5, f: 'visao-comp-inflacao', d: 0.45 }, { t: 65.2, f: 'visao-comp-dolar', d: 0.45 }],
      cam: chaves(fc, [{ t: 62.0, x: centro(cardC)[0], y: centro(cardC)[1], z: 1.42 }]) });
    K.push({ t: 62.3, id: 'comp', alvo: caixa(fc, 'segs', 0) }, { t: 63.2, id: 'comp', alvo: caixa(fc, 'segs', 1) }, { t: 64.9, id: 'comp', alvo: caixa(fc, 'segs', 2) }, { t: 66.0, id: 'comp', alvo: caixa(fc, 'segs', 2) });
    CL.push(63.4, 65.1);
    legenda('Compare bolsa e CDI em reais, sem a inflação ou em dólar', P.icones.trend, 62.2, 66.2);
    atalho('Experimente no painel ↗', '../#visao', 62.2, 66.2, { right: '40px', top: '40px' });

    // e) modo explicativo: explicação e fonte em cada bloco
    const fe = 'visao-explicativo';
    tomada({ id: 'explica', t0: 66.2, t1: 70.4, fi: 0.5, frames: [{ t: 0, f: 'visao-topo' }, { t: 67.3, f: fe, d: 0.5 }],
      cam: chaves('visao-topo', [{ t: 66.2, z: 1.2, x: 2400, y: 380, ay: 0.4 }, { t: 67.6, z: 1.0, x: 1600, y: 900, ay: 0.5 }]) });
    K.push({ t: 66.4, x: 1200, y: 760 }, { t: 67.0, id: 'explica', alvo: caixa('visao-topo', 'explica'), fim: 67.9 });
    CL.push(67.2);
    destaque('explica', fe, caixa(fe, 'fonte', 0), 68.6, 70.2, { pad: 6, leve: true });
    legenda('Modo explicativo: o que cada bloco mostra e de onde vêm os dados', P.icones.book, 66.4, 70.2);
    atalho('Ver as fontes ↗', '../#metodologia', 66.4, 70.2, { right: '40px', top: '40px' });

    // ===================== CENA 5 · ENCERRAMENTO (70–85 s)
    const mont = [['eco-topo', 330, -250], ['agenda', 520, 40], ['met-referencias', 360, 300]];
    mont.forEach(([f, ox, oy], i) => tomada({ id: 'm' + i, t0: 70.3 + i * 0.25, t1: 80.8, fi: 0.9, frames: [{ t: 0, f }],
      cam: chaves(f, [{ t: 70.3, jan: 0.40, ox: ox + 40, oy: oy + 30 }, { t: 80.8, jan: 0.42, ox, oy }]) }));
    item('Os dados estão disponíveis.', 'titulo', 70.8, 76.0, { left: '120px', top: '400px', width: '820px' });
    item('Explore os indicadores, compare períodos e tire suas próprias conclusões.', 'titulo-m', 76.2, 80.6, { left: '120px', top: '360px', width: '860px' });

    const fimMarca = item('<div class="icone vidro"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ededed" style="stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + ICONE + '"/></svg></div><div class="nome">Painel Macro Brasil</div>',
      'marca', 80.9, 85.5, { left: '50%', top: '370px' });
    fimMarca.base = 'translateX(-50%)';
    const url = (M.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const pu = item('<span class="ponto" style="background:#8fb0ff"></span>' + url, 'pilula vidro', 81.4, 85.5, { left: '50%', top: '520px' });
    pu.base = 'translateX(-50%)';
    const fl = item('Fontes: Banco Central · IBGE · B3 · Tesouro Nacional · FRED · Dados de ' + P.ddmmaaaa(N.dataRef), 'fonte-linha', 81.8, 85.5, { left: '50%', top: '640px', fontSize: '20px', whiteSpace: 'nowrap' });
    fl.base = 'translateX(-50%)';
    atalho('Abrir o painel ↗', '../', 81.6, 999, { left: '50%', top: '730px' }).base = 'translateX(-110%)';
    atalho('Ver as fontes', '../#metodologia', 81.6, 999, { left: '50%', top: '730px' }, true).base = 'translateX(8%)';

    // capítulo em curso (canto inferior direito)
    const cap = item('', 'capitulo vidro-escuro', 10.4, 84.4, {}, { sobe: false, fi: 0.5,
      quadro: (t, it) => { const i = CAPITULOS.filter((c) => t >= c[0]).length - 1; const txt = '<span class="num">0' + (i + 1) + ' / 05</span>' + CAPITULOS[i][1]; if (it.e.innerHTML !== txt) it.e.innerHTML = txt; } });
    cap.e.style.position = 'absolute';
  }

  // ---------- fundo (o mesmo pôr do sol do painel) e escurecimento
  function desenharFundo(t) {
    const nitido = io(prog(t, 10.4, 12.6)) * (1 - io(prog(t, 70.0, 71.4)));
    const blur = 16 * (1 - nitido);
    const brilho = 0.42 + 0.48 * nitido;
    const zoom = 1.06 + 0.06 * (t / DUR);
    fundo.style.filter = 'blur(' + blur.toFixed(2) + 'px) saturate(.9) brightness(' + brilho.toFixed(3) + ')';
    fundo.style.transform = 'scale(' + zoom.toFixed(4) + ') translate3d(' + (-1 + 2.2 * t / DUR).toFixed(3) + '%,0,0)';
    // o vídeo termina no preto; a versão interativa para na marca, com os botões para o painel
    escuro.style.opacity = Math.max(1 - prog(t, 0, 0.9), RENDER ? prog(t, 84.2, 85) : 0);
  }

  function render(t) {
    t = clamp(t, 0, DUR);
    desenharFundo(t);
    tomadas.forEach((tm) => desenharTomada(tm, t));
    itens.forEach((it) => desenharItem(it, t));
    destaques.forEach((d) => desenharDestaque(d, t));
    if (cursor) desenharCursor(t);
  }

  // ---------- reprodução interativa
  function controles() {
    const audio = document.getElementById('trilha');
    const trilho = document.getElementById('trilho');
    const play = document.getElementById('play'), playIc = document.getElementById('play-ic');
    const som = document.getElementById('som'), somTxt = document.getElementById('som-txt');
    const tempo = document.getElementById('tempo');
    const moldura = document.getElementById('moldura');
    let t = 0, tocando = false, ultimo = 0, comSom = false;
    const segs = CAPITULOS.map((c, i) => {
      const fim = (CAPITULOS[i + 1] || [DUR])[0];
      const b = el('button', 'seg', '<div class="faixa"><i></i></div><span>' + (i + 1) + '. ' + c[1] + '</span>');
      b.type = 'button'; b.style.flexGrow = fim - c[0]; b.setAttribute('aria-label', 'Capítulo ' + (i + 1) + ': ' + c[1]);
      trilho.appendChild(b);
      return { b, ini: c[0], fim };
    });
    const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    function atualizarUI() {
      segs.forEach((s) => {
        s.b.querySelector('i').style.width = (clamp((t - s.ini) / (s.fim - s.ini)) * 100) + '%';
        s.b.classList.toggle('on', t >= s.ini && t < s.fim);
      });
      tempo.textContent = mmss(t) + ' / ' + mmss(DUR);
      playIc.setAttribute('d', tocando ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M7 4.5v15l13-7.5z');
      play.setAttribute('aria-label', tocando ? 'Pausar' : 'Reproduzir');
    }
    function ir(novo) { t = clamp(novo, 0, DUR); if (comSom) { try { audio.currentTime = t; } catch (e) { /* ok */ } } render(t); atualizarUI(); }
    function tocar(sim) {
      if (sim && t >= DUR - 0.05) ir(0);
      tocando = sim; ultimo = performance.now();
      if (comSom) { if (sim) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); }
      atualizarUI();
    }
    function laco(agora) {
      if (tocando) {
        t += (agora - ultimo) / 1000;
        if (comSom && !audio.paused && Math.abs(audio.currentTime - t) > 0.25) t = audio.currentTime;
        if (t >= DUR) { t = DUR; tocando = false; audio.pause(); }
        render(t); atualizarUI();
      }
      ultimo = agora;
      requestAnimationFrame(laco);
    }
    play.addEventListener('click', () => tocar(!tocando));
    som.addEventListener('click', () => {
      comSom = !comSom;
      som.setAttribute('aria-pressed', String(comSom)); somTxt.textContent = comSom ? 'Trilha ativada' : 'Ativar trilha';
      if (comSom && tocando) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause();
    });
    // arrastar no trilho
    const deX = (x) => { const r = trilho.getBoundingClientRect(); return clamp((x - r.left) / r.width) * DUR; };
    // clique num capítulo = início dele; arrastar = percorrer o tempo
    let x0 = null, arrastou = false;
    trilho.addEventListener('pointerdown', (ev) => { x0 = ev.clientX; arrastou = false; trilho.setPointerCapture(ev.pointerId); });
    trilho.addEventListener('pointermove', (ev) => { if (x0 == null || !ev.buttons) return; if (Math.abs(ev.clientX - x0) > 4) arrastou = true; if (arrastou) ir(deX(ev.clientX)); });
    trilho.addEventListener('pointerup', (ev) => {
      if (x0 != null && !arrastou) { const s = segs.find((sg) => { const r = sg.b.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right; }); if (s) ir(s.ini); }
      x0 = null;
    });
    segs.forEach((s) => s.b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); ir(s.ini); } }));
    palco.addEventListener('click', (ev) => { if (!ev.target.closest('a,button')) tocar(!tocando); });
    document.addEventListener('keydown', (ev) => {
      if (ev.target.closest('input,textarea')) return;
      if (ev.key === ' ') { ev.preventDefault(); tocar(!tocando); }
      else if (ev.key === 'ArrowRight') ir(t + 5);
      else if (ev.key === 'ArrowLeft') ir(t - 5);
      else if (/^[1-5]$/.test(ev.key)) ir(CAPITULOS[Number(ev.key) - 1][0]);
    });
    const ajustar = () => { palco.style.transform = 'scale(' + (moldura.clientWidth / W) + ')'; };
    window.addEventListener('resize', ajustar); ajustar();
    const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ir(quieto ? 12.5 : 0);
    requestAnimationFrame(laco);
    if (!quieto) tocar(true);
  }

  // ---------- início: dados, manifesto, imagens e fontes prontos antes do primeiro quadro
  const json = (u) => fetch(u, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  window.apresentacao = {
    DUR,
    pronto: Promise.all([json('dados-video.json'), json('manual-video.json'), json('frames/manifesto.json')]).then(async ([d, m, mf]) => {
      D = d; M = m; MF = mf;
      roteiro();
      encadear();
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
      await new Promise((ok) => { const f = new Image(); f.onload = f.onerror = ok; f.src = '../img/fundo.jpg'; });
      render(0);
      if (!RENDER) controles();
      return true;
    }),
    render,
  };
})();
