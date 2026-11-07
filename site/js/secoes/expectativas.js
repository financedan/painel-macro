/*
 * secoes/expectativas.js — blocos da aba "Expectativas" (Boletim Focus e Tesouro Direto).
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});
  const { AZUL, AMBAR, OSSO } = P.cores;
  const NOMES = { IPCA: ['IPCA', 'inflação no ano'], Selic: ['Selic', 'no fim do ano'], 'PIB Total': ['PIB', 'crescimento no ano'], 'Câmbio': ['Câmbio', 'R$ por dólar no fim do ano'] };
  const valorDe = (ind, v) => (ind === 'Câmbio' ? P.reais(v) : P.pct(v));
  const deltaDe = (ind, d) => (d === 0 ? '= estável' : P.seta(d) + (ind === 'Câmbio' ? P.reais(Math.abs(d)) : P.pp(d)));

  // semanas seguidas na mesma direção, do Focus mais recente para trás
  function sequencia(serie) {
    const v = serie.map((x) => x.mediana);
    if (v.length < 2) return { n: 0, dir: 0, de: null, para: null };
    const sinal = (a, b) => Math.sign(Math.round((b - a) * 100));
    const dir = sinal(v[v.length - 2], v[v.length - 1]);
    let n = 0;
    for (let i = v.length - 1; i > 0 && sinal(v[i - 1], v[i]) === dir; i--) n++;
    return { n, dir, de: v[v.length - 1 - n], para: v[v.length - 1] };
  }
  const textoSequencia = (q, ind) => (q.dir === 0
    ? 'ficou estável nas últimas ' + q.n + (q.n === 1 ? ' semana' : ' semanas')
    : (q.dir > 0 ? 'subiu' : 'caiu') + (q.n === 1 ? ' na última semana' : ' por ' + q.n + ' semanas seguidas') + ' (de ' + valorDe(ind, q.de) + ' para ' + valorDe(ind, q.para) + ')');

  S.focusTabela = (c) => {
    const F = c.F;
    return {
      focusSub: 'Boletim Focus com coleta até ' + P.ddmmaaaa(c.coleta) + ' · mediana das instituições consultadas',
      focusPrevTxt: P.ddmm(c.coletaAntes), focusYears: c.anos, focusLastYear: c.anos[2],
      focusRows: F.tabela.map((r) => ({
        name: NOMES[r.indicador][0], unit: NOMES[r.indicador][1],
        cells: r.valores.map((x) => ({
          value: valorDe(r.indicador, x.mediana), delta: x.variacao == null ? '—' : deltaDe(r.indicador, x.variacao),
          faixa: x.minimo != null ? 'de ' + valorDe(r.indicador, x.minimo).replace('R$ ', '') + ' a ' + valorDe(r.indicador, x.maximo).replace('R$ ', '') + (x.respondentes ? ' · ' + x.respondentes + ' respostas' : '') : '',
        })),
      })),
    };
  };

  S.trajetoria = (c) => {
    const tS = [c.selic, ...c.S.map((x) => x.mediana)], tI = [c.ipca, ...c.I.map((x) => x.mediana)];
    const tL = ['Hoje', ...c.anos.map((a) => 'Fim de ' + a)];
    const topo = Math.max(16, Math.ceil(Math.max(...tS) / 4) * 4);
    const X = (i) => 110 + i * (660 - 110) / 3, Y = (v) => 16 + (topo - v) / topo * 250;
    const sel = tS.map((v, i) => [X(i), Y(v)]), ip = tI.map((v, i) => [X(i), Y(v)]);
    const ticks = [];
    for (let t = 0; t <= topo; t += 4) ticks.push({ y: Y(t).toFixed(1), ty: (Y(t) + 4).toFixed(1), label: t + '%' });
    const realFim = P.fisher(tS[3], tI[3]);
    return {
      traj: {
        selic: P.caminho(sel), ipca: P.caminho(ip), area: P.caminho(sel.concat(ip.slice().reverse())) + ' Z', ticks,
        pts: tS.map((v, i) => ({
          x: X(i).toFixed(1), ys: Y(v).toFixed(1), yi: Y(tI[i]).toFixed(1), lys: (Y(v) - 12).toFixed(1), lyi: (Y(tI[i]) + 22).toFixed(1),
          lyr: ((Y(v) + Y(tI[i])) / 2 + 4).toFixed(1), selicTxt: P.pct(v), ipcaTxt: P.pct(tI[i]), realTxt: 'real ' + P.pct(P.fisher(v, tI[i]), 1), label: tL[i],
        })),
      },
      trajCaption: 'O juro real esperado vai de ' + P.pct(c.realNow, 1) + ' hoje para ' + P.pct(realFim, 1) + ' no fim de ' + c.anos[2]
        + (realFim > c.neutro ? ', ainda acima' : ', abaixo') + ' do juro neutro de referência (' + P.pct(c.neutro, 0) + '). "Hoje" usa a Selic atual e o IPCA de 12 meses até ' + c.ipcaMesNome + '.',
    };
  };

  S.mudancas = (c) => {
    const leituras = {
      IPCA: ['Inflação esperada maior.', 'Inflação esperada menor.'], Selic: ['O mercado espera juros mais altos.', 'O mercado espera juros mais baixos.'],
      'PIB Total': ['Crescimento esperado maior.', 'Crescimento esperado menor.'], 'Câmbio': ['Dólar esperado mais caro.', 'Dólar esperado mais barato.'],
    };
    const lista = [];
    c.F.tabela.forEach((r) => r.valores.forEach((x) => {
      if (!x.variacao) return;
      let leitura = leituras[r.indicador][x.variacao > 0 ? 0 : 1];
      if (r.indicador === 'IPCA' && x.mediana > 4.5 && c.antes(x) <= 4.5) leitura += ' Passou do teto de 4,5%.';
      lista.push({ name: NOMES[r.indicador][0] + ' ' + x.ano, change: valorDe(r.indicador, c.antes(x)) + ' → ' + valorDe(r.indicador, x.mediana), read: leitura, peso: Math.abs(x.variacao) });
    }));
    lista.sort((a, b) => b.peso - a.peso);
    return { moves: lista.length ? lista.slice(0, 4) : [{ name: 'Nenhuma mudança', change: '', read: 'As medianas ficaram iguais às da semana anterior.' }] };
  };

  // ---------- como a expectativa evoluiu (52 semanas)
  S.historico = (c) => {
    const H = c.F.historico;
    if (!H) throw new Error('sem histórico do Focus');
    const ind = c.s.histInd, ano = c.anos[c.s.histAno];
    const serie = (H[ind] && H[ind][String(ano)]) || [];
    if (serie.length < 2) throw new Error('histórico curto');
    const dinheiro = ind === 'Câmbio';
    const g = P.linhas([{ valores: serie.map((x) => x.mediana), cor: ind === 'IPCA' ? AMBAR : AZUL, lastTxt: valorDe(ind, serie[serie.length - 1].mediana) }],
      serie.map((x) => P.ddmm(P.dia(x.data))), { L: 64, R: 680, T: 14, B: 196 },
      { passo: dinheiro ? 0.1 : (ind === 'Selic' ? 1 : 0.5), fmtTick: (t) => (dinheiro ? 'R$ ' + P.fmt(t) : P.fmt(t, 1) + '%'), maxRotulos: 7 });
    if (ind === 'IPCA') g.metaY = g.Y(3).toFixed(1);
    const q = sequencia(serie);
    return {
      hist: g, histTemMeta: ind === 'IPCA' && g.mn <= 3 && g.mx >= 3, histMetaY: ind === 'IPCA' ? g.Y(3).toFixed(1) : '0',
      histInds: Object.keys(NOMES).map((k) => ({ label: NOMES[k][0], on: ind === k ? 'true' : 'false', cls: ind === k ? 'pm-seg pm-seg-on' : 'pm-seg', pick: () => c.pn.setState({ histInd: k }) })),
      histAnos: c.anos.map((a, k) => ({ label: String(a), on: c.s.histAno === k ? 'true' : 'false', cls: c.s.histAno === k ? 'pm-seg pm-seg-on' : 'pm-seg', pick: () => c.pn.setState({ histAno: k }) })),
      histCaption: NOMES[ind][0] + ' de ' + ano + ': ' + textoSequencia(q, ind) + '. Há um ano, a mediana era ' + valorDe(ind, serie[0].mediana) + '.',
      histAria: 'Mediana semanal do Focus para ' + NOMES[ind][0] + ' de ' + ano + ', de ' + P.ddmm(P.dia(serie[0].data)) + ' a ' + P.ddmm(P.dia(serie[serie.length - 1].data)),
    };
  };

  // ---------- Selic esperada em cada reunião do Copom
  S.reunioes = (c) => {
    const R = c.F.reunioes;
    if (!R || !R.length) throw new Error('sem Selic por reunião');
    const passadas = new Set(c.decisoes.filter((d) => d.data < c.hoje).map((d) => d.reuniao));
    const lista = R.filter((r) => !passadas.has(r.reuniao)).slice(0, 8);
    const mn = Math.floor(Math.min(...lista.map((r) => r.minimo), c.selic)), mx = Math.ceil(Math.max(...lista.map((r) => r.maximo), c.selic));
    const pos = (v) => ((v - mn) / ((mx - mn) || 1) * 100).toFixed(2) + '%';
    return {
      reunioesLista: lista.map((r) => {
        const d = c.decisoes.find((x) => x.reuniao === r.reuniao);
        return {
          nome: d ? 'Decisão de ' + P.ddmmaaaa(d.data) : r.reuniao.replace(/^R(\d+)\/(\d+)$/, '$1ª reunião de $2'),
          sub: r.reuniao + ' · ' + r.respondentes + ' respostas' + (r.anterior != null && r.anterior !== r.mediana ? ' · era ' + P.pct(r.anterior) : ''),
          valor: P.pct(r.mediana),
          faixaStyle: 'position: absolute; top: 0; bottom: 0; left: ' + pos(r.minimo) + '; width: calc(' + pos(r.maximo) + ' - ' + pos(r.minimo) + '); border-radius: 9999px; background: rgba(143,176,255,.28)',
          dotStyle: 'position: absolute; top: 50%; left: ' + pos(r.mediana) + '; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 9999px; background: ' + AZUL + '; border: 2px solid rgba(10,10,10,.6); box-sizing: border-box',
        };
      }),
      reunioesHojeStyle: 'position: absolute; top: -4px; bottom: -4px; left: ' + pos(c.selic) + '; width: 2px; margin-left: -1px; background: rgba(237,237,237,.7)',
      reunioesEscala: [{ t: P.pct(mn, 0) }, { t: 'Selic hoje ' + P.pct(c.selic) }, { t: P.pct(mx, 0) }],
    };
  };

  // ---------- juro real de mercado (Tesouro IPCA+) e inflação implícita
  S.tesouro = (c) => {
    const T = c.D.tesouro;
    if (!T) throw new Error('sem dados do Tesouro');
    const a = T.atual, h = T.historico;
    const g = P.linhas([
      { valores: h.map((x) => x.real), cor: AZUL, lastTxt: P.pct(a.real) },
      { valores: h.map((x) => x.implicita), cor: AMBAR, lastTxt: P.pct(a.implicita) },
    ], h.map((x) => P.mesCurto(x.data.slice(0, 7))), { L: 48, R: 1100, T: 14, B: 196 }, { passo: 1, maxRotulos: 8 });
    const venc = P.dia(a.venc_ipca).getFullYear();
    const fx = c.I.map((x, k) => c.anos[k] + ': ' + P.pct(x.mediana)).join(', ');
    const dif = a.implicita - c.I[c.I.length - 1].mediana;
    return {
      tes: g,
      tesReal: P.pct(a.real), tesImplicita: P.pct(a.implicita), tesVenc: String(venc), tesData: P.ddmm(P.dia(a.data)),
      tesCaption: 'Tesouro IPCA+ ' + venc + ' paga IPCA + ' + P.pct(a.real) + ' ao ano; o Prefixado ' + P.dia(a.venc_pre).getFullYear() + ', ' + P.pct(a.prefixado) + '. A diferença dá a inflação implícita de '
        + P.pct(a.implicita) + ' ao ano, ' + (dif > 0 ? P.pp(dif) + ' acima' : P.pp(dif) + ' abaixo') + ' do IPCA esperado pelo Focus para ' + c.anos[2] + ' (Focus: ' + fx + '). Taxas de compra do Tesouro Direto.',
      tesAria: 'Juro real do Tesouro IPCA+ e inflação implícita, semana a semana, nos últimos 3 anos',
    };
  };

  // ---------- perguntas para ler o Focus, com a resposta do painel
  S.perguntas = (c) => {
    const { anos, I, S: Sf, F } = c;
    const H = F.historico || {};
    const dir = (x) => (x.variacao == null ? 'sem dado da semana anterior' : x.variacao === 0 ? 'ficou igual' : (x.variacao > 0 ? 'subiu ' : 'caiu ') + P.pp(x.variacao));
    const q4 = H.IPCA && H.IPCA[String(anos[1])] ? 'O IPCA de ' + anos[1] + ' ' + textoSequencia(sequencia(H.IPCA[String(anos[1])]), 'IPCA') + '.' : 'Sem histórico do Focus disponível.';
    const pib = F.tabela.find((r) => r.indicador === 'PIB Total').valores[0];
    const sinalIpca = Math.sign(I[0].variacao || 0) + Math.sign(I[1].variacao || 0), sinalPib = Math.sign(pib.variacao || 0);
    const humor = sinalIpca > 0 && sinalPib <= 0 ? 'mais pessimista: espera inflação maior' + (sinalPib < 0 ? ' e crescimento menor' : '')
      : sinalIpca < 0 && sinalPib >= 0 ? 'mais otimista: espera inflação menor' + (sinalPib > 0 ? ' e crescimento maior' : '')
        : 'sinais mistos: inflação e crescimento esperados não mudaram na mesma direção';
    const corte = c.selic - Sf[1].mediana;
    const itens = [
      ['A mediana do IPCA de ' + anos[0] + ' e ' + anos[1] + ' subiu, caiu ou ficou igual?', 'IPCA ' + anos[0] + ': ' + dir(I[0]) + '. IPCA ' + anos[1] + ': ' + dir(I[1]) + '.'],
      ['A expectativa para ' + anos[1] + ' está acima ou abaixo da meta de 3%?', P.pct(I[1].mediana) + ': ' + (I[1].mediana > 3 ? P.pp(I[1].mediana - 3) + ' acima' : I[1].mediana < 3 ? P.pp(3 - I[1].mediana) + ' abaixo' : 'exatamente na meta') + (I[1].mediana > 4.5 ? ', e acima do teto de 4,5%.' : '.')],
      ['O mercado espera cortes ou altas da Selic até o fim de ' + anos[1] + '?', 'Espera Selic de ' + P.pct(Sf[1].mediana) + ' no fim de ' + anos[1] + ': ' + (Math.abs(corte) < 0.001 ? 'sem mudança' : (corte > 0 ? 'cortes' : 'altas') + ' de ' + P.pp(corte)) + ' em relação aos ' + P.pct(c.selic) + ' de hoje.'],
      ['Há quantas semanas seguidas o IPCA de ' + anos[1] + ' vai na mesma direção?', q4],
      ['Em uma frase: o mercado ficou mais otimista ou pessimista?', 'Pela leitura do painel, ' + humor + '.'],
    ];
    const chave = 'pm-checks-' + F.coleta_ate;
    return {
      questions: itens.map((q, i) => ({
        text: q[0], resposta: q[1], checked: !!c.s.checks[i], show: !!c.s.checks[i],
        toggle: () => { const ch = c.s.checks.slice(); ch[i] = !ch[i]; P.gravar(chave, ch); c.pn.setState({ checks: ch }); },
      })),
      checksDone: c.s.checks.filter(Boolean).length + ' de 5 respondidas · marque para ver a resposta do painel',
    };
  };
})();
