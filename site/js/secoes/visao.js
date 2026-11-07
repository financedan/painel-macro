/*
 * secoes/visao.js — blocos da aba "Visão geral".
 * Cada função recebe o contexto comum (painel.js) e devolve os {{campos}} do seu bloco.
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});
  const { AZUL, AMBAR, OSSO, HIST, HIST_ON } = P.cores;
  const TETO = 4.5, PISO = 1.5;
  const faixaMeta = (v) => (v > TETO ? 'acima do teto da meta (4,5%)' : v < PISO ? 'abaixo do piso da meta (1,5%)' : 'dentro da banda da meta (1,5% a 4,5%)');
  const mudancaSelic = (c) => {
    const D = c.D;
    const decisao = D.selic.decisao ? P.dia(D.selic.decisao) : P.somaDias(P.dia(D.selic.desde), -1);
    const anterior = D.selic.anterior ?? null;
    return { decisao, anterior, tipo: anterior == null ? null : (c.selic < anterior ? 'corte' : 'alta') };
  };
  const tagReuniao = (c, reuniao) => c.decisoes.find((d) => d.reuniao === reuniao);

  // ---------- cabeçalho da visão geral
  S.hero = (c) => {
    const p = c.proximo;
    let copomShort = 'Próximo Copom: calendário ainda não cadastrado';
    if (p) {
      const dias = P.difDias(p.data, c.hoje);
      copomShort = dias === 0 ? 'Decisão do Copom hoje' : 'Próximo Copom: decisão em ' + P.ddmm(p.data) + ' · em ' + dias + (dias === 1 ? ' dia' : ' dias');
    }
    const ultimaDecisao = c.decisoes.length ? c.decisoes[c.decisoes.length - 1].data : null;
    if (!P._avisouCopom && (!ultimaDecisao || P.difDias(ultimaDecisao, c.hoje) < 60)) P._avisouCopom = true, console.warn('manual.json: o calendário do Copom termina em menos de 60 dias. Acrescente as próximas reuniões.');
    return {
      subtitle: 'IPCA até ' + P.mesLongo(c.ipcaMes) + ' · Focus com coleta até ' + P.ddmm(c.coleta) + ' · Ibovespa até ' + P.ddmm(c.ibovData)
        + ' · atualizado em ' + c.atualizado.ddmm + ' às ' + c.atualizado.hora + ' (Brasília)',
      copomShort: copomShort,
    };
  };

  // ---------- alertas do sino, incluindo "desde a sua última visita"
  S.alertas = (c) => {
    const { selic, ipca, S: Sf, anos } = c;
    const m = mudancaSelic(c);
    const lista = [];
    const add = (texto, cor, novidade) => lista.push({ id: texto, text: texto, novidade: !!novidade, dotStyle: 'width: 8px; height: 8px; margin-top: 7px; border-radius: 9999px; flex: 0 0 auto; background: ' + cor });

    const v = c.visita;
    if (v) {
      if (v.selic !== selic) add('Selic mudou de ' + P.pct(v.selic) + ' para ' + P.pct(selic) + ' desde a sua visita de ' + P.ddmm(P.dia(v.visto)) + '.', AZUL, true);
      if (v.ipcaMes !== c.ipcaMes) add('Saiu o IPCA de ' + c.ipcaMesNome + ': ' + P.pct(ipca) + ' em 12 meses (antes, ' + P.pct(v.ipca) + ').', AMBAR, true);
      if (v.coleta !== c.F.coleta_ate && v.focusAno === c.I[0].ano && v.focusIpca !== c.I[0].mediana) add('Novo Focus: IPCA de ' + c.I[0].ano + ' foi de ' + P.pct(v.focusIpca) + ' para ' + P.pct(c.I[0].mediana) + '.', AZUL, true);
      else if (v.coleta !== c.F.coleta_ate) add('Saiu um novo Boletim Focus (coleta até ' + P.ddmm(c.coleta) + ').', AZUL, true);
      if (v.ibovData !== c.B.data && v.ibov) add('Ibovespa ' + P.comSinal((c.B.fechamento / v.ibov - 1) * 100) + '% desde a sua visita de ' + P.ddmm(P.dia(v.visto)) + '.', OSSO, true);
    }
    if (c.ultimo && m.tipo) {
      add(c.ultimo.data > m.decisao
        ? 'Copom manteve a Selic em ' + P.pct(selic) + ' em ' + P.ddmm(c.ultimo.data) + '.'
        : 'Copom ' + (m.tipo === 'corte' ? 'cortou' : 'subiu') + ' a Selic de ' + P.pct(m.anterior) + ' para ' + P.pct(selic) + ' em ' + P.ddmm(m.decisao) + '.', OSSO);
    }
    add('IPCA em 12 meses (' + P.pct(ipca) + ') está ' + faixaMeta(ipca).replace(' (4,5%)', ' de 4,5%').replace(' (1,5%)', ' de 1,5%') + '.', ipca > TETO ? AMBAR : OSSO);
    if (c.proximo) {
      const dias = P.difDias(c.proximo.data, c.hoje);
      add('Copom decide a Selic ' + (dias === 0 ? 'hoje.' : 'em ' + P.ddmm(c.proximo.data) + ' (em ' + dias + (dias === 1 ? ' dia' : ' dias') + ').'), OSSO);
    }
    if (Sf[1].variacao != null) {
      add(Sf[1].variacao === 0 ? 'Focus: Selic esperada para o fim de ' + anos[1] + ' ficou estável em ' + P.pct(Sf[1].mediana) + '.'
        : 'Focus: Selic esperada para o fim de ' + anos[1] + (Sf[1].variacao > 0 ? ' subiu' : ' caiu') + ' de ' + P.pct(c.antes(Sf[1])) + ' para ' + P.pct(Sf[1].mediana) + '.', AZUL);
    }
    const ult = c.B.ultimos_dias.slice(-6);
    const semana = (ult[ult.length - 1].valor / ult[0].valor - 1) * 100;
    add('Ibovespa ' + (semana >= 0 ? 'subiu ' : 'caiu ') + P.fmt(Math.abs(semana), 1) + '% nos últimos cinco pregões.', semana < -3 ? AMBAR : OSSO);

    const novidades = lista.filter((a) => a.novidade);
    return {
      alertasLista: novidades.concat(lista.filter((a) => !a.novidade)),
      hasNovidades: novidades.length > 0, novidadesTitulo: v ? 'Desde a sua visita de ' + P.ddmm(P.dia(v.visto)) : '',
      novidadesChip: novidades.length + (novidades.length === 1 ? ' novidade' : ' novidades') + ' desde a sua última visita',
    };
  };

  // ---------- os seis números do topo
  S.kpis = (c) => {
    const { D, selic, ipca, neutro, I, S: Sf, B, anos } = c;
    const m = mudancaSelic(c);
    const hist = D.ipca12m.historico, ip12 = hist.slice(-12);
    const selicMes = {};
    (D.selic.fim_de_mes || []).forEach((x) => { selicMes[x.mes] = x.valor; });
    const sel12 = ip12.map((x) => selicMes[x.mes] ?? selic);
    const real12 = sel12.map((v, i) => P.fisher(v, ip12[i].valor));
    const spark = (arr) => {
      const mn = Math.min(...arr), mx = Math.max(...arr);
      const linha = P.caminho(arr.map((v, i) => [i / (arr.length - 1) * 200, 35 - (v - mn) / ((mx - mn) || 1) * 28]));
      return { line: linha, area: linha + ' L200 40 L0 40 Z' };
    };
    const selicNota = !m.tipo ? 'Sem mudança no período'
      : (c.ultimo && c.ultimo.data > m.decisao ? 'Mantida em ' + P.ddmm(c.ultimo.data) + ' · último ' + m.tipo + ' em ' + P.ddmm(m.decisao)
        : (m.tipo === 'corte' ? 'Cortada' : 'Elevada') + ' em ' + P.ddmm(m.decisao) + ' (era ' + P.pct(m.anterior) + ')');
    const ult = B.ultimos_dias.slice(-6);
    const ibovSemana = (ult[ult.length - 1].valor / ult[0].valor - 1) * 100;
    const ipca12e = c.F.ipca_12m ? c.F.ipca_12m.mediana : null;
    const exante = P.fisher(selic, ipca12e);
    const defs = [
      { label: 'Selic (meta)', v: selic, note: selicNota, arr: sel12, color: OSSO, icon: P.icones.percent },
      { label: 'IPCA em 12 meses', v: ipca, note: P.maiuscula(c.ipcaMesNome) + ' · ' + faixaMeta(ipca), arr: ip12.map((x) => x.valor), color: AMBAR, icon: P.icones.trend },
      { label: 'Juro real hoje', v: c.realNow, note: P.fmt(Math.abs(c.realNow - neutro), 1) + ' p.p. ' + (c.realNow >= neutro ? 'acima' : 'abaixo') + ' do juro neutro de referência (' + P.pct(neutro, 0) + ')', arr: real12, color: AZUL, icon: P.icones.gauge },
      exante != null
        ? { label: 'Juro real ex-ante', v: exante, note: 'Selic de hoje e a inflação esperada para os próximos 12 meses (Focus: ' + P.pct(ipca12e) + ')', foot: 'Ex-post ' + P.pct(c.realNow) + ' · ex-ante ' + P.pct(exante), icon: P.icones.clock }
        : { label: 'Juro real em ' + anos[1], v: P.fisher(Sf[1].mediana, I[1].mediana), note: 'Focus: Selic ' + P.pct(Sf[1].mediana) + ' e IPCA ' + P.pct(I[1].mediana), foot: 'Hoje ' + P.pct(c.realNow), icon: P.icones.clock },
      { label: 'Focus · IPCA ' + anos[0], v: I[0].mediana,
        note: I[0].variacao == null ? 'Mediana do mercado' : (I[0].variacao === 0 ? '= estável na semana' : P.seta(I[0].variacao) + P.pp(I[0].variacao) + ' na semana (era ' + P.pct(c.antes(I[0])) + ')'),
        foot: 'Meta 3% · teto 4,5%', icon: P.icones.eye },
      { label: 'Ibovespa (' + P.ddmm(c.ibovData) + ')', v: B.fechamento, pts: true,
        note: P.comSinal(ibovSemana) + '% em 5 pregões' + (B.var_ano == null ? '' : ' · ' + P.comSinal(B.var_ano) + '% em ' + c.ibovData.getFullYear()),
        arr: B.ultimos_dias.slice(-22).map((x) => x.valor), color: OSSO, icon: P.icones.bars },
    ];
    return {
      kpis: defs.map((k, i) => {
        const sp = k.arr ? spark(k.arr) : { line: '', area: '' };
        return {
          label: k.label, note: k.note, icon: k.icon, color: k.color || OSSO,
          display: k.pts ? P.fmtPts(k.v * c.e) : P.pct(k.v * c.e),
          hasSpark: !!k.arr, noSpark: !k.arr, foot: k.foot || '', line: sp.line, area: sp.area,
          cardStyle: 'animation-delay: ' + (120 + i * 80) + 'ms',
        };
      }),
    };
  };

  // ---------- barras: juro real no fim de cada ano
  S.barras = (c) => {
    const anosReal = c.D.juro_real.por_ano.slice(-10);
    const reais = anosReal.map((r) => P.fisher(r.selic, r.ipca));
    const topo = Math.max(12, Math.ceil(Math.max(...reais)) + 1), base = Math.min(-4, Math.floor(Math.min(...reais)) - 1);
    const y = (v) => 24 + (topo - v) / (topo - base) * 216;
    const zeroY = y(0), slot = (736 - 56) / anosReal.length, bw = 36;
    const hover = Math.min(c.s.hoverBar, anosReal.length - 1);
    const bars = anosReal.map((r, i) => {
      const v = reais[i], isNow = i === anosReal.length - 1, hov = hover === i;
      const x = 56 + slot * i + (slot - bw) / 2;
      const ver = () => c.pn.setState({ hoverBar: i });
      return {
        x: x.toFixed(1), y: (v >= 0 ? y(v) : zeroY).toFixed(1), w: bw, h: Math.max(2, Math.abs(y(v) - zeroY)).toFixed(1), cx: (x + bw / 2).toFixed(1),
        isNow, cls: v >= 0 ? 'pm-bar' : 'pm-bar pm-bar-neg',
        fill: isNow ? AZUL : (hov ? HIST_ON : HIST),
        style: 'cursor: pointer; animation-delay: ' + (380 + i * 70) + 'ms',
        labelStyle: 'font-size: 12px; text-anchor: middle; font-variant-numeric: tabular-nums; animation-delay: ' + (900 + i * 70) + 'ms',
        ly: (v >= 0 ? y(v) - 8 : y(v) + 16).toFixed(1), valueTxt: P.pct(v, 1),
        year: isNow ? r.ano + '*' : String(r.ano), enter: ver,
        aria: (isNow ? r.ano + ' até agora' : String(r.ano)) + ': juro real ' + P.pct(v),
      };
    });
    const hb = anosReal[hover];
    const ticks = [];
    for (let t = Math.ceil(base / 4) * 4; t <= topo; t += 4) if (t !== 0) ticks.push({ y: y(t).toFixed(1), ty: (y(t) + 4).toFixed(1), label: P.fmt(t, 0) + '%' });
    const negativos = anosReal.filter((r, i) => reais[i] < 0).map((r) => r.ano);
    const juntar = (l) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : String(l[0]));
    return {
      bars, barTicks: ticks, zeroY: zeroY.toFixed(1), neutroY: y(c.neutro).toFixed(1), neutroTxt: P.pct(c.neutro, c.neutro % 1 ? 2 : 0),
      barDetail: (hover === anosReal.length - 1 ? 'Hoje' : String(hb.ano)) + ': Selic ' + P.pct(hb.selic) + ' · IPCA ' + P.pct(hb.ipca) + ' · juro real ' + P.pct(P.fisher(hb.selic, hb.ipca)),
      barsNowTxt: anosReal[anosReal.length - 1].ano + '* = Selic atual e IPCA até ' + c.ipcaMesNome,
      barsFrom: anosReal[0].ano, barsTo: anosReal[anosReal.length - 1].ano,
      barsCaption: 'Toque ou passe o mouse nas barras para ver a conta de cada ano. '
        + (negativos.length ? 'Em ' + juntar(negativos) + ' o juro real ficou negativo: a inflação passou da Selic.' : 'Em nenhum ano do período o juro real ficou negativo.'),
    };
  };

  // ---------- Copom: contagem e o que o mercado espera
  S.copom = (c) => {
    const p = c.proximo, D = c.D;
    let dias = '—', palavra = '', quando = 'O calendário de reuniões de ' + (c.hoje.getFullYear() + 1) + ' ainda não foi cadastrado no painel.';
    if (p) {
      const n = P.difDias(p.data, c.hoje);
      dias = n === 0 ? 'Hoje' : String(n);
      palavra = n === 0 ? '' : (n === 1 ? 'dia' : 'dias');
      quando = 'Reunião de ' + p.ini.getDate() + (p.ini.getMonth() === p.data.getMonth() ? '' : ' de ' + P.MESES_LONGOS[p.ini.getMonth()]) + ' e ' + P.dataLonga(p.data)
        + ' · ' + (p.nota ? p.nota + ' · ' : '') + 'decisão na ' + P.SEMANA[p.data.getDay()] + ' à noite';
    }
    const reunioes = c.F.reunioes || [];
    const daProxima = p && p.reuniao ? reunioes.find((r) => r.reuniao === p.reuniao) : null;
    const corte = (v) => (Math.abs(v) < 0.001 ? 'manutenção' : v > 0 ? 'corte de ' + P.pp(v) : 'alta de ' + P.pp(v));
    let alvo, rotulo, leitura;
    if (daProxima) {
      alvo = daProxima.mediana;
      rotulo = 'Focus para ' + P.ddmm(p.data) + ' (' + daProxima.reuniao + ')';
      leitura = 'A mediana espera ' + corte(c.selic - alvo) + ' nesta reunião. Respostas entre ' + P.pct(daProxima.minimo) + ' e ' + P.pct(daProxima.maximo) + '.';
      if (daProxima.anterior != null && daProxima.anterior !== alvo) leitura += ' Na semana anterior, a mediana era ' + P.pct(daProxima.anterior) + '.';
    } else {
      alvo = c.S[0].mediana;
      rotulo = 'Focus para dez/' + c.anos[0];
      leitura = 'A mediana implica ' + corte(c.selic - alvo) + ' até dezembro.';
    }
    const passadas = new Set(c.decisoes.filter((d) => d.data < c.hoje).map((d) => d.reuniao));
    const depois = reunioes.filter((r) => !passadas.has(r.reuniao) && r !== daProxima).slice(0, 4).map((r) => {
      const d = tagReuniao(c, r.reuniao);
      return { nome: d ? P.ddmm(d.data) : r.reuniao, sub: r.reuniao, valor: P.pct(r.mediana) };
    });
    const faixa = (t) => 'width: 3px; align-self: stretch; min-height: 28px; border-radius: 9999px; flex: 0 0 auto; background: ' + ({ Focus: AZUL, Copom: AMBAR, Ata: OSSO }[t] || 'rgba(237,237,237,.35)');
    const proximos = c.eventos.filter((x) => x.data >= c.hoje && x.tipo !== 'Feriado' && !x.primeiroDia).slice(0, 5);
    return {
      copomDays: dias, copomWord: palavra, copomWhen: quando,
      selicTxt: P.pct(c.selic), copomFocusTxt: P.pct(alvo), copomFocusLabel: rotulo, copomPricing: leitura,
      hasReunioes: depois.length > 0, reunioesSeguintes: depois,
      events: proximos.map((x, i) => ({
        day: String(x.data.getDate()).padStart(2, '0'), month: P.MESES[x.data.getMonth()], title: x.titulo, desc: x.desc, accent: faixa(x.tipo),
        rowStyle: 'border-radius: 16px; padding: 10px 12px; display: flex; gap: 12px; align-items: center; animation-delay: ' + (700 + i * 70) + 'ms',
      })),
      faixaEvento: faixa,
    };
  };

  // ---------- inflação contra a meta
  S.inflacao = (c) => {
    const s = c.s, D = c.D, hist = D.ipca12m.historico;
    const n0 = s.range === '12m' ? 12 : (s.range === '3a' ? 36 : hist.length);
    const serie = hist.slice(Math.max(0, hist.length - n0));
    const vals = serie.map((x) => x.valor);
    const anoDe = (i) => Number(serie[i].mes.slice(0, 4)), mesDe = (i) => Number(serie[i].mes.slice(5)) - 1;
    const metas = serie.map((x, i) => P.meta(anoDe(i)));
    let mn = Math.min(Math.min(...vals), Math.min(...metas) - 1.5), mx = Math.max(Math.max(...vals), Math.max(...metas) + 1.5);
    mn = Math.floor(mn - 0.3); mx = Math.ceil(mx + 0.3);
    const L = 48, R = 700, T = 14, Bt = 226;
    const X = (i) => L + i / (vals.length - 1) * (R - L), Y = (v) => T + (mx - v) / (mx - mn) * (Bt - T);
    const meio = (R - L) / (vals.length - 1) / 2;
    const cima = [], baixo = [], centro = [];
    vals.forEach((v, i) => {
      const a = Math.max(L, X(i) - meio), b = Math.min(R, X(i) + meio);
      cima.push([a, Y(metas[i] + 1.5)], [b, Y(metas[i] + 1.5)]);
      baixo.push([a, Y(metas[i] - 1.5)], [b, Y(metas[i] - 1.5)]);
      centro.push([a, Y(metas[i])], [b, Y(metas[i])]);
    });
    const passoT = (mx - mn) > 8 ? 2 : 1;
    const ticks = [];
    for (let t = Math.ceil(mn); t <= mx; t += passoT) ticks.push({ y: Y(t).toFixed(1), ty: (Y(t) + 4).toFixed(1), label: t + '%' });
    const xlabels = [];
    vals.forEach((v, i) => {
      if (s.range === '12m') { if (i % 3 === 0 || i === vals.length - 1) xlabels.push({ x: X(i).toFixed(1), label: P.mesCurto(serie[i].mes) }); }
      else if (mesDe(i) === 0) xlabels.push({ x: X(i).toFixed(1), label: String(anoDe(i)) });
    });
    const ultimoV = vals[vals.length - 1];

    // meta contínua: conta os meses seguidos fora da banda, do mais recente para trás
    let seguidos = 0, lado = null;
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = hist[i].valor, m = P.meta(Number(hist[i].mes.slice(0, 4)));
      const fora = v > m + 1.5 ? 'acima do teto' : v < m - 1.5 ? 'abaixo do piso' : null;
      if (!fora || (lado && fora !== lado)) break;
      lado = fora; seguidos++;
    }
    const contador = seguidos === 0 ? 'Dentro da banda' : seguidos + (seguidos === 1 ? ' mês ' : ' meses ') + lado;
    const contadorCaption = seguidos === 0 ? 'O IPCA de 12 meses está dentro da banda de tolerância.'
      : (seguidos >= 6 ? 'Com 6 meses seguidos fora da banda, a meta contínua é considerada descumprida e o BC precisa explicar por carta.'
        : 'Na meta contínua, 6 meses seguidos fora da banda configuram descumprimento. Faltam ' + (6 - seguidos) + '.');
    const ip12 = hist.slice(-12), acimaTeto = ip12.filter((x) => x.valor > TETO).length;

    let mesTxt = '';
    if (D.ipca_mensal) {
      const im = D.ipca_mensal;
      mesTxt = P.maiuscula(P.nomeMes(im.mes)) + ': ' + P.comSinal(im.valor, 2) + '% no mês · ' + P.pct(im.acumulado_ano) + ' no ano';
      if (D.nucleos && D.nucleos.historico.length) mesTxt += ' · média dos núcleos ' + P.pct(D.nucleos.historico[D.nucleos.historico.length - 1].valor) + ' em 12 meses';
    }
    return {
      infl: {
        band: P.caminho(cima.concat(baixo.slice().reverse())) + ' Z', center: P.caminho(centro), line: P.caminho(vals.map((v, i) => [X(i), Y(v)])),
        ticks, xlabels,
        lastX: X(vals.length - 1).toFixed(1), lastY: Y(ultimoV).toFixed(1), labelX: (X(vals.length - 1) + 12).toFixed(1), labelY: (Y(ultimoV) + 4).toFixed(1),
        lastTxt: P.pct(ultimoV),
      },
      inflCaption: acimaTeto + (acimaTeto === 1 ? ' dos últimos 12 meses ficou' : ' dos últimos 12 meses ficaram') + ' acima do teto de 4,5%. A meta de 3% vale desde 2024; antes, era maior.',
      inflMes: mesTxt, hasInflMes: !!mesTxt,
      metaContador: contador, metaContadorCaption: contadorCaption,
      metaContadorStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; white-space: nowrap; color: #161616; background: ' + (seguidos ? AMBAR : OSSO),
      segs: [['12m', '12 meses'], ['3a', '3 anos'], ['all', 'Desde ' + hist[0].mes.slice(0, 4)]].map((g) => ({
        label: g[1], on: s.range === g[0] ? 'true' : 'false', cls: s.range === g[0] ? 'pm-seg pm-seg-on' : 'pm-seg',
        pick: () => { P.gravar('pm-range', g[0]); c.pn.setState({ range: g[0] }); },
      })),
    };
  };

  // ---------- termômetro de ancoragem
  S.ancoragem = (c) => {
    const ancoras = [['IPCA hoje (12 meses)', c.ipca], ...c.anos.map((a, k) => ['Focus · ' + a, c.I[k].mediana])];
    const anosAcima = c.anos.filter((a, k) => c.I[k].mediana > TETO);
    return {
      anchors: ancoras.map((a, i) => ({
        label: a[0], valueTxt: P.pct(a[1]) + (a[1] > 6 ? ' ›' : ''),
        dotStyle: 'position: absolute; top: 50%; left: ' + Math.max(0, Math.min(100, a[1] / 6 * 100)).toFixed(2) + '%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: ' + (a[1] > TETO ? AMBAR : OSSO) + '; border: 3px solid rgba(10,10,10,.55); box-sizing: border-box; animation-delay: ' + (900 + i * 120) + 'ms',
      })),
      ancCaption: 'Em ' + c.anos[2] + ', a inflação esperada é ' + P.pct(c.I[2].mediana) + (c.I[2].mediana > 3 ? ', ainda acima da meta de 3%.' : ', na meta de 3%.')
        + ' Em laranja, o que passa do teto de 4,5%' + (anosAcima.length ? ': ' + anosAcima.join(' e ') + '.' : '; nenhuma expectativa passa do teto agora.'),
    };
  };

  // ---------- Ibovespa: retorno em cada ano
  S.ibovAnos = (c) => {
    const B = c.B, anos = B.por_ano.slice(-10);
    const topo = Math.max(36, Math.ceil(Math.max(...anos.map((r) => r.retorno))) + 4);
    const base = Math.min(-16, Math.floor(Math.min(...anos.map((r) => r.retorno))) - 4);
    const y = (v) => 24 + (topo - v) / (topo - base) * 216;
    const zeroY = y(0), slot = (736 - 56) / anos.length, bw = 36;
    const hover = Math.min(c.s.hoverIbov, anos.length - 1);
    const bars = anos.map((r, i) => {
      const v = r.retorno, isNow = i === anos.length - 1, hov = hover === i;
      const x = 56 + slot * i + (slot - bw) / 2;
      return {
        x: x.toFixed(1), y: (v >= 0 ? y(v) : zeroY).toFixed(1), w: bw, h: Math.max(2, Math.abs(y(v) - zeroY)).toFixed(1),
        cx: (x + bw / 2).toFixed(1), cls: v >= 0 ? 'pm-bar' : 'pm-bar pm-bar-neg',
        fill: isNow ? AZUL : (hov ? HIST_ON : HIST),
        style: 'cursor: pointer; animation-delay: ' + (380 + i * 70) + 'ms',
        labelStyle: 'font-size: 12px; text-anchor: middle; font-variant-numeric: tabular-nums; animation-delay: ' + (900 + i * 70) + 'ms',
        ly: (v >= 0 ? y(v) - 8 : y(v) + 16).toFixed(1), valueTxt: P.comSinal(v) + '%',
        year: isNow ? r.ano + '*' : String(r.ano), enter: () => c.pn.setState({ hoverIbov: i }),
        aria: (isNow ? r.ano + ' até ' + P.ddmm(c.ibovData) : String(r.ano)) + ': ' + P.comSinal(v) + '%',
      };
    });
    const hi = anos[hover];
    const ticks = [];
    for (let t = Math.ceil(base / 10) * 10; t <= topo; t += 10) if (t !== 0) ticks.push({ y: y(t).toFixed(1), ty: (y(t) + 4).toFixed(1), label: P.fmt(t, 0) + '%' });
    const melhor = anos.slice(0, -1).reduce((a, b) => (b.retorno > a.retorno ? b : a));
    const pior = anos.slice(0, -1).reduce((a, b) => (b.retorno < a.retorno ? b : a));
    let caption = 'Melhor ano do período: ' + melhor.ano + ' (' + P.comSinal(melhor.retorno) + '%); pior: ' + pior.ano + ' (' + P.comSinal(pior.retorno) + '%).';
    if (B.maxima_historica) {
      const dist = (B.fechamento / B.maxima_historica.valor - 1) * 100;
      caption += ' Máxima histórica: ' + P.fmtPts(B.maxima_historica.valor) + ' pontos em ' + P.ddmmaaaa(P.dia(B.maxima_historica.data))
        + (dist < -0.05 ? ' (o índice está ' + P.fmt(Math.abs(dist), 1) + '% abaixo).' : ' (o índice está nela).');
    }
    return {
      ibovBars: bars, ibovTicks: ticks, ibovZeroY: zeroY.toFixed(1),
      ibovDetail: (hover === anos.length - 1 ? hi.ano + ' até ' + P.ddmm(c.ibovData) : String(hi.ano)) + ': ' + P.fmtPts(hi.fechamento) + ' pts · ' + P.comSinal(hi.retorno) + '%',
      ibovCaption: caption,
      ibovSubNow: c.ibovData.getFullYear() + '* até ' + P.ddmm(c.ibovData), ibovNowLegend: c.ibovData.getFullYear() + '* até ' + P.ddmm(c.ibovData),
      ibovFrom: anos[0].ano, ibovTo: anos[anos.length - 1].ano,
    };
  };

  // ---------- Ibovespa: últimos pregões
  S.pregoes = (c) => {
    const B = c.B, ult = B.ultimos_dias.slice(-6);
    const wMin = Math.min(...ult.map((x) => x.valor)) * 0.985, wMax = Math.max(...ult.map((x) => x.valor)) * 1.015;
    const wX = (i) => 28 + i * (292 - 28) / (ult.length - 1), wY = (v) => 16 + (wMax - v) / (wMax - wMin) * 108;
    const semana = (ult[ult.length - 1].valor / ult[0].valor - 1) * 100;
    const maxima = B.maxima_12m, dist = (B.fechamento / maxima.valor - 1) * 100;
    return {
      ibovWeekLine: P.caminho(ult.map((w, i) => [wX(i), wY(w.valor)])),
      ibovWeekDots: ult.map((w, i) => ({ x: wX(i).toFixed(1), y: wY(w.valor).toFixed(1), label: P.ddmm(P.dia(w.data)) })),
      ibovWeekRows: ult.map((w, i) => ({
        day: P.ddmm(P.dia(w.data)) + ' · ' + P.SEMANA[P.dia(w.data).getDay()], pts: P.fmtPts(w.valor),
        note: i === 0 ? 'Ponto de partida' : P.comSinal((w.valor / ult[i - 1].valor - 1) * 100) + '% no dia',
        rowStyle: 'display: flex; justify-content: space-between; gap: 10px; padding: 8px 4px; border-top: ' + (i ? '1px solid rgba(229,229,229,.10)' : '0'),
      })),
      ibovWeekTxt: P.comSinal(semana) + '%',
      ibovWeekColor: 'font-size: 56px; font-weight: 500; letter-spacing: -0.045em; line-height: 1; font-variant-numeric: tabular-nums; color: ' + (semana < -3 ? AMBAR : OSSO),
      ibovWeekAria: 'Linha do Ibovespa nos últimos seis pregões, de ' + P.ddmm(P.dia(ult[0].data)) + ' a ' + P.ddmm(c.ibovData),
      ibovWeekCaption: 'Máxima dos últimos 12 meses: ' + P.fmtPts(maxima.valor) + ' pontos em ' + P.ddmm(P.dia(maxima.data)) + '. '
        + (dist < -0.05 ? 'O fechamento de ' + P.ddmm(c.ibovData) + ' está ' + P.fmt(Math.abs(dist), 1) + '% abaixo dela.' : 'O índice está na máxima.'),
    };
  };

  // ---------- medo na bolsa: volatilidade calculada pelo painel + VIX manual como referência
  S.medo = (c) => {
    const vol = c.B.volatilidade;
    if (!vol || vol.atual == null) throw new Error('sem volatilidade no dados.json');
    const agora = vol.atual, hist = vol.historico.slice(-60);
    const gMax = 60, gcx = 140, gcy = 140, gr = 110;
    const ang = (v) => Math.PI * (1 - Math.min(v, gMax) / gMax);
    const gPt = (v, r) => [gcx + r * Math.cos(ang(v)), gcy - r * Math.sin(ang(v))];
    const arco = (a, b) => { const p1 = gPt(a, gr), p2 = gPt(b, gr); return 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A' + gr + ' ' + gr + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); };
    const agulha = gPt(agora * c.e, gr - 24);
    const zona = agora < 20 ? 'Calmo' : (agora < 30 ? 'Atenção' : 'Turbulência');
    const zonaCor = agora < 20 ? OSSO : (agora < 30 ? 'rgba(240,179,122,.8)' : AMBAR);
    const lmax = Math.max(gMax, ...hist.map((h) => h.valor));
    const mX = (i) => 16 + i * (264 - 16) / (hist.length - 1), mY = (v) => 8 + (lmax - v) / lmax * 68;
    const cada = Math.ceil(hist.length / 5);
    const vix = c.M.vix && c.M.vix.leituras && c.M.vix.leituras.length ? c.M.vix.leituras[c.M.vix.leituras.length - 1] : null;
    let vixTxt = '';
    if (vix) {
      const dias = P.difDias(c.hoje, P.dia(vix[0]));
      vixTxt = (c.M.vix.nome || 'S&P/B3 Ibovespa VIX') + ' (atualização manual, ' + c.M.vix.fonte + '): ' + P.fmt(vix[1]) + ' em ' + P.ddmm(P.dia(vix[0])) + ' · ' + P.haDias(dias) + (dias > 7 ? ' (desatualizado)' : '');
    }
    return {
      medoArcCalm: arco(0, 20), medoArcWarn: arco(20, 30), medoArcHigh: arco(30, gMax),
      medoTicks: [0, 20, 30, 60].map((t) => { const p = gPt(t, gr + 20); return { x: p[0].toFixed(1), y: (p[1] + 4).toFixed(1), label: String(t) }; }),
      medoNeedleX: agulha[0].toFixed(1), medoNeedleY: agulha[1].toFixed(1),
      medoValueTxt: P.pct(agora * c.e, 1), medoZone: zona,
      medoPillStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; white-space: nowrap; color: #161616; background: ' + zonaCor,
      medoAria: 'Volatilidade do Ibovespa em ' + P.pct(agora, 1) + ' ao ano, faixa de ' + zona.toLowerCase(),
      medoPts: hist.map((m, i) => ({ x: mX(i).toFixed(1), y: mY(m.valor).toFixed(1), label: i % cada === 0 || i === hist.length - 1 ? P.ddmm(P.dia(m.data)) : '', fill: m.valor >= 30 ? AMBAR : OSSO, show: i % cada === 0 || i === hist.length - 1 })),
      medoPath: 'M' + hist.map((m, i) => mX(i).toFixed(1) + ' ' + mY(m.valor).toFixed(1)).join(' L'),
      medoLine30: mY(30).toFixed(1), medoLine30Txt: (mY(30) - 5).toFixed(1),
      medoLineAria: 'Volatilidade dos últimos ' + hist.length + ' pregões, de ' + P.pct(hist[0].valor, 1) + ' a ' + P.pct(agora, 1),
      medoComment: 'Volatilidade realizada: o desvio-padrão dos retornos diários dos últimos ' + vol.janela + ' pregões, anualizado. Escala do mostrador de 0% a 60%; acima de 30%, o mercado costuma estar em turbulência.',
      hasVix: !!vixTxt, medoVix: vixTxt,
    };
  };

  // ---------- simulador de juro real
  S.simulador = (c) => {
    const s = c.s, neutro = c.neutro;
    const real = P.fisher(s.simSelic, s.simIpca), simples = s.simSelic - s.simIpca;
    let postura = 'Neutra', cor = OSSO, desc = 'Juro real perto do neutro: nem acelera nem freia a economia.';
    if (real < neutro - 1) { postura = 'Estimulativa'; cor = AZUL; desc = 'Juro real abaixo do neutro: estimula crédito, consumo e investimento.'; }
    else if (real > neutro + 1) { postura = 'Contracionista'; cor = AMBAR; desc = 'Juro real acima do neutro: freia a economia para conter a inflação.'; }
    const pos = (v) => Math.max(0, Math.min(100, (v + 5) / 20 * 100));
    return {
      simSelic: s.simSelic, simIpca: s.simIpca, simSelicTxt: P.pct(s.simSelic), simIpcaTxt: P.pct(s.simIpca),
      onSelic: (ev) => c.pn.setState({ simSelic: parseFloat(ev.target.value) }),
      onIpca: (ev) => c.pn.setState({ simIpca: parseFloat(ev.target.value) }),
      resetSim: () => c.pn.setState({ simSelic: c.selic, simIpca: c.ipca }),
      simRealTxt: P.pct(real), simStance: postura, simDesc: desc,
      simStanceStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; color: #161616; background: ' + cor,
      simNeutroStyle: 'position: absolute; top: -4px; bottom: -4px; left: ' + pos(neutro).toFixed(2) + '%; width: 2px; margin-left: -1px; background: rgba(240,179,122,.9)',
      simMarkerStyle: 'position: absolute; top: 50%; left: ' + pos(real).toFixed(2) + '%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: ' + cor + '; border: 3px solid rgba(10,10,10,.6); box-sizing: border-box; transition: left .25s ease, background-color .25s',
      simNeutroLabelStyle: 'position: absolute; left: ' + pos(neutro).toFixed(2) + '%; transform: translateX(-50%); white-space: nowrap',
      simNeutroLabel: 'neutro ' + P.pct(neutro, 0),
      simSimpleTxt: P.pct(simples), simErrTxt: P.pp(simples - real),
    };
  };

  // ---------- Brasil no mundo (ranking manual + diferencial automático)
  S.mundo = (c) => {
    const R = c.M.ranking_mundo;
    const maior = Math.max(...R.paises.map((x) => x[1]), c.realNow);
    const barra = (v, cor) => 'width: ' + (v / maior * 100).toFixed(1) + '%; height: 100%; border-radius: 9999px; background: ' + cor;
    const linhas = R.paises.map((x) => ({ nome: x[0] + ' (' + P.mesCurto(R.mes) + ')', valor: P.pct(x[1]), style: barra(x[1], 'rgba(237,237,237,.45)') }));
    linhas.push({ nome: 'Brasil hoje', valor: P.pct(c.realNow), style: barra(c.realNow, AZUL) });
    let dif = '';
    if (c.D.mundo && c.D.mundo.tbill3m) dif = 'Diferencial de juros com os EUA: Selic ' + P.pct(c.selic) + ' − T-bill de 3 meses ' + P.pct(c.D.mundo.tbill3m.valor) + ' = ' + P.pp(c.selic - c.D.mundo.tbill3m.valor) + '.';
    return {
      mundoPos: R.posicao_brasil + 'º', mundoTitulo: 'maior juro real do mundo em ' + P.mesLongo(R.mes),
      mundoLinhas: linhas, mundoCaption: R.contexto + ' Fonte: ' + R.fonte + '. Hoje o juro real brasileiro é ' + P.pct(c.realNow) + '.',
      hasMundoDif: !!dif, mundoDif: dif,
    };
  };

  // ---------- leitura da semana (autor) ou resumo automático
  S.leitura = (c) => {
    const l = c.pn.leituras[0];
    const atual = l && P.dia(l.data) >= c.coleta;
    const anterior = !atual && l ? 'Última leitura do autor: ' + P.ddmmaaaa(P.dia(l.data)) + (l.titulo ? ' · ' + l.titulo : '') : '';
    return {
      leituraAutor: !!atual, leituraAuto: !atual && !!c.D.resumo_semana,
      leituraVazia: !atual && !c.D.resumo_semana,
      leituraTitulo: atual && l.titulo ? l.titulo : 'O que mudou no Focus e o que isso diz sobre os juros?',
      leituraParagrafos: atual ? P.paragrafos(l.texto) : [],
      leituraResumo: c.D.resumo_semana ? c.D.resumo_semana.texto : '',
      leituraTag: atual ? 'Análise do autor' : 'Resumo automático',
      leituraRef: atual ? 'Publicada em ' + P.ddmmaaaa(P.dia(l.data)) : 'Gerado a partir do Focus com coleta até ' + P.ddmm(c.coleta) + '. ' + (anterior || 'O autor publica a leitura depois do Focus de segunda.'),
    };
  };

  // ---------- bolsa x renda fixa em 10 anos
  S.comparacao = (c) => {
    const C = c.D.comparacao;
    if (!C) throw new Error('sem comparacao no dados.json');
    const modo = c.s.comp;
    const serie = C.serie;
    const ibov = serie.map((x) => (modo === 'real' ? x.ibov_real : modo === 'dolar' ? x.ibov_dolar : x.ibov));
    const cdi = serie.map((x) => (modo === 'real' ? x.cdi * x.ibov_real / x.ibov : modo === 'dolar' ? x.cdi * x.ibov_dolar / x.ibov : x.cdi));
    const g = P.linhas([{ valores: cdi, cor: OSSO }, { valores: ibov, cor: AZUL }], serie.map((x) => x.mes.slice(0, 4)), { L: 52, R: 690, T: 14, B: 226 },
      { incluir: [100], passo: 50, fmtTick: (t) => P.fmt(t, 0), maxRotulos: 10 });
    // rótulos do eixo x: só a virada de cada ano
    g.xlabels = serie.map((x, i) => ({ x: g.X(i).toFixed(1), label: x.mes.slice(0, 4), jan: x.mes.endsWith('-01') })).filter((x) => x.jan && Number(x.label) % 2 === 1);
    const ultI = ibov[ibov.length - 1], ultC = cdi[cdi.length - 1];
    g.linhas[0].lastTxt = 'CDI ' + P.fmt(ultC, 0); g.linhas[1].lastTxt = 'Ibov ' + P.fmt(ultI, 0);
    const nomes = { ibov: 'em reais', real: 'descontada a inflação (IPCA)', dolar: 'em dólares' };
    const vence = ultI > ultC ? 'a bolsa' : 'o CDI';
    return {
      comp: g,
      compSegs: [['ibov', 'Em reais'], ['real', 'Descontada a inflação'], ['dolar', 'Em dólar']].map((x) => ({
        label: x[1], on: modo === x[0] ? 'true' : 'false', cls: modo === x[0] ? 'pm-seg pm-seg-on' : 'pm-seg', pick: () => c.pn.setState({ comp: x[0] }),
      })),
      compSub: 'R$ 100 aplicados em ' + P.mesCurto(C.base) + ', ' + nomes[modo],
      compCaption: 'R$ 100 em ' + P.mesCurto(C.base) + ' viraram R$ ' + P.fmt(ultI, 0) + ' no Ibovespa e R$ ' + P.fmt(ultC, 0) + ' no CDI (' + nomes[modo] + '). No período, ' + vence + ' rendeu mais. '
        + 'Sem impostos e custos; o Ibovespa aqui não inclui dividendos, o que favorece o CDI na comparação.',
      compAria: 'Linhas do Ibovespa e do CDI desde ' + P.mesCurto(C.base) + ', base 100, ' + nomes[modo],
    };
  };

  // ---------- calculadora: quanto rende meu dinheiro
  S.calculadora = (c) => {
    const s = c.s, D = c.D;
    const valor = Math.max(0, Number(s.calcValor) || 0), meses = s.calcMeses, anos = meses / 12;
    const cdiAno = D.comparacao && D.comparacao.cdi_hoje != null ? (Math.pow(1 + D.comparacao.cdi_hoje / 100, 252) - 1) * 100 : c.selic - 0.1;
    const tr = D.economia && D.economia.tr_mes ? D.economia.tr_mes.valor : 0;
    const poupAno = c.selic > 8.5 ? (Math.pow(1.005 * (1 + tr / 100), 12) - 1) * 100 : (Math.pow((1 + c.selic * 0.7 / 100) ** (1 / 12) * (1 + tr / 100), 12) - 1) * 100;
    const ir = meses * 30 <= 180 ? 22.5 : meses * 30 <= 360 ? 20 : meses * 30 <= 720 ? 17.5 : 15;
    const inflAno = c.F.ipca_12m ? c.F.ipca_12m.mediana : c.I[0].mediana;
    const inflPeriodo = Math.pow(1 + inflAno / 100, anos) - 1;
    const opcoes = [
      { nome: 'Poupança', taxa: poupAno, ir: 0, nota: 'isenta de IR · 0,5% ao mês + TR' },
      { nome: 'Tesouro Selic', taxa: c.selic - 0.2, ir, nota: 'Selic − 0,2% de custódia · IR ' + P.fmt(ir, 1) + '%' },
      { nome: 'CDB 100% do CDI', taxa: cdiAno, ir, nota: 'CDI de hoje · IR ' + P.fmt(ir, 1) + '%' },
    ].map((o) => {
      const bruto = valor * (Math.pow(1 + o.taxa / 100, anos) - 1);
      const liquido = bruto * (1 - o.ir / 100);
      const final = valor + liquido;
      const real = ((final / valor) / (1 + inflPeriodo) - 1) * 100;
      return { ...o, final, liquido, real };
    });
    const maior = Math.max(...opcoes.map((o) => o.liquido), 1);
    const dinheiro = (v) => 'R$ ' + P.fmt(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return {
      calcValor: String(valor),
      onCalcValor: (ev) => c.pn.setState({ calcValor: ev.target.value.replace(/[^\d]/g, '').slice(0, 10) }),
      calcPrazos: [[6, '6 meses'], [12, '1 ano'], [24, '2 anos'], [60, '5 anos']].map((x) => ({
        label: x[1], on: meses === x[0] ? 'true' : 'false', cls: meses === x[0] ? 'pm-seg pm-seg-on' : 'pm-seg', pick: () => c.pn.setState({ calcMeses: x[0] }),
      })),
      calcLinhas: opcoes.map((o, i) => ({
        nome: o.nome, nota: o.nota, final: valor ? dinheiro(o.final) : '—',
        ganho: valor ? '+' + dinheiro(o.liquido) + ' líquido · ' + P.comSinal(o.real, 1) + '% acima da inflação' : '',
        barStyle: 'width: ' + (valor ? Math.max(2, o.liquido / maior * 100) : 0).toFixed(1) + '%; height: 100%; border-radius: 9999px; background: ' + (i === 0 ? 'rgba(237,237,237,.45)' : AZUL),
      })),
      calcNota: 'Taxas de hoje mantidas constantes: CDI ' + P.pct(cdiAno) + ' ao ano, poupança ' + P.pct(poupAno) + ' ao ano (TR ' + P.pct(tr, 4) + ' ao mês). Inflação estimada pelo Focus: ' + P.pct(inflAno) + ' ao ano. Simulação educativa, não é recomendação de investimento.',
    };
  };

  // ---------- rodapé
  S.rodape = (c) => ({
    footer: 'Painel criado por ' + c.M.autor.nomeCompleto + '. Fontes: Banco Central do Brasil (SGS e Boletim Focus com coleta até ' + P.ddmmaaaa(c.coleta) + '), IBGE (SIDRA), Tesouro Transparente e Yahoo Finance via yfinance (Ibovespa até '
      + P.ddmmaaaa(c.ibovData) + '). Ranking mundial: ' + c.M.ranking_mundo.fonte + ' (' + P.mesCurto(c.M.ranking_mundo.mes) + '). Juro real pela fórmula de Fisher. Atualização automática em dias úteis; última em ' + c.atualizado.ddmmaaaa + ' às ' + c.atualizado.hora + ' (Brasília).',
  });
})();
