/*
 * secoes/agenda.js — calendário macro com navegação entre meses e exportação .ics.
 */
(function () {
  const P = window.PM, S = (P.secoes = P.secoes || {});
  const { AZUL, AMBAR, OSSO } = P.cores;
  const CORES = { Focus: AZUL, Copom: AMBAR, Ata: OSSO };
  const faixa = (t) => 'width: 3px; align-self: stretch; min-height: 28px; border-radius: 9999px; flex: 0 0 auto; background: ' + (CORES[t] || 'rgba(237,237,237,.35)');
  const ponto = (t) => 'width: 6px; height: 6px; border-radius: 9999px; ' + (CORES[t] ? 'background: ' + CORES[t] : 'border: 1px solid #c2c2c2; box-sizing: border-box');

  S.agenda = (c) => {
    const s = c.s, pn = c.pn;
    const base = new Date(c.hoje.getFullYear(), c.hoje.getMonth() + s.agendaMes, 1);
    const ano = base.getFullYear(), mes = base.getMonth();
    const ehMesAtual = s.agendaMes === 0;
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const dia = Math.min(s.day, diasNoMes);
    const doDia = (d) => c.eventos.filter((x) => x.data.getFullYear() === ano && x.data.getMonth() === mes && x.data.getDate() === d);
    const calendar = [];
    for (let i = 0; i < base.getDay(); i++) calendar.push({ blank: true, real: false, dots: [] });
    for (let d = 1; d <= diasNoMes; d++) {
      const lista = doDia(d), on = dia === d, hoje = ehMesAtual && d === c.hoje.getDate();
      calendar.push({
        blank: false, real: true, n: String(d), on: on ? 'true' : 'false',
        cls: 'pm-day' + (on ? ' pm-day-on' : '') + (hoje ? ' pm-day-hoje' : ''),
        aria: d + ' de ' + P.MESES_LONGOS[mes] + (hoje ? ', hoje' : '') + (lista.length ? ', ' + lista.map((x) => x.titulo).join(', ') : ''),
        pick: () => pn.setState({ day: d }),
        dots: lista.map((x) => ({ style: ponto(x.tipo) })),
      });
    }
    while (calendar.length % 7 !== 0) calendar.push({ blank: true, real: false, dots: [] });
    const prox = new Date(ano, mes + 1, 1);
    const ultimaReuniao = c.decisoes.length ? c.decisoes[c.decisoes.length - 1].data : null;
    const semCopom = !ultimaReuniao || new Date(ano, mes + 1, 0) > ultimaReuniao;
    const ir = (n) => () => pn.setState({ agendaMes: s.agendaMes + n, day: s.agendaMes + n === 0 ? c.hoje.getDate() : 1 });
    const futuros = c.eventos.filter((x) => x.data >= c.hoje && x.data <= P.somaDias(c.hoje, 183) && !x.primeiroDia);
    return {
      agendaSub: P.maiuscula(P.MESES_LONGOS[mes]) + ' de ' + ano + ' · toque em um dia para ver os eventos',
      agendaMonth: P.maiuscula(P.MESES_LONGOS[mes]) + (ano !== c.hoje.getFullYear() ? ' de ' + ano : ''),
      nextMonthName: P.maiuscula(P.MESES_LONGOS[prox.getMonth()]) + (prox.getFullYear() !== c.hoje.getFullYear() ? ' de ' + prox.getFullYear() : ''),
      calendar,
      dayTitle: dia + ' de ' + P.MESES_LONGOS[mes] + ' · ' + P.SEMANA[new Date(ano, mes, dia).getDay()] + (ehMesAtual && dia === c.hoje.getDate() ? ' (hoje)' : ''),
      dayEvents: doDia(dia).map((x) => ({ title: x.titulo, desc: x.desc, accent: faixa(x.tipo) })),
      dayEmpty: doDia(dia).length === 0,
      proxMes: c.eventos.filter((x) => x.data.getFullYear() === prox.getFullYear() && x.data.getMonth() === prox.getMonth() && !x.primeiroDia)
        .map((x) => ({ day: P.ddmm(x.data), title: x.titulo, accent: faixa(x.tipo) })),
      agendaPrev: ir(-1), agendaNext: ir(1), agendaHoje: () => pn.setState({ agendaMes: 0, day: c.hoje.getDate() }),
      agendaPrevOff: s.agendaMes <= -3, agendaNextOff: s.agendaMes >= 12, agendaForaDeHoje: !ehMesAtual,
      agendaAviso: semCopom ? 'As reuniões do Copom depois de ' + (ultimaReuniao ? P.ddmmaaaa(ultimaReuniao) : 'hoje') + ' ainda não foram cadastradas no painel. Focus e feriados aparecem normalmente.' : '',
      hasAgendaAviso: semCopom,
      hasOutros: c.eventos.some((x) => !CORES[x.tipo] && x.tipo !== 'Feriado'),
      baixarIcs: () => P.ics('agenda-macro.ics', futuros),
      icsTxt: 'Adicionar à minha agenda (' + futuros.length + ' eventos, .ics)',
    };
  };
})();
