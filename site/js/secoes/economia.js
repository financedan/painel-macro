/*
 * secoes/economia.js — blocos da aba "Economia": juros na história, inflação em detalhe,
 * atividade, emprego, contas públicas, câmbio e mundo.
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});
  const { AZUL, AMBAR, OSSO } = P.cores;

  // ---------- linha do tempo da Selic e o ciclo atual
  S.selicLinha = (c) => {
    const D = c.D, mud = D.selic.mudancas;
    if (!mud || !mud.length) throw new Error('sem mudanças da Selic');
    const fm = D.selic.fim_de_mes;
    const inicio = P.dia(fm[0].mes + '-01'), fim = c.hoje;
    const L = 48, R = 700, T = 14, B = 226;
    const X = (d) => L + (d - inicio) / ((fim - inicio) || 1) * (R - L);
    const vals = [fm[0].valor, ...mud.map((m) => m.para)];
    const topo = Math.ceil(Math.max(...vals) / 4) * 4;
    const Y = (v) => T + (topo - v) / topo * (B - T);
    // valor no início: o "de" da primeira mudança depois do início
    const primeira = mud.find((m) => P.dia(m.vigencia) > inicio);
    let v = primeira ? primeira.de : fm[0].valor;
    const pts = [[X(inicio), Y(v)]];
    const marcas = [];
    mud.filter((m) => P.dia(m.vigencia) > inicio).forEach((m) => {
      const x = X(P.dia(m.vigencia));
      pts.push([x, Y(v)], [x, Y(m.para)]);
      marcas.push({ x: x.toFixed(1), y: Y(m.para).toFixed(1), fill: m.para < m.de ? AZUL : AMBAR });
      v = m.para;
    });
    pts.push([X(fim), Y(v)]);
    const ticks = [];
    for (let t = 0; t <= topo; t += 4) ticks.push({ y: Y(t).toFixed(1), ty: (Y(t) + 4).toFixed(1), label: t + '%' });
    const xlabels = [];
    for (let a = inicio.getFullYear() + 1; a <= fim.getFullYear(); a++) xlabels.push({ x: X(new Date(a, 0, 1)).toFixed(1), label: String(a) });

    // ciclo atual: mudanças seguidas na mesma direção, da mais recente para trás
    const dir = Math.sign(mud[mud.length - 1].para - mud[mud.length - 1].de);
    let k = mud.length - 1;
    while (k > 0 && Math.sign(mud[k - 1].para - mud[k - 1].de) === dir) k--;
    const ciclo = mud.slice(k), total = ciclo[ciclo.length - 1].para - ciclo[0].de;
    const nome = dir < 0 ? 'cortes' : 'altas';
    return {
      selicPath: P.caminho(pts), selicMarcas: marcas, selicTicks: ticks, selicXlabels: xlabels,
      selicLastX: (X(fim) + 8).toFixed(1), selicLastY: Y(v).toFixed(1), selicLastLabelY: (Y(v) + 4).toFixed(1), selicLastTxt: P.pct(v),
      cicloTitulo: 'Ciclo de ' + nome, cicloValor: P.comSinal(total, 2) + ' p.p.',
      cicloTxt: 'Começou na decisão de ' + P.ddmmaaaa(P.dia(ciclo[0].decisao)) + ': ' + ciclo.length + (ciclo.length === 1 ? (dir < 0 ? ' corte' : ' alta') : ' ' + nome) + ', de ' + P.pct(ciclo[0].de) + ' para ' + P.pct(ciclo[ciclo.length - 1].para) + '.',
      decisoesRecentes: mud.slice(-6).reverse().map((m) => ({
        data: P.ddmmaaaa(P.dia(m.decisao)), de: P.pct(m.de), para: P.pct(m.para),
        mov: (m.para < m.de ? '▼ corte de ' : '▲ alta de ') + P.pp(m.para - m.de),
      })),
      selicAria: 'Selic em degraus desde ' + inicio.getFullYear() + ', com cada decisão do Copom que mudou a taxa',
    };
  };

  // ---------- IPCA por grupo
  S.grupos = (c) => {
    const G = c.D.ipca_grupos;
    if (!G) throw new Error('sem IPCA por grupo');
    const mx = Math.max(...G.itens.map((g) => Math.abs(g.doze_meses)), 6);
    return {
      gruposMes: P.mesLongo(G.mes),
      gruposLista: G.itens.map((g) => ({
        nome: g.nome, peso: 'peso ' + P.fmt(g.peso, 1) + '%',
        doze: P.pct(g.doze_meses), mes: P.comSinal(g.mes, 2) + '% no mês · contribuiu ' + P.comSinal(g.contribuicao_mes, 2) + ' p.p.',
        barStyle: 'width: ' + (Math.abs(g.doze_meses) / mx * 100).toFixed(1) + '%; height: 100%; border-radius: 9999px; background: ' + (g.doze_meses > 4.5 ? AMBAR : 'rgba(237,237,237,.45)'),
      })),
      gruposCaption: 'Em laranja, os grupos com alta acima do teto da meta (4,5%) em 12 meses. O que mais pesou em ' + P.nomeMes(G.mes) + ': '
        + G.itens.slice().sort((a, b) => b.contribuicao_mes - a.contribuicao_mes)[0].nome.toLowerCase() + '.',
    };
  };

  // ---------- IPCA x média dos núcleos
  S.nucleos = (c) => {
    const N = c.D.nucleos;
    if (!N || !N.historico.length) throw new Error('sem núcleos');
    const ipca = {};
    c.D.ipca12m.historico.forEach((x) => { ipca[x.mes] = x.valor; });
    const h = N.historico.slice(-36);
    const g = P.linhas([
      { valores: h.map((x) => ipca[x.mes] ?? null), cor: AMBAR, lastTxt: P.pct(ipca[h[h.length - 1].mes]) },
      { valores: h.map((x) => x.valor), cor: OSSO, tracejado: '5 5', lastTxt: P.pct(h[h.length - 1].valor) },
    ], h.map((x) => P.mesCurto(x.mes)), { L: 44, R: 680, T: 14, B: 196 }, { chave: 'nuc', passo: 1, maxRotulos: 6, incluir: [3] });
    const ult = h[h.length - 1].valor, ip = ipca[h[h.length - 1].mes];
    return {
      nuc: g, nucMetaY: g.Y(3).toFixed(1),
      nucCaption: 'Em ' + P.mesLongo(h[h.length - 1].mes) + ', a média dos núcleos (' + N.nomes.join(', ') + ') estava em ' + P.pct(ult) + ', '
        + (ult < ip ? 'abaixo do IPCA cheio: parte da alta vem de preços voláteis.' : 'acima ou igual ao IPCA cheio: a inflação está espalhada, não só em itens voláteis.'),
    };
  };

  // ---------- dólar, atividade e dívida (cartões com mini gráfico, na Visão geral)
  S.economiaCards = (c) => {
    const E = c.D.economia;
    if (!E) throw new Error('sem dados de economia');
    const spark = (arr) => {
      const mn = Math.min(...arr), mx = Math.max(...arr);
      const linha = P.caminho(arr.map((v, i) => [i / (arr.length - 1) * 200, 35 - (v - mn) / ((mx - mn) || 1) * 28]));
      return { line: linha, area: linha + ' L200 40 L0 40 Z' };
    };
    const ult = (h) => h[h.length - 1];
    const ha12 = (h) => h[Math.max(0, h.length - 13)];
    const defs = [
      { label: 'Dólar (PTAX)', display: P.reais(E.dolar.valor), note: P.ddmm(P.dia(E.dolar.data)) + ' · ' + P.comSinal((E.dolar.valor / ha12(E.dolar.historico).valor - 1) * 100) + '% em 12 meses', arr: E.dolar.historico.map((x) => x.valor), color: OSSO, icon: P.icones.trend, numCls: 'pm-conta', sparkCls: '' },
      { label: 'Atividade (IBC-Br)', display: P.comSinal(ult(E.ibcbr.historico).valor) + '%', note: P.maiuscula(P.mesLongo(ult(E.ibcbr.historico).mes)) + ' · 12 meses contra os 12 anteriores', arr: E.ibcbr.historico.map((x) => x.valor), color: AZUL, icon: P.icones.pulse, numCls: '', sparkCls: 'pm-wipe' },
      { label: 'Dívida bruta', display: P.pct(ult(E.divida.historico).valor, 1), note: '% do PIB · ' + P.mesLongo(ult(E.divida.historico).mes) + ' · ' + P.comSinal(ult(E.divida.historico).valor - ha12(E.divida.historico).valor) + ' p.p. em 12 meses', arr: E.divida.historico.map((x) => x.valor), color: AMBAR, icon: P.icones.percent, numCls: 'pm-pop', sparkCls: 'pm-sobe' },
    ];
    return {
      econCards: defs.map((k, i) => Object.assign({ cardStyle: 'animation-delay: ' + (120 + i * 90) + 'ms' }, k, spark(k.arr))),
    };
  };

})();
