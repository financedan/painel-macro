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
  const pulso = (t, b) => (t < b ? 0 : t < b + 0.18 ? io((t - b) / 0.18) : t < b + 0.85 ? 1 - io((t - b - 0.18) / 0.67) : 0);
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
    if (c.jan >= 0.995 && tm.punch !== false) c.z *= 1 + 0.08 * (1 - sai(prog(t, tm.t0, tm.t0 + 0.9)));  // entra com um leve zoom
    (tm.pulsos || []).forEach((b) => { c.z *= 1 + 0.045 * pulso(t, b); });  // zoom rápido no clique/destaque
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
    const esconder = () => { cursor.e.style.display = 'none'; cursor.r.style.display = 'none'; };
    if (!ks.length || t < ks[0].t - 0.3) { esconder(); return; }
    // o cursor aparece em trechos: cada trecho termina numa chave com "fim"
    let ia = 0;
    for (let i = 0; i < ks.length; i++) if (t >= ks[i].t) ia = i;
    const fimDe = (i) => { let j = i; while (j < ks.length - 1 && ks[j].fim == null) j++; return j; };
    let jf = fimDe(ia);
    if (t > (ks[jf].fim ?? ks[jf].t)) {
      const prox = ks[jf + 1];
      if (prox && t >= prox.t - 0.3) { ia = jf + 1; jf = fimDe(ia); } else { esconder(); return; }
    }
    let ji = ia; while (ji > 0 && ks[ji - 1].fim == null) ji--;
    const pos = (k) => {
      if (!k.alvo) return [k.x, k.y];
      const p = naTela(k.id, ...centro(k.alvo));
      if (p) { k.ultima = p; return p; }
      return k.ultima || [W * 0.62, H * 0.72];  // tomada ainda não visível: última posição conhecida
    };
    const a = ks[ia], b = a.fim == null && ia < jf ? ks[ia + 1] : a;
    const pa = pos(a), pb = pos(b);
    const p = b === a ? 1 : io(clamp((t - a.t) / Math.max(0.01, (b.t - a.t) * 0.85)));
    const x = pa[0] + (pb[0] - pa[0]) * p, y = pa[1] + (pb[1] - pa[1]) * p;
    const op = Math.min(clamp((t - ks[ji].t + 0.3) / 0.3), clamp(((ks[jf].fim ?? ks[jf].t) - t) / 0.3));
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
      movSelic: (() => {
        const v = F.tabela.find((r) => r.indicador === 'Selic').valores.map((x) => Object.assign({ antes: antes(x) }, x)).filter((x) => x.variacao).sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))[0];
        return v ? Object.assign({ idx: mov.findIndex((m) => m[0] === 'Selic' && m[1] === v.ano) }, v) : null;
      })(),
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
    const atalho = (txt, href, t0, t1, pos, sec) => item(txt, 'atalho' + (sec ? ' sec' : ''), t0, t1, pos || { right: '40px', bottom: '150px' }, { tag: 'a', href, sobe: false, fi: 0.4 });

    // ---------- camada de estímulo
    const flash = (t0, forca = 0.1) => item('', 'flash', t0, t0 + 0.32, { left: 0, top: 0 }, { sobe: false, fi: 0.04, fo: 0.28,
      quadro: (t, it) => { it.e.style.opacity = forca * (1 - prog(t, t0, t0 + 0.32)); } });
    const varrer = (t0) => item('', 'varredura', t0, t0 + 0.62, { left: 0 }, { sobe: false, fi: 0.05, fo: 0.12,
      quadro: (t, it) => { const x = -640 + io(prog(t, t0, t0 + 0.62)) * 2700; it.e.style.transform = 'translateX(' + x.toFixed(1) + 'px) skewX(-8deg)'; } });
    // número de impacto: o valor grande no centro, antes do cartão
    function slam(t0, t1, numero, cor, olho, sub) {
      item('', 'slam-veu', t0, t1, { left: 0, top: 0 }, { sobe: false, fi: 0.18, fo: 0.3 });
      const it = item('<div class="olho">' + olho + '</div><div class="numero" style="color:' + cor + ';font-size:' + (numero.length > 7 ? 190 : 260) + 'px;white-space:nowrap">' + numero + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : ''), 'slam', t0, t1, {},
        { sobe: false, fi: 0.14, fo: 0.3, quadro: (t, it) => {
          const entra = sai(prog(t, t0, t0 + 0.38)), sai_ = prog(t, t1 - 0.3, t1);
          const esc = (1.22 - 0.22 * entra) * (1 - 0.06 * sai_);
          it.e.style.transform = 'translate(-50%,-50%) scale(' + esc.toFixed(4) + ')';
          it.e.style.filter = sai_ > 0 ? 'blur(' + (sai_ * 10).toFixed(1) + 'px)' : 'none';
        } });
      flash(t0, 0.12);
      return it;
    }
    // cartão com o número contando e um mini gráfico animado
    function cartaoAnim(o) {
      const html = '<div class="olho">' + o.olho + '</div><div class="numero">' + o.fmt(o.de) + '</div>'
        + o.linhas.map((l, i) => '<div class="linha' + (i ? ' cinza' : '') + '">' + l + '</div>').join('') + (o.extra || '') + fonte(o.fonte);
      const it = item(html, 'vidro-escuro cartao', o.t0, o.t1, o.esq ? Object.assign({}, CARTAO_POS, { left: '52px' }) : CARTAO_POS, {
        quadro: (t, it) => {
          const q = sai(prog(t, o.t0 + 0.1, o.t0 + 1.0));
          it.e.querySelector('.numero').textContent = o.fmt(o.de + (o.para - o.de) * q);
          if (o.anima) o.anima(t, it.e);
        } });
      it.base = 'translateY(-50%)';
      return it;
    }
    const larg = (e, sel, pct) => { const x = e.querySelector(sel); if (x) x.style.width = pct.toFixed(2) + '%'; };

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
    [0.9, 1.25, 1.6].forEach((x) => flash(x, 0.05));
    flash(5.9, 0.08);

    item('Juros de ' + P.pct(N.selic) + '. Inflação de ' + P.pct(N.ipca) + (N.ipca > 4.5 ? ', acima do teto da meta.' : '.'), 'texto', 5.0, 9.7, { left: '160px', top: '250px', width: '1500px', fontSize: '36px' });
    item('Você sabe o que esses números dizem sobre o seu dinheiro?', 'titulo', 5.9, 9.7, { left: '160px', top: '330px', width: '1500px' });

    // ===================== CENA 2 · O PAINEL (10–25 s)
    item('<div class="icone vidro"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ededed" style="stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + ICONE + '"/></svg></div><div class="nome">Painel Macro Brasil</div>',
      'marca', 10.2, 12.5, { left: '50%', top: '410px' }, { base: 'translateX(-50%)' }).base = 'translateX(-50%)';
    flash(10.2, 0.1);
    const pil = item('<span class="ponto"></span>Dados oficiais: Banco Central, IBGE, B3 e Tesouro', 'pilula vidro', 10.8, 12.5, { left: '50%', top: '560px' });
    pil.base = 'translateX(-50%)';

    // a) primeiro contato: a saudação pede o nome e o painel se monta na frente do público (sequência real)
    criarCursor();
    const K = cursor.chaves, CL = cursor.cliques;
    const seqA = MF.sequencias['abertura'];
    const tEntra = 14.6;
    const sb = 'boasvindas', cardS = caixa(sb, 'card');
    tomada({ id: 'saudacao', pulsos: [tEntra], t0: 12.3, t1: 18.4, fi: 0.8,
      frames: [{ t: 0, f: sb }, { t: 13.15, f: 'boasvindas-dig', d: 0.2 }, { t: 13.6, f: 'boasvindas-nome', d: 0.2 }]
        .concat(seqA.map((s) => ({ t: tEntra + 0.1 + s.ms / 1000, f: s.frame, d: 0.16 }))),
      cam: chaves(sb, [{ t: 12.3, jan: 0.8, oy: 40, x: centro(cardS)[0], y: centro(cardS)[1] }, { t: 13.6, jan: 1, oy: 0, z: 1.18 }, { t: 14.5, z: 1.18 },
        { t: 15.3, z: 1.0, x: 1600, y: 900 }]) });
    K.push({ t: 13.3, x: 1250, y: 820 }, { t: 14.4, id: 'saudacao', alvo: caixa(sb, 'entrar') }, { t: 15.0, id: 'saudacao', alvo: caixa(sb, 'entrar'), fim: 15.3 });
    CL.push(tEntra);
    legenda('Ele te recebe pelo nome', P.icones.home, 12.7, 14.5);
    legenda('E os números ganham vida na sua frente', P.icones.pulse, 15.0, 18.2);
    const fa = seqA[seqA.length - 1].frame;
    destaque('saudacao', fa, uniao(quadro(fa).caixas.kpis), 17.2, 18.2, { pad: 12 });

    // b) as abas
    const topo = tomada({ id: 'topo', t0: 18.2, t1: 20.6, fi: 0.5, frames: [{ t: 0, f: 'visao-topo' }],
      cam: chaves('visao-topo', [{ t: 18.2, z: 1.0 }, { t: 19.2, z: 1.45, x: centro(uniao(quadro('visao-topo').caixas.nav))[0], y: centro(uniao(quadro('visao-topo').caixas.nav))[1], ay: 0.3 }]) });
    quadro('visao-topo').caixas.nav.forEach((c, i) => destaque('topo', 'visao-topo', c, 18.7 + i * 0.3, 18.7 + i * 0.3 + 0.5, { pad: 6, pilula: true, leve: true }));
    destaque('topo', 'visao-topo', uniao(quadro('visao-topo').caixas.nav), 19.9, 20.5, { pilula: true, pad: 10 });
    topo.pulsos = [18.7, 19.9];
    legenda('4 abas: Visão geral · Expectativas · Agenda · Metodologia', P.icones.home, 18.4, 20.4);

    // c) a página inteira
    const pq = quadro('visao-pagina');
    const sP = W / pq.w;
    tomada({ id: 'pagina', t0: 20.2, t1: 25.4, fi: 0.5, frames: [{ t: 0, f: 'visao-pagina' }],
      cam: chaves('visao-pagina', [{ t: 20.2, ay: 0, y: 0 }, { t: 25.4, ay: 0, y: pq.h - H / sP }]) });
    const cont = legenda('<b class="pm-c">1</b> blocos de informação. Todos com fonte oficial.', P.icones.book, 20.8, 25.2);
    cont.quadro = (t, it) => { const n = Math.max(1, Math.round(N.blocos * io(prog(t, 20.9, 24.6)))); const b = it.e.querySelector('.pm-c'); if (b.textContent !== String(n)) b.textContent = n; };
    varrer(20.15);
    atalho('Abrir a visão geral ↗', '../#visao', 20.8, 25.2);

    // ===================== CENA 3 · INDICADORES (25–50 s)
    // a) juro real
    const fb = 'visao-barras', cardB = caixa(fb, 'card');
    const barrasTomada = tomada({ id: 'barras', t0: 25.0, t1: 31.8, frames: [{ t: 0, f: fb }, { t: 29.4, f: 'visao-barras-2020', d: 0.5 }],
      cam: chaves(fb, [{ t: 25, x: centro(cardB)[0], y: centro(cardB)[1], ax: 0.36 }, { t: 31.8, z: 1.1 }]) });
    const nb = quadro(fb).caixas.barras.length;
    destaque('barras', fb, caixa(fb, 'barras', nb - 1), 26.6, 29.3, { pad: 10 });
    barrasTomada.pulsos = [26.6, 29.5];
    destaque('barras', 'visao-barras-2020', uniao([caixa(fb, 'barras', 3), caixa('visao-barras-2020', 'chip')]), 29.7, 31.6, { pad: 10, leve: true });
    varrer(24.95);
    const lider = N.rank.posicao_brasil === 1;
    slam(25.0, 26.2, P.pct(N.real), COR.azul, 'Juro real hoje', lider ? 'O maior do mundo entre ' + N.rank.paises_no_ranking + ' países' : 'Selic de ' + P.pct(N.selic) + ' descontada a inflação de ' + P.pct(N.ipca));
    const rk = N.rank.paises, rkMax = Math.max(...rk.map((x) => x[1]));
    cartaoAnim({ olho: 'Juro real', de: 0, para: N.real, fmt: (v) => P.pct(v), t0: 26.05, t1: 29.3,
      linhas: ['Selic de ' + P.pct(N.selic) + ' menos a inflação de ' + P.pct(N.ipca) + '.', lider ? 'O Brasil lidera o ranking mundial.' : 'O Brasil é o ' + N.rank.posicao_brasil + 'º do ranking mundial.'],
      extra: '<div class="mini"><div class="mini-rot"><span>Ranking de juro real · ' + N.rank.paises_no_ranking + ' países</span><span>' + N.rank.posicao_brasil + 'º</span></div>'
        + rk.map((x, i) => '<div class="mini-linha' + (x[0] === 'Brasil' ? ' br' : '') + '"><span>' + x[0] + '</span><span>' + P.pct(x[1]) + '</span></div><div class="mini-trilho"><i class="r' + i + (x[0] === 'Brasil' ? ' az' : '') + '"></i></div>').join('') + '</div>',
      anima: (t, e) => rk.forEach((x, i) => larg(e, '.r' + i, x[1] / rkMax * 100 * sai(prog(t, 26.5 + i * 0.12, 27.3 + i * 0.12)))),
      fonte: 'BCB · IBGE · Moneyou via Agência Brasil' });
    flash(29.4, 0.05);
    cartaoItem(cartao('Mas em 2020…', P.pct(N.real2020), ['O juro real ficou negativo: a inflação passou da Selic.', 'Passe o mouse nas barras e veja a conta de cada ano.'], 'BCB · IBGE · cálculo do painel'), 29.6, 31.6);
    atalho('Ver no painel ↗', '../#visao', 26.0, 31.4, { right: '40px', top: '40px' });

    // b) inflação contra a meta
    const fi = 'visao-inflacao', cardI = caixa(fi, 'card');
    const inflTomada = tomada({ id: 'inflacao', t0: 31.6, t1: 37.8, frames: [{ t: 0, f: fi }],
      cam: chaves(fi, [{ t: 31.6, x: centro(cardI)[0], y: centro(cardI)[1], ax: 0.36 }, { t: 37.8, z: 1.1 }]) });
    destaque('inflacao', fi, uniao([caixa(fi, 'ultimo'), [caixa(fi, 'ultimo')[0] - 40, caixa(fi, 'ultimo')[1] - 30, 160, 80]]), 33.0, 35.0, { pad: 8, pilula: true });
    if (quadro(fi).caixas.contador && quadro(fi).caixas.contador.length) destaque('inflacao', fi, caixa(fi, 'contador'), 35.2, 37.6, { pad: 10, pilula: true });
    atalho('Ver no painel ↗', '../#visao', 32.2, 37.4, { right: '40px', top: '40px' });
    varrer(31.55);
    slam(31.6, 32.8, P.pct(N.ipca), COR.ambar, 'Inflação em 12 meses', N.ipca > 4.5 ? 'Estourou o teto da meta' : 'Dentro da meta');
    const pos6 = (v) => clamp(v / 6) * 100;
    cartaoAnim({ olho: 'Inflação', de: 0, para: N.ipca, fmt: (v) => P.pct(v), t0: 32.65, t1: 37.6,
      linhas: ['IPCA em 12 meses até ' + P.mesLongo(N.ipcaMes) + (N.ipca > 4.5 ? ', acima do teto de 4,5%.' : '.'), 'Seis meses seguidos fora da banda e a meta é descumprida. O painel conta para você.'],
      extra: '<div class="medidor"><div class="banda" style="left:' + pos6(1.5) + '%;width:' + (pos6(4.5) - pos6(1.5)) + '%"></div><div class="linha-v" style="left:' + pos6(3) + '%"></div><div class="marca-v" style="left:0;background:' + (N.ipca > 4.5 ? COR.ambar : COR.osso) + '"></div></div>'
        + '<div class="mini-rot"><span>0%</span><span>banda 1,5% a 4,5% · meta 3%</span><span>6%</span></div>',
      anima: (t, e) => { e.querySelector('.marca-v').style.left = (pos6(N.ipca) * sai(prog(t, 32.9, 34.0))).toFixed(2) + '%'; },
      fonte: 'IBGE via BCB · Decreto 12.079/2024' });
    inflTomada.pulsos = [33.0, 35.2];

    // c) expectativas (Focus): o maior movimento da Selic esperada na semana
    const fm2 = 'exp-mudancas', cardM = caixa(fm2, 'card');
    const mudTomada = tomada({ id: 'mudancas', t0: 37.6, t1: 43.8, frames: [{ t: 0, f: fm2 }],
      cam: chaves(fm2, [{ t: 37.6, x: centro(cardM)[0], y: centro(cardM)[1], ax: 0.66 }, { t: 43.8, z: 1.12 }]) });
    const MS = N.movSelic || { ano: N.ano1, mediana: N.S1, antes: N.S1antes, idx: N.idxSelic1, variacao: N.S1 - N.S1antes };
    if (MS.idx >= 0 && quadro(fm2).caixas.itens[MS.idx]) destaque('mudancas', fm2, caixa(fm2, 'itens', MS.idx), 38.9, 43.5, { pad: 8 });
    varrer(37.55);
    const semCorte = MS.ano === D.focus.anos[0] && MS.mediana >= N.selic;
    slam(37.6, 38.8, P.comSinal(MS.variacao, 2) + ' p.p.', COR.azul, 'Em uma semana', semCorte ? 'o mercado desistiu de cortar a Selic em ' + MS.ano : 'mudou a Selic esperada para o fim de ' + MS.ano);
    cartaoAnim({ olho: 'Expectativas · Focus', de: MS.antes, para: MS.mediana, fmt: (v) => P.pct(v), t0: 38.65, t1: 43.6, esq: true,
      linhas: ['Selic esperada para o fim de ' + MS.ano + '.', semCorte ? 'Igual à de hoje: sem corte até o fim do ano.' : 'IPCA esperado para ' + N.ano1 + ': ' + P.pct(N.I1) + '.'],
      extra: '<div class="de-para"><span>semana anterior ' + P.pct(MS.antes) + '</span><span>→</span><b>' + P.pct(MS.mediana) + '</b></div>',
      fonte: 'BCB · Boletim Focus (coleta até ' + P.ddmm(N.coleta) + ')' });
    mudTomada.pulsos = [38.9];
    atalho('Abrir Expectativas ↗', '../#expectativas', 38.4, 43.4, { right: '40px', bottom: '150px' });

    // d) bolsa: distância do recorde e volatilidade
    const fo = 'visao-ibov', cardO = caixa(fo, 'card');
    const ibovTomada = tomada({ id: 'ibov', t0: 43.6, t1: 47.4, frames: [{ t: 0, f: fo }],
      cam: chaves(fo, [{ t: 43.6, x: centro(cardO)[0], y: centro(cardO)[1], ax: 0.36 }, { t: 47.4, z: 1.08 }]) });
    destaque('ibov', fo, caixa(fo, 'legenda'), 44.6, 47.1, { pad: 10 });
    atalho('Ver no painel ↗', '../#visao', 44.2, 50.0, { right: '40px', top: '40px' });
    varrer(43.55);
    slam(43.6, 44.8, P.comSinal(N.distMax) + '%', COR.ambar, 'Ibovespa', 'Longe do recorde de ' + P.ddmmaaaa(P.dia(N.maxH.data)));
    const fr = N.ibov / N.maxH.valor * 100;
    cartaoAnim({ olho: 'Bolsa', de: 0, para: N.distMax, fmt: (v) => P.comSinal(v) + '%', t0: 44.65, t1: 47.2,
      linhas: ['Quanto falta para o Ibovespa voltar ao topo.'],
      extra: '<div class="mini"><div class="mini-rot"><span>' + P.ddmm(N.ibovData) + ': ' + P.fmtPts(N.ibov) + '</span><span>recorde ' + P.fmtPts(N.maxH.valor) + ' (' + P.ddmm(P.dia(N.maxH.data)) + ')</span></div><div class="mini-trilho" style="height:16px"><i class="f"></i></div></div>',
      anima: (t, e) => larg(e, '.f', 100 - (100 - fr) * sai(prog(t, 44.9, 45.9))),
      fonte: 'B3 · Ibovespa' });
    ibovTomada.pulsos = [44.6];
    const fmd = 'visao-medo';
    const medoTomada = tomada({ id: 'medo', t0: 47.2, t1: 50.4, fi: 0.5, frames: [{ t: 0, f: fmd }],
      cam: chaves(fmd, [{ t: 47.2, x: centro(caixa(fmd, 'medo'))[0], y: centro(caixa(fmd, 'medo'))[1], z: 1.25, ax: 0.32 }, { t: 50.4, z: 1.35 }]) });
    if (quadro(fmd).caixas.pill.length) destaque('medo', fmd, caixa(fmd, 'pill'), 48.0, 50.1, { pad: 8, pilula: true });
    varrer(47.15);
    slam(47.2, 48.2, P.fmt(N.volPct, 0) + '%', COR.ambar, 'A bolsa está nervosa', 'Oscila mais que em ' + P.fmt(N.volPct, 0) + '% dos pregões desde 2000');
    cartaoAnim({ olho: 'Volatilidade', de: 0, para: N.vol, fmt: (v) => P.pct(v, 1), t0: 48.05, t1: 50.1,
      linhas: ['Sobe e desce do Ibovespa em 21 pregões, ao ano.'],
      extra: '<div class="mini"><div class="mini-rot"><span>pregões desde 2000</span><span>maior que ' + P.fmt(N.volPct, 0) + '%</span></div><div class="mini-trilho" style="height:16px"><i class="p am"></i></div></div>',
      anima: (t, e) => larg(e, '.p', N.volPct * sai(prog(t, 48.3, 49.2))),
      fonte: 'B3 · cálculo do painel' });
    medoTomada.pulsos = [48.0];

    // ===================== CENA 4 · INTERATIVIDADE (50–70 s)
    // a) navegação entre abas (sequência real da página entrando)
    const seqNav = MF.sequencias['nav-exp'];
    const tNav = 51.9;
    varrer(49.95);
    tomada({ id: 'nav', pulsos: [51.75], t0: 50.0, t1: 54.4, fi: 0.5, frames: [{ t: 0, f: 'visao-topo' }].concat(seqNav.map((s) => ({ t: tNav + s.ms / 1000, f: s.frame, d: 0.14 }))).concat([{ t: tNav + 1.9, f: 'exp-topo', d: 0.3 }]),
      cam: chaves('visao-topo', [{ t: 50, z: 1.0 }]) });
    K.push({ t: 50.4, x: 1500, y: 900 }, { t: 51.6, id: 'nav', alvo: caixa('visao-topo', 'nav', 1) }, { t: 53.9, id: 'nav', alvo: caixa('visao-topo', 'nav', 1) });
    CL.push(51.75);
    legenda('Um clique e você está nas expectativas do mercado', P.icones.home, 50.5, 54.2);
    atalho('Experimente no painel ↗', '../#expectativas', 50.6, 54.2, { right: '40px', top: '40px' });

    // b) histórico do Focus: troca de indicador (linha desenhada de novo) e de ano
    const fh = 'exp-hist-ipca', cardH = caixa(fh, 'card');
    const seqH = MF.sequencias['hist-selic'];
    const tH = 55.6;
    varrer(54.15);
    tomada({ id: 'hist', pulsos: [55.55, 57.6], t0: 54.2, t1: 58.6, fi: 0.5, frames: [{ t: 0, f: fh }].concat(seqH.map((s) => ({ t: tH + 0.05 + s.ms / 1000, f: s.frame, d: 0.12 }))).concat([{ t: tH + 1.2, f: 'exp-hist-selic', d: 0.25 }, { t: 57.7, f: 'exp-hist-selic-2028', d: 0.45 }]),
      cam: chaves(fh, [{ t: 54.2, x: centro(cardH)[0], y: centro(cardH)[1], z: 1.4 }]) });
    K.push({ t: 54.5, id: 'hist', alvo: caixa(fh, 'segs', 0) }, { t: 55.4, id: 'hist', alvo: caixa(fh, 'segs', 1) }, { t: 57.4, id: 'hist', alvo: caixa(fh, 'segs', 6) }, { t: 58.2, id: 'hist', alvo: caixa(fh, 'segs', 6) });
    CL.push(55.55, 57.6);
    legenda('Troque o indicador. Mude o ano. Veja a aposta do mercado mudar', P.icones.target, 54.6, 58.4);
    atalho('Experimente no painel ↗', '../#expectativas', 54.6, 58.4, { right: '40px', top: '40px' });

    // c) período do gráfico de inflação
    const fin = 'visao-inflacao';
    varrer(58.35);
    tomada({ id: 'periodo', pulsos: [59.8], t0: 58.4, t1: 62.2, fi: 0.5, frames: [{ t: 0, f: fin }, { t: 59.9, f: 'visao-inflacao-desde', d: 0.5 }],
      cam: chaves(fin, [{ t: 58.4, x: centro(cardI)[0], y: centro(cardI)[1] - 120, z: 1.35 }]) });
    K.push({ t: 58.7, id: 'periodo', alvo: caixa(fin, 'segs', 1) }, { t: 59.6, id: 'periodo', alvo: caixa(fin, 'segs', 2) }, { t: 61.8, id: 'periodo', alvo: caixa(fin, 'segs', 2) });
    CL.push(59.8);
    legenda('Volte no tempo: 12 meses, 3 anos ou desde 2017', P.icones.calendar, 58.6, 62.0);
    atalho('Experimente no painel ↗', '../#visao', 58.6, 62.0, { right: '40px', top: '40px' });

    // d) simulador: e se a Selic cair? (o controle foi arrastado de verdade na captura)
    const fsm = 'sim-a', cardSm = caixa(fsm, 'card');
    varrer(61.95);
    tomada({ id: 'sim', pulsos: [63.4, 65.1], t0: 62.0, t1: 66.4, fi: 0.5, frames: [{ t: 0, f: fsm }, { t: 63.5, f: 'sim-b', d: 0.35 }, { t: 65.2, f: 'sim-c', d: 0.35 }],
      cam: chaves(fsm, [{ t: 62.0, x: centro(cardSm)[0], y: centro(cardSm)[1], z: 1.9, ay: 0.46 }]) });
    K.push({ t: 62.3, id: 'sim', alvo: caixa(fsm, 'polegar') }, { t: 62.9, id: 'sim', alvo: caixa(fsm, 'polegar') }, { t: 63.5, id: 'sim', alvo: caixa('sim-b', 'polegar') },
      { t: 64.6, id: 'sim', alvo: caixa('sim-b', 'polegar') }, { t: 65.2, id: 'sim', alvo: caixa('sim-c', 'polegar') }, { t: 66.0, id: 'sim', alvo: caixa('sim-c', 'polegar') });
    CL.push(63.0, 64.7);
    destaque('sim', 'sim-c', caixa('sim-c', 'resultado'), 65.4, 66.2, { pad: 10 });
    legenda('E se a Selic cair? Simule e veja o juro real mudar', P.icones.trend, 62.2, 66.2);
    atalho('Experimente no painel ↗', '../#visao', 62.2, 66.2, { right: '40px', top: '40px' });

    // e) o "?" de cada bloco: explicação simples, sem jargão
    const fe = 'visao-ajuda', cardE = caixa(fb, 'card');
    varrer(66.15);
    tomada({ id: 'explica', pulsos: [67.2], t0: 66.2, t1: 70.4, fi: 0.5, frames: [{ t: 0, f: fb }, { t: 67.3, f: fe, d: 0.5 }],
      cam: chaves(fb, [{ t: 66.2, x: centro(cardE)[0], y: caixa(fb, 'ajuda')[1] + 300, z: 1.25, ay: 0.4 }]) });
    K.push({ t: 66.4, x: 1200, y: 760 }, { t: 67.0, id: 'explica', alvo: caixa(fb, 'ajuda'), fim: 67.9 });
    CL.push(67.2);
    destaque('explica', fe, caixa(fe, 'explica'), 68.2, 70.2, { pad: 8, leve: true });
    legenda('Ficou com dúvida? Toque no ? e entenda cada número', P.icones.book, 66.4, 70.2);
    atalho('Ver as fontes ↗', '../#metodologia', 66.4, 70.2, { right: '40px', top: '40px' });

    // ===================== CENA 5 · ENCERRAMENTO (70–85 s)
    const mont = [['exp-contexto', 330, -250], ['agenda', 520, 40], ['met-referencias', 360, 300]];
    mont.forEach(([f, ox, oy], i) => tomada({ id: 'm' + i, t0: 70.3 + i * 0.25, t1: 80.8, fi: 0.9, frames: [{ t: 0, f }],
      cam: chaves(f, [{ t: 70.3, jan: 0.40, ox: ox + 40, oy: oy + 30 }, { t: 80.8, jan: 0.42, ox, oy }]) }));
    item('Dados oficiais. Atualizados todo dia útil.', 'titulo', 70.8, 76.0, { left: '120px', top: '400px', width: '820px' });
    item('Explore, compare e tire suas próprias conclusões.', 'titulo-m', 76.2, 80.6, { left: '120px', top: '380px', width: '860px' });

    flash(80.9, 0.08);
    const fimMarca = item('<div class="icone vidro"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ededed" style="stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + ICONE + '"/></svg></div><div class="nome">Painel Macro Brasil</div>',
      'marca', 80.9, 85.5, { left: '50%', top: '370px' });
    fimMarca.base = 'translateX(-50%)';
    const url = (M.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const pu = item('<span class="ponto" style="background:#8fb0ff"></span>' + url, 'pilula vidro', 81.4, 85.5, { left: '50%', top: '520px' });
    pu.base = 'translateX(-50%)';
    const fl = item('Fontes: Banco Central · IBGE · B3 · Tesouro Nacional · Dados de ' + P.ddmmaaaa(N.dataRef), 'fonte-linha', 81.8, 85.5, { left: '50%', top: '640px', fontSize: '20px', whiteSpace: 'nowrap' });
    fl.base = 'translateX(-50%)';
    atalho('Abrir o painel ↗', '../', 81.6, 999, { left: '50%', top: '730px' }).base = 'translateX(-110%)';
    atalho('Ver as fontes', '../#metodologia', 81.6, 999, { left: '50%', top: '730px' }, true).base = 'translateX(8%)';

    // faixa de cotações com dados reais do painel (estilo terminal), com o capítulo em curso à esquerda
    const E = D.economia || {}, T = D.tesouro, F0 = D.focus;
    const f0 = (ind, k) => F0.tabela.find((r) => r.indicador === ind).valores[k];
    const setaT = (v) => (v == null || v === 0 ? '' : (v > 0 ? '▲ ' : '▼ ') + P.fmt(Math.abs(v)));
    const ult6 = D.ibovespa.ultimos_dias.slice(-6);
    const cot = [
      ['Selic', P.pct(N.selic), COR.osso, ''], ['IPCA 12m', P.pct(N.ipca), COR.ambar, P.mesCurto(N.ipcaMes)], ['Juro real', P.pct(N.real), COR.azul, ''],
      ['Focus IPCA ' + F0.anos[0], P.pct(f0('IPCA', 0).mediana), COR.ambar, setaT(f0('IPCA', 0).variacao)],
      ['Focus Selic ' + F0.anos[1], P.pct(f0('Selic', 1).mediana), COR.osso, setaT(f0('Selic', 1).variacao)],
      ['Ibovespa', P.fmtPts(N.ibov), COR.osso, P.comSinal((ult6[5].valor / ult6[0].valor - 1) * 100) + '% 5d'],
      E.dolar ? ['Dólar', P.reais(E.dolar.valor), COR.osso, ''] : null,
      E.ibcbr ? ['IBC-Br 12m', P.comSinal(E.ibcbr.historico[E.ibcbr.historico.length - 1].valor) + '%', COR.osso, ''] : null,
      E.divida ? ['Dívida bruta', P.pct(E.divida.historico[E.divida.historico.length - 1].valor, 1), COR.osso, 'do PIB'] : null,
      T ? ['Tesouro IPCA+ ' + T.atual.venc_ipca.slice(0, 4), P.pct(T.atual.real), COR.azul, 'real'] : null,
      T ? ['Inflação implícita', P.pct(T.atual.implicita), COR.ambar, ''] : null,
    ].filter(Boolean);
    const fitaHtml = cot.map((c) => '<span class="q"><span class="r">' + c[0] + '</span><span class="v" style="color:' + c[2] + '">' + c[1] + '</span>' + (c[3] ? '<span class="d">' + c[3] + '</span>' : '') + '</span>').join('');
    item('<div class="cap"><span class="num">02/05</span><span class="nome">O painel</span></div><div class="janela-t"><div class="fita"><div class="copia">' + fitaHtml + '</div><div class="copia">' + fitaHtml + '</div><div class="copia">' + fitaHtml + '</div></div></div>',
      'ticker', 12.9, 70.4, {}, { sobe: false, fi: 0.5, fo: 0.4, quadro: (t, it) => {
        if (!it.larg) it.larg = it.e.querySelector('.copia').offsetWidth || 3000;
        const x = -((t - 12.9) * 120 % it.larg);
        it.e.querySelector('.fita').style.transform = 'translateX(' + x.toFixed(1) + 'px)';
        const i = CAPITULOS.filter((c) => t >= c[0]).length - 1;
        const num = it.e.querySelector('.cap .num'), nome = it.e.querySelector('.cap .nome');
        if (nome.textContent !== CAPITULOS[i][1]) { num.textContent = '0' + (i + 1) + '/05'; nome.textContent = CAPITULOS[i][1]; }
        const sobe = sai(prog(t, 12.9, 13.5));
        it.e.style.transform = 'translateY(' + ((1 - sobe) * 60).toFixed(1) + 'px)';
      } });
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
