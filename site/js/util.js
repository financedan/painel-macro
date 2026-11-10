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
    const linhas = series.map((s, k) => {
      const pts = s.valores.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
      const ult = pts[pts.length - 1] || [0, 0];
      return { id: 'ln-' + (opc.chave || 'g') + '-' + k, d: PM.caminho(pts), cor: s.cor, largura: s.largura || 2.5, cls: s.tracejado ? 'pm-fade' : 'pm-draw', dash: s.tracejado ? 'stroke-dasharray: ' + s.tracejado : '', lastX: ult[0].toFixed(1), lastY: ult[1].toFixed(1), lastTxt: s.lastTxt || '', labelY: (ult[1] + 4).toFixed(1), labelX: (ult[0] + 10).toFixed(1) };
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

  // ---------- fontes: toda informação do painel aponta para uma delas
  const SGS = (c) => 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + c + '/dados/ultimos/12?formato=json';
  PM.FONTES = {
    selic: { t: 'BCB · SGS 432 (meta Selic)', url: SGS(432) },
    ipca12: { t: 'IBGE via BCB · SGS 13522 (IPCA 12 meses)', url: SGS(13522) },
    ipcaMes: { t: 'IBGE via BCB · SGS 433 (IPCA mensal)', url: SGS(433) },
    nucleos: { t: 'BCB · núcleos EX0, EX3, MS, DP e P55 (SGS 11427, 27839, 4466, 16122, 28750)', url: 'https://www.bcb.gov.br/content/publicacoes/notastecnicas/NT_57_202512.pdf' },
    mediaNucleos: { t: 'BCB · RPM set/2026, p. 36: "a média considera os núcleos EX0, EX3, MS, DP e P55"', url: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/202609/rpm202609p.pdf' },
    grupos: { t: 'IBGE · SIDRA, tabela 7060', url: 'https://sidra.ibge.gov.br/tabela/7060' },
    focus: { t: 'BCB · Boletim Focus', url: 'https://www.bcb.gov.br/publicacoes/focus' },
    focusApi: { t: 'BCB · API de expectativas (Olinda)', url: 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/aplicacao#!/recursos' },
    ibov: { t: 'B3 · Ibovespa (estatísticas do índice)', url: 'https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm' },
    ibovMetodo: { t: 'B3 · metodologia do Ibovespa: "índice de retorno total"', url: 'https://www.b3.com.br/data/files/9C/15/76/F6/3F6947102255C247AC094EA8/IBOV-Metodologia-pt-br__Novo_.pdf' },
    dolar: { t: 'BCB · SGS 1 (dólar, venda)', url: SGS(1) },
    ibcbr: { t: 'BCB · SGS 24364 (IBC-Br dessazonalizado)', url: SGS(24364) },
    divida: { t: 'BCB · SGS 13762 (dívida bruta do governo geral)', url: SGS(13762) },
    tesouro: { t: 'Tesouro Nacional · Tesouro Transparente (taxas do Tesouro Direto)', url: 'https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto' },
    metas: { t: 'BCB · histórico das metas para a inflação', url: 'https://www.bcb.gov.br/controleinflacao/historicometas' },
    metaContinua: { t: 'Decreto nº 12.079/2024 (meta contínua)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/d12079.htm' },
    neutro: { t: 'BCB · RPM set/2026, p. 80 (taxa neutra de 5,00%)', url: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/202609/rpm202609p.pdf' },
    exante: { t: 'BCB · RPM set/2026, p. 80 (Selic real ex-ante)', url: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/202609/rpm202609p.pdf' },
    copom: { t: 'BCB · Copom', url: 'https://www.bcb.gov.br/controleinflacao/copom' },
    copomCal: { t: 'BCB · calendário das reuniões do Copom', url: 'https://www.bcb.gov.br/controleinflacao/calendarioreunioescopom' },
    feriadosB3: { t: 'B3 · calendário de negociação', url: 'https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/calendario-de-negociacao/feriados/' },
    ranking: { t: 'Moneyou, via Agência Brasil (06/11/2026)', url: 'https://agenciabrasil.ebc.com.br/economia/noticia/2026-11/brasil-tem-maior-juro-real-do-mundo-seguido-por-turquia-e-argentina' },
    calculo: { t: 'cálculo do painel com os dados acima (método na Metodologia)', url: '#metodologia' },
  };
  // lista de fontes pronta para o modelo: [{t, url, sep}]
  PM.fontes = (...chaves) => chaves.map((k, i) => Object.assign({ sep: i < chaves.length - 1, alvo: PM.FONTES[k].url.startsWith('#') ? '_self' : '_blank' }, PM.FONTES[k]));

  // ---------- glossário: definições curtas, cada uma com a sua fonte
  const G = (texto, ...fontes) => ({ texto, fontes: PM.fontes(...fontes) });
  PM.glossario = {
    kpis: G('A Selic é a taxa básica de juros da economia, definida pelo Copom. O IPCA, calculado pelo IBGE, é a inflação oficial do país. O juro real é a taxa de juros descontada a inflação.', 'copom', 'ipca12'),
    juroReal: G('Juro real é a taxa de juros descontada a inflação. O painel usa a fórmula de Fisher: (1 + juro) ÷ (1 + inflação) − 1.', 'exante'),
    neutro: G('Taxa de juros real neutra é a que não acelera nem desacelera a economia. Não é observável: o BC a estima por várias metodologias e usou 5,00% nas projeções de setembro de 2026. Selic real acima da neutra significa política monetária contracionista.', 'neutro'),
    copom: G('O Copom é o comitê do Banco Central que define a meta da Selic. São oito reuniões ordinárias por ano, de dois dias; a decisão é divulgada no segundo dia e a ata, na semana seguinte.', 'copom', 'copomCal'),
    focus: G('O Boletim Focus resume as projeções de instituições financeiras e consultorias coletadas pelo Banco Central, publicado às segundas-feiras. O painel mostra a mediana das respostas.', 'focus'),
    meta: G('A meta de inflação é de 3%, com intervalo de tolerância de 1,5 ponto para cima ou para baixo. Desde 2025 a meta é contínua: ela é considerada descumprida quando o IPCA de 12 meses fica fora do intervalo por seis meses seguidos, e o BC publica carta aberta ao Ministro da Fazenda.', 'metas', 'metaContinua'),
    ancoragem: G('Expectativas ancoradas são as que ficam próximas da meta. O termômetro compara as medianas do Focus com a meta de 3% e o teto de 4,5%.', 'focus', 'metas'),
    ibov: G('O Ibovespa é o principal indicador de desempenho das ações negociadas na B3. É um índice de retorno total: os proventos (como dividendos) são reinvestidos na carteira teórica.', 'ibov', 'ibovMetodo'),
    medo: G('Volatilidade realizada: desvio-padrão dos retornos diários do Ibovespa em 21 pregões, anualizado. As faixas comparam o valor de hoje com o histórico do próprio índice desde 2000 (mediana e 10% mais altos).', 'ibov', 'calculo'),
    simulador: G('O simulador aplica a fórmula de Fisher e compara o resultado com a taxa neutra de 5,00% do BC: acima dela, política contracionista; abaixo, estimulativa.', 'neutro'),
    mundo: G('Ranking de juros reais de 40 países feito pela consultoria Moneyou. A metodologia é da própria consultoria e pode diferir da do BC.', 'ranking'),
    leitura: G('Comentário do autor sobre o Focus da semana. Sem leitura nova, o painel mostra um resumo gerado automaticamente com as mudanças das medianas.', 'focus'),
    tesouro: G('O Tesouro IPCA+ paga a inflação mais uma taxa fixa (o juro real de mercado). O Tesouro Prefixado paga uma taxa fixa total. A inflação implícita é a que iguala os dois, pela fórmula de Fisher.', 'tesouro'),
    exante: G('Ex-post usa a inflação que já aconteceu (últimos 12 meses). Ex-ante segue o método do BC: Selic esperada para os próximos 12 meses descontada da inflação esperada para o mesmo período, ambas do Focus.', 'exante', 'focus'),
    reunioes: G('O Focus também pergunta a Selic esperada em cada reunião do Copom. R8/2026 é a oitava reunião de 2026.', 'focus', 'focusApi'),
    historico: G('Cada ponto é a mediana do Focus numa semana (último dia de coleta da semana).', 'focus', 'focusApi'),
    grupos: G('O IPCA é formado por nove grupos de preços, cada um com um peso. A contribuição de um grupo no mês é a variação vezes o peso.', 'grupos'),
    nucleos: G('Núcleos são medidas de inflação que excluem ou suavizam itens voláteis. O painel usa a mesma média que o BC: EX0, EX3, MS, DP e P55, cada um acumulado em 12 meses.', 'mediaNucleos', 'nucleos'),
    selicLinha: G('Cada degrau é uma mudança da meta da Selic decidida pelo Copom. O ciclo atual é a sequência de mudanças na mesma direção.', 'selic'),
    atividade: G('Dólar: cotação PTAX de venda, do BC. IBC-Br: indicador mensal de atividade econômica do BC, uma prévia do PIB; o painel compara os últimos 12 meses com os 12 anteriores. Dívida bruta do governo geral em % do PIB: BC.', 'dolar', 'ibcbr', 'divida'),
  };
})();
