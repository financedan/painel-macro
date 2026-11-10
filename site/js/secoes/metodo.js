/*
 * secoes/metodo.js — aba "Metodologia": fontes com status, contas, glossário, sobre e downloads.
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});

  const TITULOS = {
    kpis: 'Selic, IPCA e juro real', juroReal: 'Juro real', neutro: 'Juro neutro', copom: 'Copom', focus: 'Boletim Focus', meta: 'Meta de inflação',
    ancoragem: 'Ancoragem', ibov: 'Ibovespa', medo: 'Volatilidade', simulador: 'Fórmula de Fisher', mundo: 'Juro real no mundo', leitura: 'Leitura da semana',
    tesouro: 'Tesouro IPCA+ e inflação implícita', exante: 'Ex-ante e ex-post',
    reunioes: 'Focus por reunião', historico: 'Histórico do Focus', grupos: 'Grupos do IPCA', nucleos: 'Núcleos de inflação', selicLinha: 'Ciclos da Selic',
    atividade: 'Dólar, IBC-Br e dívida bruta',
  };

  S.metodo = (c) => {
    const D = c.D, M = c.M, F = D.fontes || {};
    const f = P.fontes;
    const status = (k) => (!F[k] ? '—' : F[k].ok ? 'ok' : 'falhou');
    const stCls = (k) => (F[k] && !F[k].ok ? 'color: #f0b37a' : 'color: #c2c2c2');
    const dt = (x) => P.ddmmaaaa(P.dia(x));
    const linhas = [
      ['Meta Selic', f('selic'), 'A cada Copom', P.pct(c.selic) + ' em vigor desde ' + dt(D.selic.desde) + (D.selic.decisao ? ' (decisão de ' + P.ddmm(P.dia(D.selic.decisao)) + ')' : ''), 'selic_e_ipca'],
      ['IPCA em 12 meses', f('ipca12'), 'Mensal', P.pct(c.ipca) + ' em ' + P.mesLongo(c.ipcaMes), 'selic_e_ipca'],
      ['IPCA do mês e média dos núcleos', f('ipcaMes', 'nucleos'), 'Mensal', D.ipca_mensal ? P.comSinal(D.ipca_mensal.valor, 2) + '% em ' + P.mesLongo(D.ipca_mensal.mes) : '—', 'inflacao_mensal'],
      ['IPCA por grupo', f('grupos'), 'Mensal', D.ipca_grupos ? P.mesLongo(D.ipca_grupos.mes) : '—', 'grupos_ipca'],
      ['Expectativas de mercado', f('focus', 'focusApi'), 'Semanal', 'Coleta até ' + dt(D.focus.coleta_ate), 'focus'],
      ['Ibovespa e volatilidade', f('ibov'), 'Diária', P.fmtPts(c.B.fechamento) + ' pontos em ' + P.ddmmaaaa(c.ibovData), 'ibovespa'],
      ['Dólar, atividade e dívida', f('dolar', 'ibcbr', 'divida'), 'Diária e mensal', D.economia ? 'Dólar ' + P.reais(D.economia.dolar.valor) + ' em ' + P.ddmm(P.dia(D.economia.dolar.data)) : '—', 'economia'],
      ['Tesouro Direto', f('tesouro'), 'Diária', D.tesouro ? 'Taxas de ' + dt(D.tesouro.atual.data) : '—', 'tesouro'],
      ['Calendário do Copom', [{ t: M.copom_fonte.texto, url: M.copom_fonte.url, sep: false, alvo: '_blank' }], 'Manual', 'Conferido em ' + dt(M.copom_fonte.conferido_em), null],
      ['Feriados e dias sem pregão', [{ t: 'B3, calendário de negociação', url: M.feriados_fonte.url, sep: false, alvo: '_blank' }], 'Manual', 'Conferido em ' + dt(M.feriados_fonte.conferido_em) + '; 2027 previsto', null],
      ['Taxa de juros real neutra', [{ t: 'BCB, RPM set/2026, p. 80', url: M.neutro.fonte.url, sep: false, alvo: '_blank' }], 'Manual', P.pct(c.neutro) + ' · conferido em ' + dt(M.neutro.fonte.conferido_em), null],
      ['Ranking mundial de juro real', [{ t: M.ranking_mundo.fonte.texto, url: M.ranking_mundo.fonte.url, sep: false, alvo: '_blank' }], 'Manual', 'Publicado em ' + dt(M.ranking_mundo.publicado_em), null],
      ['Atualização', [{ t: 'GitHub Actions + coletar.py', url: 'https://github.com/financedan/painel-macro/actions', sep: false, alvo: '_blank' }], 'Dias úteis, 19h', c.atualizado.ddmmaaaa + ' às ' + c.atualizado.hora, null],
    ];
    const vol = c.B.volatilidade;
    return {
      fontesLinhas: linhas.map((l) => ({ serie: l[0], origens: l[1], freq: l[2], ultima: l[3], status: l[4] ? status(l[4]) : 'manual', stStyle: l[4] ? stCls(l[4]) : 'color: #c2c2c2' })),
      referencias: Object.keys(P.FONTES).filter((k) => k !== 'calculo').map((k) => P.FONTES[k]),
      fisherExample: 'Hoje: (' + P.fmt(1 + c.selic / 100, 4) + ' ÷ ' + P.fmt(1 + c.ipca / 100, 4) + ') − 1 = ' + P.pct(c.realNow) + ' ao ano. A subtração simples daria ' + P.pct(c.selic - c.ipca) + '.',
      neutroValor: P.pct(c.neutro), neutroFonte: M.neutro.fonte.texto, neutroUrl: M.neutro.fonte.url,
      volMetodo: vol ? 'Desvio-padrão dos retornos logarítmicos diários dos últimos ' + vol.janela + ' pregões do Ibovespa (B3), multiplicado por √252. As faixas usam a mediana e o percentil 90 da própria série desde 2000; não há limite oficial de "turbulência".' : '',
      glossarioLista: Object.keys(P.glossario).map((k) => ({ titulo: TITULOS[k] || k, texto: P.glossario[k].texto, fontes: P.glossario[k].fontes })),
      diffs: [
        'Toda informação com fonte e link, direto do BC, IBGE, B3 e Tesouro',
        'Juro real pela fórmula exata de Fisher, ex-post e ex-ante (método do BC)',
        'Juro real de mercado (Tesouro IPCA+) e inflação implícita',
        'Inflação contra a meta, com contador da meta contínua',
        'Focus semana a semana, por reunião e com a faixa de respostas',
        'Contagem para o Copom e o que o mercado espera',
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
      ],
    };
  };
})();
