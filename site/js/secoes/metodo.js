/*
 * secoes/metodo.js — aba "Metodologia": fontes com status, contas, glossário, sobre e downloads.
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});

  const TITULOS = {
    kpis: 'Selic, IPCA e juro real', juroReal: 'Juro real', neutro: 'Juro neutro', copom: 'Copom', focus: 'Boletim Focus', meta: 'Meta de inflação',
    ancoragem: 'Ancoragem', ibov: 'Ibovespa', medo: 'Volatilidade', simulador: 'Fórmula de Fisher', mundo: 'Juro real no mundo', leitura: 'Leitura da semana',
    comparacao: 'Bolsa x CDI', calculadora: 'Calculadora de rendimento', tesouro: 'Tesouro IPCA+ e inflação implícita', exante: 'Ex-ante e ex-post',
    reunioes: 'Focus por reunião', historico: 'Histórico do Focus', grupos: 'Grupos do IPCA', nucleos: 'Núcleos de inflação', selicLinha: 'Ciclos da Selic',
    atividade: 'IBC-Br, desemprego e dívida', cambio: 'Diferencial de juros',
  };

  S.metodo = (c) => {
    const D = c.D, M = c.M, F = D.fontes || {};
    const status = (k) => (!F[k] ? '—' : F[k].ok ? 'ok' : 'falhou');
    const stCls = (k) => (F[k] && !F[k].ok ? 'color: #f0b37a' : 'color: #c2c2c2');
    const vix = M.vix && M.vix.leituras.length ? M.vix.leituras[M.vix.leituras.length - 1] : null;
    const linhas = [
      ['Meta Selic', 'BC, SGS 432', 'A cada Copom', P.pct(c.selic) + ' em vigor desde ' + P.ddmmaaaa(P.dia(D.selic.desde)) + (D.selic.decisao ? ' (decisão de ' + P.ddmm(P.dia(D.selic.decisao)) + ')' : ''), 'selic_e_ipca'],
      ['IPCA em 12 meses', 'IBGE via BC, SGS 13522', 'Mensal', P.pct(c.ipca) + ' em ' + P.mesLongo(c.ipcaMes), 'selic_e_ipca'],
      ['IPCA do mês e núcleos', 'BC, SGS 433, 4466, 16122, 27838, 27839, 28751', 'Mensal', D.ipca_mensal ? P.comSinal(D.ipca_mensal.valor, 2) + '% em ' + P.mesLongo(D.ipca_mensal.mes) : '—', 'inflacao_mensal'],
      ['IPCA por grupo', 'IBGE, SIDRA tabela 7060', 'Mensal', D.ipca_grupos ? P.mesLongo(D.ipca_grupos.mes) : '—', 'grupos_ipca'],
      ['Expectativas de mercado', 'Boletim Focus (BC, API Olinda)', 'Semanal', 'Coleta até ' + P.ddmmaaaa(c.coleta), 'focus'],
      ['Ibovespa e volatilidade', 'Yahoo Finance via yfinance (^BVSP)', 'Diária', P.fmtPts(c.B.fechamento) + ' pontos em ' + P.ddmmaaaa(c.ibovData), 'ibovespa'],
      ['CDI e dólar', 'BC, SGS 12 e 1', 'Diária', D.comparacao ? 'CDI até ' + P.ddmmaaaa(P.dia(D.comparacao.cdi_data)) : '—', 'comparacao'],
      ['Atividade, emprego, dívida, IGP-M, TR', 'BC, SGS 24364, 24369, 13762, 189, 7811', 'Mensal', D.economia ? 'Dólar ' + P.reais(D.economia.dolar.valor) + ' em ' + P.ddmm(P.dia(D.economia.dolar.data)) : '—', 'economia'],
      ['Tesouro Direto', 'Tesouro Transparente (preços e taxas)', 'Diária', D.tesouro ? 'Taxas de ' + P.ddmmaaaa(P.dia(D.tesouro.atual.data)) : '—', 'tesouro'],
      ['Juros e petróleo no mundo', 'Yahoo Finance (^IRX, ^TNX, BZ=F)', 'Diária', D.mundo ? P.ddmmaaaa(P.dia(D.mundo.tbill3m.data)) : '—', 'mundo'],
      ['S&P/B3 Ibovespa VIX', M.vix ? 'Imprensa (' + M.vix.fonte + ')' : '—', 'Manual', vix ? P.fmt(vix[1]) + ' em ' + P.ddmmaaaa(P.dia(vix[0])) : '—', null],
      ['Ranking mundial de juro real', M.ranking_mundo.fonte, 'Manual', P.mesLongo(M.ranking_mundo.mes), null],
      ['Atualização', 'GitHub Actions + coletar.py', 'Dias úteis, 19h', c.atualizado.ddmmaaaa + ' às ' + c.atualizado.hora, null],
    ];
    const vol = c.B.volatilidade;
    return {
      fontesLinhas: linhas.map((l) => ({ serie: l[0], origem: l[1], freq: l[2], ultima: l[3], status: l[4] ? status(l[4]) : 'manual', stStyle: l[4] ? stCls(l[4]) : 'color: #c2c2c2' })),
      fisherExample: 'Hoje: (' + P.fmt(1 + c.selic / 100, 4) + ' ÷ ' + P.fmt(1 + c.ipca / 100, 4) + ') − 1 = ' + P.pct(c.realNow) + ' ao ano. A subtração simples daria ' + P.pct(c.selic - c.ipca) + '.',
      neutroValor: P.pct(c.neutro), neutroFonte: M.neutro ? M.neutro.fonte : '', neutroRevisado: M.neutro && M.neutro.revisado_em ? 'Revisado em ' + P.ddmmaaaa(P.dia(M.neutro.revisado_em)) + '.' : '',
      volMetodo: vol ? 'Desvio-padrão dos retornos logarítmicos diários dos últimos ' + vol.janela + ' pregões, multiplicado por √252 para virar taxa anual. Substitui o índice do medo digitado à mão, que não tem fonte gratuita automática.' : '',
      glossarioLista: Object.keys(P.glossario).map((k) => ({ titulo: TITULOS[k] || k, texto: P.glossario[k] })),
      diffs: [
        'Juro real pela fórmula exata de Fisher, ex-post e ex-ante',
        'Juro real de mercado (Tesouro IPCA+) e inflação implícita',
        'Inflação contra a meta, com contador da meta contínua',
        'Focus semana a semana, por reunião e com a faixa de respostas',
        'Contagem para o Copom e o que o mercado espera',
        'Bolsa x renda fixa e calculadora de rendimento',
        'Dados atualizados sozinhos todo dia útil, com aviso quando uma fonte falha',
      ].map((t, i) => ({ text: t, n: String(i + 1).padStart(2, '0') })),
      sobreTxt: 'Projeto de estudo de ' + M.autor.nomeCompleto + ' para acompanhar juros, inflação e expectativas no Brasil em um só lugar, com as contas explicadas. Os dados são públicos e o código é aberto.',
      citacao: M.autor.nomeCompleto + '. Painel Macro Brasil. Disponível em: ' + M.site_url + '. Acesso em: ' + P.ddmmaaaa(c.hoje) + '.',
      siteUrl: M.site_url, feedUrl: 'feed.xml',
      downloads: [
        { label: 'Selic e IPCA mês a mês', go: () => {
          const ip = {}; D.ipca12m.historico.forEach((x) => { ip[x.mes] = x.valor; });
          P.csv('selic-ipca.csv', ['mes', 'selic_fim_do_mes', 'ipca_12m', 'juro_real'], D.selic.fim_de_mes.map((x) => [x.mes, x.valor, ip[x.mes] ?? '', ip[x.mes] != null ? P.fmt(P.fisher(x.valor, ip[x.mes])) : '']));
        } },
        { label: 'Decisões do Copom', go: () => P.csv('decisoes-copom.csv', ['decisao', 'vigencia', 'de', 'para'], (D.selic.mudancas || []).map((m) => [m.decisao, m.vigencia, m.de, m.para])) },
        { label: 'Focus da semana', go: () => P.csv('focus-' + D.focus.coleta_ate + '.csv', ['indicador', 'ano', 'mediana', 'variacao_semana', 'minimo', 'maximo', 'respondentes'],
          D.focus.tabela.flatMap((r) => r.valores.map((v) => [r.indicador, v.ano, v.mediana, v.variacao, v.minimo, v.maximo, v.respondentes]))) },
        { label: 'Focus semana a semana', go: () => {
          const H = D.focus.historico || {}; const linhas = [];
          Object.keys(H).forEach((ind) => Object.keys(H[ind]).forEach((ano) => H[ind][ano].forEach((x) => linhas.push([ind, ano, x.data, x.mediana]))));
          P.csv('focus-historico.csv', ['indicador', 'ano', 'coleta', 'mediana'], linhas);
        } },
        { label: 'Ibovespa por ano', go: () => P.csv('ibovespa-anual.csv', ['ano', 'fechamento', 'retorno_pct'], c.B.por_ano.map((r) => [r.ano, r.fechamento, r.retorno])) },
        { label: 'Bolsa x CDI (base 100)', go: () => P.csv('bolsa-x-cdi.csv', ['mes', 'ibovespa', 'cdi', 'ibovespa_real', 'ibovespa_dolar'], (D.comparacao ? D.comparacao.serie : []).map((x) => [x.mes, x.ibov, x.cdi, x.ibov_real, x.ibov_dolar])) },
      ],
    };
  };
})();
