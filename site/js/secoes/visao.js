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

  /*
   * Selic esperada para os próximos 12 meses (acumulada), como o BC usa na Selic real ex-ante
   * (RPM set/2026, p. 80): Selic de hoje até a próxima decisão e, depois de cada reunião,
   * a mediana do Focus para ela. Precisa do calendário do Copom cobrindo os 12 meses.
   */
  function selicEsperada12m(c) {
    const R = c.F.reunioes || [];
    const fim = P.somaDias(c.hoje, 365);
    const futuras = c.decisoes.filter((d) => d.data >= c.hoje && d.reuniao);
    if (!R.length || !futuras.length || P.difDias(fim, futuras[futuras.length - 1].data) > 60) return null;
    let taxa = c.selic, ini = c.hoje, fator = 1;
    for (const d of futuras) {
      const vigencia = P.somaDias(d.data, 1);
      if (vigencia > fim) break;
      const r = R.find((x) => x.reuniao === d.reuniao);
      if (!r) return null;
      fator *= Math.pow(1 + taxa / 100, P.difDias(vigencia, ini) / 365);
      taxa = r.mediana; ini = vigencia;
    }
    fator *= Math.pow(1 + taxa / 100, P.difDias(fim, ini) / 365);
    return (fator - 1) * 100;
  }
  P.selicEsperada12m = selicEsperada12m;

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
      subtitle: 'Juros, inflação e expectativas no Brasil · IPCA até ' + P.mesLongo(c.ipcaMes) + ' · Focus com coleta até ' + P.ddmm(c.coleta) + ' · Ibovespa até ' + P.ddmm(c.ibovData)
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
    const defs = [
      { label: 'Selic (meta)', v: selic, note: selicNota, arr: sel12, color: OSSO, icon: P.icones.percent },
      { label: 'IPCA em 12 meses', v: ipca, note: P.maiuscula(c.ipcaMesNome) + ' · ' + faixaMeta(ipca), arr: ip12.map((x) => x.valor), color: AMBAR, icon: P.icones.trend },
      { label: 'Juro real hoje', v: c.realNow, note: P.fmt(Math.abs(c.realNow - neutro), 1) + ' p.p. ' + (c.realNow >= neutro ? 'acima' : 'abaixo') + ' do juro neutro de referência (' + P.pct(neutro, 0) + ')', arr: real12, color: AZUL, icon: P.icones.gauge },
      (() => {
        const esp = P.fisher(Sf[1].mediana, I[1].mediana);
        const antesEsp = c.antes(Sf[1]) != null && c.antes(I[1]) != null ? P.fisher(c.antes(Sf[1]), c.antes(I[1])) : null;
        return { label: 'Juro real esperado ' + anos[1], v: esp, note: 'Focus: Selic ' + P.pct(Sf[1].mediana) + ' e IPCA ' + P.pct(I[1].mediana) + ' em ' + anos[1] + (antesEsp != null ? ' (era ' + P.pct(antesEsp, 1) + ')' : ''), foot: 'Hoje ' + P.pct(c.realNow) + ' → ' + anos[1] + ' ' + P.pct(esp), icon: P.icones.target };
      })(),
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
        + ' · ' + (p.nota ? p.nota + ' · ' : '') + 'decisão divulgada na ' + P.SEMANA[p.data.getDay()];
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
      : (seguidos >= 6 ? 'Com 6 meses seguidos fora da banda, a meta contínua é considerada descumprida e o BC publica carta aberta ao Ministro da Fazenda (Decreto 12.079/2024).'
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
        lastTxt: P.pct(ultimoV), id: 'infl-linha-' + s.range,
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

  // ---------- medo na bolsa: volatilidade do Ibovespa comparada com o próprio histórico desde 2000
  S.medo = (c) => {
    const vol = c.B.volatilidade;
    if (!vol || vol.atual == null || vol.p90_desde_2000 == null) throw new Error('sem volatilidade no dados.json');
    const agora = vol.atual, hist = vol.historico.slice(-60), med = vol.mediana_desde_2000, p90 = vol.p90_desde_2000;
    const gMax = Math.max(60, Math.ceil(agora / 10) * 10), gcx = 140, gcy = 140, gr = 110;
    const ang = (v) => Math.PI * (1 - Math.min(v, gMax) / gMax);
    const gPt = (v, r) => [gcx + r * Math.cos(ang(v)), gcy - r * Math.sin(ang(v))];
    const arco = (a, b) => { const p1 = gPt(a, gr), p2 = gPt(b, gr); return 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A' + gr + ' ' + gr + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); };
    const agulha = gPt(agora * c.e, gr - 24);
    // faixas relativas ao próprio histórico: abaixo da mediana, entre a mediana e o percentil 90, acima do percentil 90
    const zona = agora < med ? 'Baixa' : (agora < p90 ? 'Elevada' : 'Muito elevada');
    const zonaCor = agora < med ? OSSO : (agora < p90 ? 'rgba(240,179,122,.8)' : AMBAR);
    const lmax = Math.max(gMax, ...hist.map((h) => h.valor));
    const mX = (i) => 16 + i * (264 - 16) / (hist.length - 1), mY = (v) => 8 + (lmax - v) / lmax * 68;
    const cada = Math.ceil(hist.length / 5);
    return {
      medoArcCalm: arco(0, med), medoArcWarn: arco(med, p90), medoArcHigh: arco(p90, gMax),
      medoTicks: [0, med, p90, gMax].map((t) => { const p = gPt(t, gr + 20); return { x: p[0].toFixed(1), y: (p[1] + 4).toFixed(1), label: P.fmt(t, 0) }; }),
      medoNeedleX: agulha[0].toFixed(1), medoNeedleY: agulha[1].toFixed(1),
      medoValueTxt: P.pct(agora * c.e, 1), medoZone: zona,
      medoPillStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; white-space: nowrap; color: #161616; background: ' + zonaCor,
      medoAria: 'Volatilidade do Ibovespa em ' + P.pct(agora, 1) + ' ao ano; ' + zona.toLowerCase() + ' do histórico desde 2000',
      medoPts: hist.map((m, i) => ({ x: mX(i).toFixed(1), y: mY(m.valor).toFixed(1), label: i % cada === 0 || i === hist.length - 1 ? P.ddmm(P.dia(m.data)) : '', fill: m.valor >= p90 ? AMBAR : OSSO, show: i % cada === 0 || i === hist.length - 1 })),
      medoPath: 'M' + hist.map((m, i) => mX(i).toFixed(1) + ' ' + mY(m.valor).toFixed(1)).join(' L'),
      medoLine30: mY(p90).toFixed(1), medoLine30Txt: (mY(p90) - 5).toFixed(1), medoLinhaTxt: '10% mais altos desde 2000 (' + P.pct(p90, 0) + ')',
      medoLineAria: 'Volatilidade dos últimos ' + hist.length + ' pregões, de ' + P.pct(hist[0].valor, 1) + ' a ' + P.pct(agora, 1),
      medoComment: 'Hoje a volatilidade está maior que em ' + P.fmt(vol.percentil_atual, 0) + '% dos pregões desde 2000. Baixa: abaixo da mediana desde 2000 (' + P.pct(med, 1) + '); muito elevada: acima dos 10% mais altos (' + P.pct(p90, 1) + ').',
    };
  };

  // ---------- simulador de juro real
  S.simulador = (c) => {
    const s = c.s, neutro = c.neutro;
    const real = P.fisher(s.simSelic, s.simIpca), simples = s.simSelic - s.simIpca;
    let postura = 'Próxima da neutra', cor = OSSO, desc = 'Juro real a menos de 0,25 ponto da taxa neutra de ' + P.pct(neutro) + ' usada pelo BC.';
    if (real < neutro - 0.25) { postura = 'Estimulativa'; cor = AZUL; desc = 'Juro real abaixo da taxa neutra de ' + P.pct(neutro) + ' usada pelo BC: política monetária estimulativa.'; }
    else if (real > neutro + 0.25) { postura = 'Contracionista'; cor = AMBAR; desc = 'Juro real acima da taxa neutra de ' + P.pct(neutro) + ' usada pelo BC: política monetária contracionista.'; }
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

  // ---------- Brasil no mundo (ranking Moneyou, via Agência Brasil) + diferencial com os EUA (FRED)
  S.mundo = (c) => {
    const R = c.M.ranking_mundo;
    const maior = Math.max(...R.paises.map((x) => x[1]));
    const barra = (v, cor) => 'width: ' + (v / maior * 100).toFixed(1) + '%; height: 100%; border-radius: 9999px; background: ' + cor;
    let dif = '';
    if (c.D.mundo && c.D.mundo.fed_funds) dif = 'Diferencial com os EUA hoje: Selic ' + P.pct(c.selic) + ' − Fed funds ' + P.pct(c.D.mundo.fed_funds.valor) + ' = ' + P.pp(c.selic - c.D.mundo.fed_funds.valor) + '.';
    return {
      mundoPos: R.posicao_brasil + 'º', mundoTitulo: 'maior juro real entre ' + R.paises_no_ranking + ' países',
      mundoLinhas: R.paises.map((x) => ({ nome: x[0], valor: P.pct(x[1]), style: barra(x[1], x[0] === 'Brasil' ? AZUL : 'rgba(237,237,237,.45)') })),
      mundoCaption: 'Ranking publicado em ' + P.ddmmaaaa(P.dia(R.publicado_em)) + '. Média dos ' + R.paises_no_ranking + ' países: ' + P.pct(R.media) + '. A metodologia é da consultoria e pode diferir do cálculo do painel.',
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

  // ---------- rodapé
  S.rodape = (c) => ({
    footer: 'Painel criado por ' + c.M.autor.nomeCompleto + '. Fontes: Banco Central do Brasil (SGS, Boletim Focus com coleta até ' + P.ddmmaaaa(c.coleta) + ' e Relatório de Política Monetária), IBGE (SIDRA), B3 (Ibovespa até '
      + P.ddmmaaaa(c.ibovData) + ' e calendário de negociação), Tesouro Nacional (Tesouro Transparente) e Moneyou via Agência Brasil (ranking mundial). Fontes, documentos e método de cada indicador na aba Metodologia. Atualização automática em dias úteis; última em ' + c.atualizado.ddmmaaaa + ' às ' + c.atualizado.hora + ' (Brasília).',
  });

})();
