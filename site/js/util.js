/*
 * util.js — peças usadas por todas as seções do painel.
 *
 * Regras de formato (valem para o painel inteiro):
 *   datas curtas ..... 06/11            datas longas ..... 6 de novembro
 *   taxas ............ 2 casas (13,75%) rótulos de gráfico 1 casa (8,8%)
 *   bolsa ............ variações com 1 casa (−0,4%), pontos sem casas (168.499)
 *   valor ausente .... "—" (nunca "0,00%")
 *
 * Regras de cor:
 *   azul  = o valor de agora / destaque atual (e juro real)
 *   âmbar = inflação e alertas (acima do teto, turbulência)
 *   osso/cinza = histórico e referências
 */
(function () {
  const PM = (window.PM = window.PM || {});

  PM.cores = {
    AZUL: '#8fb0ff', AMBAR: '#f0b37a', OSSO: '#ededed',
    HIST: 'rgba(237,237,237,.26)', HIST_ON: 'rgba(237,237,237,.58)',
  };
  PM.MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  PM.MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  PM.SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  const vazio = (v) => v == null || Number.isNaN(Number(v));
  PM.fmt = (v, d = 2) => (vazio(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',').replace('-', '−'));
  PM.pct = (v, d = 2) => (vazio(v) ? '—' : PM.fmt(v, d) + '%');
  PM.comSinal = (v, d = 1) => (vazio(v) ? '—' : (v > 0 ? '+' : '') + PM.fmt(v, d));
  PM.pp = (v, d = 2) => (vazio(v) ? '—' : PM.fmt(Math.abs(v), d) + ' p.p.');
  PM.fmtPts = (v) => (vazio(v) ? '—' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  PM.reais = (v) => (vazio(v) ? '—' : 'R$ ' + PM.fmt(v));
  PM.fisher = (selic, ipca) => (vazio(selic) || vazio(ipca) ? null : ((1 + selic / 100) / (1 + ipca / 100) - 1) * 100);
  PM.seta = (v) => (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '= ');
  PM.maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- datas (sempre sem fuso: "2026-11-06" vira 6/11 local, à meia-noite)
  PM.dia = (texto) => { const [a, m, d] = String(texto).slice(0, 10).split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1); };
  PM.chave = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  PM.somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  PM.difDias = (a, b) => Math.round((a - b) / 864e5);
  PM.ddmm = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  PM.ddmmaaaa = (d) => PM.ddmm(d) + '/' + d.getFullYear();
  PM.dataLonga = (d) => d.getDate() + ' de ' + PM.MESES_LONGOS[d.getMonth()];
  PM.mesCurto = (ym) => { const [a, m] = ym.split('-').map(Number); return PM.MESES[m - 1] + '/' + String(a).slice(2); };
  PM.mesLongo = (ym) => { const [a, m] = ym.split('-').map(Number); return PM.MESES_LONGOS[m - 1] + ' de ' + a; };
  PM.nomeMes = (ym) => PM.MESES_LONGOS[Number(ym.slice(5, 7)) - 1];

  // "hoje" e horas sempre no fuso de Brasília, para todo visitante ver as mesmas datas
  const FUSO = 'America/Sao_Paulo';
  PM.hojeBR = () => PM.dia(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date()));
  PM.dataHoraBR = (iso) => {
    const p = {};
    new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
    return { ddmm: p.day + '/' + p.month, ddmmaaaa: p.day + '/' + p.month + '/' + p.year, hora: Number(p.hour) + 'h' + p.minute, data: PM.dia(p.year + '-' + p.month + '-' + p.day) };
  };
  PM.haDias = (n) => (n <= 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias');
  PM.diasUteisEntre = (a, b) => { let n = 0; for (let d = PM.somaDias(a, 1); d <= b; d = PM.somaDias(d, 1)) if (d.getDay() % 6) n++; return n; };

  // ---------- SVG
  PM.caminho = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  /*
   * Gráfico de linhas genérico. series: [{valores: [...], cor}], rotulos: textos do eixo x (um por ponto).
   * caixa: {L, R, T, B}. Devolve caminhos, marcas do eixo y e rótulos do eixo x prontos para o modelo.
   */
  PM.linhas = (series, rotulos, caixa, opc = {}) => {
    const todos = series.flatMap((s) => s.valores).filter((v) => v != null);
    let mn = Math.min(...todos, ...(opc.incluir || [])), mx = Math.max(...todos, ...(opc.incluir || []));
    const folga = (mx - mn) * 0.08 || 1;
    mn = Math.floor(mn - folga); mx = Math.ceil(mx + folga);
    const passo = opc.passo || Math.max(1, Math.ceil((mx - mn) / 5));
    mn = Math.floor(mn / passo) * passo; mx = Math.ceil(mx / passo) * passo;
    const n = rotulos.length;
    const X = (i) => caixa.L + (n > 1 ? i / (n - 1) : 0.5) * (caixa.R - caixa.L);
    const Y = (v) => caixa.T + (mx - v) / ((mx - mn) || 1) * (caixa.B - caixa.T);
    const ticks = [];
    for (let t = mn; t <= mx + 1e-9; t += passo) ticks.push({ y: Y(t).toFixed(1), ty: (Y(t) + 4).toFixed(1), label: (opc.fmtTick || ((x) => PM.fmt(x, 0) + '%'))(t) });
    const cada = Math.max(1, Math.ceil(n / (opc.maxRotulos || 6)));
    const xlabels = rotulos.map((r, i) => ({ x: X(i).toFixed(1), label: r, i })).filter((r) => r.i % cada === 0 || r.i === n - 1)
      .filter((r, k, arr) => !(r.i === n - 1 && k > 0 && r.i - arr[k - 1].i < cada * 0.6));
    const linhas = series.map((s) => {
      const pts = s.valores.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
      const ult = pts[pts.length - 1] || [0, 0];
      return { d: PM.caminho(pts), cor: s.cor, largura: s.largura || 2.5, cls: s.tracejado ? 'pm-fade' : 'pm-draw', dash: s.tracejado ? 'stroke-dasharray: ' + s.tracejado : '', lastX: ult[0].toFixed(1), lastY: ult[1].toFixed(1), lastTxt: s.lastTxt || '', labelY: (ult[1] + 4).toFixed(1), labelX: (ult[0] + 10).toFixed(1) };
    });
    // rótulos do fim das linhas muito próximos: afasta um do outro
    const ord = linhas.slice().sort((a, b) => Number(a.labelY) - Number(b.labelY));
    for (let i = 1; i < ord.length; i++) {
      const dif = Number(ord[i].labelY) - Number(ord[i - 1].labelY);
      if (dif < 15) ord[i].labelY = (Number(ord[i - 1].labelY) + 15).toFixed(1);
    }
    return { linhas, ticks, xlabels, X, Y, mn, mx };
  };

  // ---------- armazenamento local (tudo opcional: em navegação privada vale só na visita)
  PM.ler = (chave, padrao) => { try { const v = localStorage.getItem(chave); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } };
  PM.gravar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* ok */ } };

  // ---------- downloads
  PM.baixar = (nome, conteudo, tipo) => {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  PM.csv = (nome, cabecalho, linhas) => {
    const cel = (x) => { const t = x == null ? '' : String(x); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const texto = [cabecalho, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n');
    PM.baixar(nome, '﻿' + texto, 'text/csv;charset=utf-8');  // ; e BOM: abre certo no Excel em português
  };
  PM.ics = (nome, eventos) => {
    const d8 = (d) => PM.chave(d).replace(/-/g, '');
    const esc = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c);
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Painel Macro Brasil//PT-BR', 'CALSCALE:GREGORIAN'];
    eventos.forEach((ev, i) => {
      linhas.push('BEGIN:VEVENT', 'UID:' + d8(ev.data) + '-' + i + '@painel-macro', 'DTSTAMP:' + d8(new Date()) + 'T000000Z',
        'DTSTART;VALUE=DATE:' + d8(ev.data), 'DTEND;VALUE=DATE:' + d8(PM.somaDias(ev.data, 1)),
        'SUMMARY:' + esc(ev.titulo), 'DESCRIPTION:' + esc(ev.desc || ''), 'END:VEVENT');
    });
    linhas.push('END:VCALENDAR');
    PM.baixar(nome, linhas.join('\r\n'), 'text/calendar;charset=utf-8');
  };

  // ---------- markdown mínimo (parágrafos e **negrito**) para a leitura da semana
  PM.paragrafos = (texto) => String(texto || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => ({
    partes: p.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith('**') ? { t: t.slice(2, -2), b: true, n: false } : { t: t, b: false, n: true })),
  }));

  PM.icones = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
    calendar: 'M6 4.5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3zM3 9.5h18M8 2.5v4M16 2.5v4',
    book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
    pulse: 'M3 12h4l3-7 4 14 3-7h4',
    percent: 'M19 5 5 19M9.5 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-5',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    bars: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  };

  // ---------- glossário: aparece nos botões "?" e no modo explicativo
  PM.glossario = {
    kpis: 'Os números do dia. A Selic é a taxa básica de juros, definida pelo Copom. O IPCA é a inflação oficial. O juro real é quanto a Selic rende acima da inflação.',
    juroReal: 'Juro real = quanto o dinheiro rende de verdade, depois de descontar a inflação. Juro real alto freia a economia (crédito caro, renda fixa rendendo bem); baixo estimula.',
    neutro: 'Juro neutro é o juro real que nem acelera nem freia a economia. Ninguém observa esse número: ele é estimado. Acima dele, a política monetária é contracionista.',
    copom: 'O Copom é o comitê do Banco Central que define a Selic, oito vezes por ano. A decisão sai na quarta-feira à noite e a ata na terça seguinte.',
    focus: 'O Boletim Focus reúne as projeções de mais de 100 bancos e consultorias, toda semana. O painel mostra a mediana: metade espera mais, metade espera menos.',
    meta: 'A meta de inflação é 3% ao ano, com tolerância de 1,5 ponto para cima ou para baixo (1,5% a 4,5%). Desde 2025 ela é contínua: a meta é descumprida se o IPCA de 12 meses ficar fora da banda por 6 meses seguidos.',
    ancoragem: 'Expectativas "ancoradas" são as que ficam perto da meta mesmo quando a inflação de hoje está alta. Se elas sobem, fica mais caro trazer a inflação de volta.',
    ibov: 'O Ibovespa é o principal índice da bolsa brasileira: uma carteira com as ações mais negociadas. Os pontos não são reais, servem para comparar períodos.',
    medo: 'A volatilidade mede o tamanho das oscilações diárias da bolsa. Quanto maior, mais incerteza. Acima de 30% ao ano, o mercado costuma estar em turbulência.',
    simulador: 'Mexa nas duas taxas para ver o juro real. A fórmula de Fisher divide em vez de subtrair, porque a inflação também corrói os juros recebidos.',
    mundo: 'Comparar o juro real entre países mostra o quanto o Brasil paga para atrair capital. Juro alto atrai investidor estrangeiro e tende a segurar o dólar.',
    leitura: 'Comentário do autor sobre o Focus da semana. Quando ainda não há texto novo, o painel mostra um resumo automático.',
    comparacao: 'Mostra quanto R$ 100 aplicados há 10 anos teriam virado na bolsa (Ibovespa, sem dividendos) e no CDI, a referência da renda fixa.',
    calculadora: 'Estimativa simples: considera as taxas de hoje constantes, o imposto de renda regressivo e a inflação esperada pelo Focus. Não é recomendação de investimento.',
    tesouro: 'O Tesouro IPCA+ paga inflação mais uma taxa fixa: essa taxa é o juro real que o mercado exige hoje. Comparando com o Prefixado, sai a inflação que o mercado embute nos preços (implícita).',
    exante: 'Ex-post usa a inflação que já aconteceu (últimos 12 meses). Ex-ante usa a inflação esperada para os próximos 12 meses: é a medida que o Banco Central acompanha.',
    reunioes: 'O Focus também pergunta a Selic esperada em cada reunião do Copom. R8/2026 é a oitava reunião de 2026.',
    historico: 'Cada ponto é a mediana do Focus numa semana. Assim dá para ver se as expectativas estão subindo, caindo ou paradas.',
    grupos: 'O IPCA é a média de nove grupos de preços, cada um com um peso no orçamento das famílias. A contribuição é variação × peso.',
    nucleos: 'Núcleos tiram ou suavizam os preços mais voláteis (alimentos, energia) para mostrar a tendência da inflação. O painel usa a média de cinco núcleos acompanhados pelo BC.',
    selicLinha: 'Cada degrau é uma decisão do Copom que mudou a Selic. Um ciclo é uma sequência de cortes ou de altas.',
    atividade: 'IBC-Br é a prévia mensal do PIB feita pelo Banco Central. Desemprego vem da PNAD Contínua (IBGE). Dívida bruta mede o quanto o governo deve, em % do PIB.',
    cambio: 'O diferencial de juros é a diferença entre a Selic e o juro de curto prazo dos EUA. Quanto maior, mais atraente fica aplicar no Brasil.',
  };
})();
