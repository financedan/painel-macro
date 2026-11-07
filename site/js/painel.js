/*
 * painel.js — a lógica do Painel Macro Brasil.
 * Lê o dados.json (gerado pelo coletar.py) e o manual.js, faz as contas
 * e entrega para o modelo do index.html tudo o que aparece na tela.
 */
(function () {
  const AZUL = '#8fb0ff', AMBAR = '#f0b37a', OSSO = '#ededed';
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  // Meta de inflação de cada ano (CMN). Desde 2025 a meta é contínua de 3%.
  const META = { 2017: 4.5, 2018: 4.5, 2019: 4.25, 2020: 4.0, 2021: 3.75, 2022: 3.5, 2023: 3.25, 2024: 3.0 };
  const meta = (ano) => META[ano] ?? 3.0;

  // ---------- formatação e datas
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',').replace('-', '−');
  const comSinal = (v, d = 1) => (v > 0 ? '+' : '') + fmt(v, d);
  const fmtPts = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fisher = (selic, ipca) => ((1 + selic / 100) / (1 + ipca / 100) - 1) * 100;
  const dia = (texto) => { const [a, m, d] = texto.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
  const chave = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const dm = (d) => d.getDate() + '/' + (d.getMonth() + 1);                                   // 4/11
  const ddmm = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  const ddmmaaaa = (d) => ddmm(d) + '/' + d.getFullYear();
  const diaMes = (d) => d.getDate() + '/' + MESES[d.getMonth()];                              // 23/out
  const mesLongo = (ym) => { const [a, m] = ym.split('-').map(Number); return MESES_LONGOS[m - 1] + ' de ' + a; };
  const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const caminho = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  const icones = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
    calendar: 'M6 4.5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3zM3 9.5h18M8 2.5v4M16 2.5v4',
    book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
    percent: 'M19 5 5 19M9.5 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-5',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    bars: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  };

  // ---------- agenda: Copom e feriados do manual.js + Focus toda segunda
  function montarEventos(M, hoje) {
    const feriados = {};
    M.feriados.forEach((f) => { feriados[f[0]] = f; });
    const lista = [];
    M.feriados.forEach((f) => lista.push({ data: dia(f[0]), tipo: 'Feriado', titulo: f[1], desc: f[2] }));
    M.copom.forEach((c) => {
      const decisao = dia(c.decisao);
      lista.push({ data: dia(c.inicio), tipo: 'Copom', titulo: 'Copom: 1º dia de reunião', desc: 'Diretoria analisa o cenário' });
      lista.push({ data: decisao, tipo: 'Copom', titulo: 'Decisão do Copom', desc: c.nota ? maiuscula(c.nota) : 'Selic anunciada à noite', decisao: true });
      lista.push({ data: somaDias(decisao, 6), tipo: 'Ata', titulo: 'Ata do Copom', desc: 'Publicada às 8h' });
    });
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0);
    for (let d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); d <= fim; d = somaDias(d, 1)) {
      if (d.getDay() !== 1) continue;
      if (feriados[chave(d)]) lista.push({ data: somaDias(d, 1), tipo: 'Focus', titulo: 'Boletim Focus', desc: 'Sai na terça por causa do feriado' });
      else lista.push({ data: d, tipo: 'Focus', titulo: 'Boletim Focus', desc: 'Segunda de manhã' });
    }
    const ordem = { Feriado: 0, Focus: 1, Copom: 2, Ata: 3 };
    return lista.sort((a, b) => (a.data - b.data) || (ordem[a.tipo] - ordem[b.tipo]));
  }

  // ---------- nome do visitante (fica só no navegador dele)
  const CHAVE_NOME = 'pm-nome';
  function lerNome() {
    try { return localStorage.getItem(CHAVE_NOME); } catch (e) { return null; }   // null = nunca respondeu
  }
  function salvarNome(nome) {
    try { localStorage.setItem(CHAVE_NOME, nome); } catch (e) { /* navegação privada: vale só nesta visita */ }
  }
  function iniciais(nome) {
    const partes = nome.split(' ').filter(Boolean);
    const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0][0];
    return letras.toUpperCase();
  }

  class Painel {
    constructor(dados, manual, props) {
      this.D = dados;
      this.M = manual;
      this.props = props;
      const hoje = new Date();
      this.state = {
        view: 'overview', p: 1,
        hoverBar: Math.min(9, dados.juro_real.por_ano.length - 1),
        hoverIbov: Math.min(9, dados.ibovespa.por_ano.length - 1),
        range: '3a',
        simSelic: dados.selic.valor, simIpca: dados.ipca12m.valor,
        notifOpen: false,
        day: hoje.getDate(),
        checks: [false, false, false, false, false],
      };
      const salvo = lerNome();
      Object.assign(this.state, { name: salvo || '', nameDraft: salvo || '', askName: salvo === null });
      this.eventos = montarEventos(manual, hoje);
    }

    setState(parcial) {
      Object.assign(this.state, typeof parcial === 'function' ? parcial(this.state) : parcial);
      if (this.atualizar) this.atualizar();
    }

    animateIn() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this.props.movimento === false) { this.setState({ p: 1 }); return; }
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / 1400);
        this.setState({ p: t });
        if (t < 1) this._raf = requestAnimationFrame(passo);
      };
      this.setState({ p: 0 });
      this._raf = requestAnimationFrame(passo);
    }

    focarNome() {
      setTimeout(() => { const campo = document.getElementById('pm-nome'); if (campo) campo.focus(); }, 120);
    }

    saveName(ev) {
      if (ev) ev.preventDefault();
      const nome = this.state.nameDraft.trim().replace(/\s+/g, ' ').slice(0, 30);
      salvarNome(nome);
      this.setState({ name: nome, nameDraft: nome, askName: false, view: 'overview' });
      try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
      this.animateIn();
    }

    skipName() {
      salvarNome('');
      this.setState({ name: '', nameDraft: '', askName: false, view: 'overview' });
      this.animateIn();
    }

    changeName() {
      this.setState({ askName: true, nameDraft: this.state.name, notifOpen: false });
      try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
      this.focarNome();
    }

    go(view) {
      this.setState({ view: view, notifOpen: false });
      if (view === 'overview') this.animateIn();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* navegador antigo */ }
    }

    renderVals() {
      const D = this.D, M = this.M, s = this.state;
      const neutro = Number(this.props.neutro ?? 5);
      const e = 1 - Math.pow(1 - s.p, 3);
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      // ---------- dados principais (dados.json)
      const selic = D.selic.valor, ipca = D.ipca12m.valor;
      const selicDesde = dia(D.selic.desde || D.selic.data), selicAnterior = D.selic.anterior ?? null;
      const decisaoMudanca = somaDias(selicDesde, -1);       // a nova meta vale a partir do dia seguinte à decisão
      const tipoMudanca = selicAnterior == null ? null : (selic < selicAnterior ? 'corte' : 'alta');
      const ipcaMes = D.ipca12m.mes;
      const ipcaMesNome = MESES_LONGOS[Number(ipcaMes.slice(5)) - 1];
      const hist = D.ipca12m.historico;
      const F = D.focus, anos = F.anos;
      const foco = (nome, k) => F.tabela.find((r) => r.indicador === nome).valores[k];
      const antes = (x) => (x.variacao == null ? null : Math.round((x.mediana - x.variacao) * 100) / 100);
      const I = [0, 1, 2].map((k) => foco('IPCA', k)), S = [0, 1, 2].map((k) => foco('Selic', k));
      const B = D.ibovespa, ibovData = dia(B.data);
      const atualizado = new Date(D.atualizado_em);
      const atualizadoTxt = ddmm(atualizado) + ' às ' + atualizado.getHours() + 'h' + String(atualizado.getMinutes()).padStart(2, '0');

      // ---------- navegação
      const navDefs = [
        { id: 'overview', label: 'Visão geral', icon: icones.home },
        { id: 'focus', label: 'Expectativas', icon: icones.target },
        { id: 'agenda', label: 'Agenda', icon: icones.calendar },
        { id: 'metodo', label: 'Metodologia', icon: icones.book },
      ];
      const nav = navDefs.map((n) => {
        const on = s.view === n.id;
        return {
          label: n.label, icon: n.icon, go: () => this.go(n.id), current: on ? 'page' : 'false',
          pillClass: on ? 'pm-pill pm-pill-on' : 'pm-pill', dockClass: on ? 'pm-dockbtn pm-dockbtn-on' : 'pm-dockbtn',
        };
      });

      // ---------- Copom
      const decisoes = M.copom.map((c) => ({ ...c, data: dia(c.decisao), ini: dia(c.inicio) }));
      const proximo = decisoes.find((c) => c.data >= hoje);
      const ultimo = decisoes.filter((c) => c.data < hoje).pop();
      let copomDays = '—', copomWord = '', copomWhen = 'Calendário do próximo ano ainda não divulgado', copomShort = 'a definir';
      if (proximo) {
        const dias = Math.round((proximo.data - hoje) / 864e5);
        const mesmoMes = proximo.ini.getMonth() === proximo.data.getMonth();
        const curto = proximo.ini.getDate() + '–' + proximo.data.getDate() + ' ' + MESES[proximo.data.getMonth()];
        copomDays = dias === 0 ? 'Hoje' : String(dias);
        copomWord = dias === 0 ? '' : (dias === 1 ? 'dia' : 'dias');
        copomWhen = 'Reunião de ' + proximo.ini.getDate() + (mesmoMes ? '' : ' de ' + MESES_LONGOS[proximo.ini.getMonth()]) + ' e ' + proximo.data.getDate() + ' de ' + MESES_LONGOS[proximo.data.getMonth()]
          + ' · ' + (proximo.nota || 'decisão na ' + SEMANA[proximo.data.getDay()] + ' à noite');
        copomShort = dias === 0 ? curto + ' · hoje' : curto + ' · em ' + dias + (dias === 1 ? ' dia' : ' dias');
      }

      // ---------- KPIs
      const ip12 = hist.slice(-12);
      const selicMes = {};
      (D.selic.fim_de_mes || []).forEach((x) => { selicMes[x.mes] = x.valor; });
      const sel12 = ip12.map((x) => selicMes[x.mes] ?? selic);
      const real12 = sel12.map((v, i) => fisher(v, ip12[i].valor));
      const spark = (arr) => {
        const mn = Math.min(...arr), mx = Math.max(...arr);
        const pts = arr.map((v, i) => [i / (arr.length - 1) * 200, 35 - (v - mn) / ((mx - mn) || 1) * 28]);
        const linha = caminho(pts);
        return { line: linha, area: linha + ' L200 40 L0 40 Z' };
      };
      const realNow = fisher(selic, ipca);
      const realExp = fisher(S[1].mediana, I[1].mediana);
      const realExpAntes = antes(S[1]) != null && antes(I[1]) != null ? fisher(antes(S[1]), antes(I[1])) : null;
      const selicNota = !tipoMudanca ? 'Sem mudança no período'
        : (ultimo && ultimo.data > decisaoMudanca ? 'Mantida em ' + dm(ultimo.data) + ' · último ' + tipoMudanca + ' em ' + dm(decisaoMudanca)
          : (tipoMudanca === 'corte' ? 'Cortada' : 'Elevada') + ' em ' + dm(decisaoMudanca) + ' (era ' + fmt(selicAnterior) + '%)');
      const faixaMeta = ipca > 4.5 ? 'acima do teto da meta (4,5%)' : (ipca < 1.5 ? 'abaixo do piso da meta (1,5%)' : 'dentro da meta (1,5% a 4,5%)');
      const seta = (v) => (v > 0 ? '▲ ' : (v < 0 ? '▼ ' : '= '));
      const ibovUlt = B.ultimos_dias.slice(-6);
      const ibovSemana = (ibovUlt[ibovUlt.length - 1].valor / ibovUlt[0].valor - 1) * 100;
      const kpiDefs = [
        { label: 'Selic (meta)', v: selic, note: selicNota, arr: sel12, color: OSSO, icon: icones.percent },
        { label: 'IPCA em 12 meses', v: ipca, note: maiuscula(ipcaMesNome) + ' · ' + faixaMeta, arr: ip12.map((x) => x.valor), color: AMBAR, icon: icones.trend },
        { label: 'Juro real hoje', v: realNow, note: fmt(Math.abs(realNow - neutro), 1) + ' p.p. ' + (realNow >= neutro ? 'acima' : 'abaixo') + ' do juro neutro de referência', arr: real12, color: AZUL, icon: icones.gauge },
        { label: 'Juro real esperado ' + anos[1], v: realExp,
          note: 'Focus: Selic ' + fmt(S[1].mediana) + '% e IPCA ' + fmt(I[1].mediana) + '% em ' + anos[1] + (realExpAntes != null ? ' (era ' + fmt(realExpAntes, 1) + '%)' : ''),
          foot: 'Hoje ' + fmt(realNow) + '% → ' + anos[1] + ' ' + fmt(realExp) + '%', icon: icones.target },
        { label: 'Focus · IPCA ' + anos[0], v: I[0].mediana,
          note: I[0].variacao == null ? 'Mediana do mercado' : (I[0].variacao === 0 ? '= estável na semana' : seta(I[0].variacao) + fmt(Math.abs(I[0].variacao)) + ' p.p. na semana (era ' + fmt(antes(I[0])) + '%)'),
          foot: 'Meta 3% · teto 4,5%', icon: icones.eye },
        { label: 'Ibovespa (' + ddmm(ibovData) + ')', v: B.fechamento, pts: true,
          note: comSinal(ibovSemana) + '% em 5 pregões · ' + (B.var_ano == null ? '' : comSinal(B.var_ano) + '% em ' + ibovData.getFullYear()),
          arr: B.ultimos_dias.slice(-22).map((x) => x.valor), color: AMBAR, icon: icones.bars },
      ];
      const kpis = kpiDefs.map((k, i) => {
        const sp = k.arr ? spark(k.arr) : { line: '', area: '' };
        return {
          label: k.label, note: k.note, icon: k.icon, color: k.color || OSSO,
          display: k.pts ? fmtPts(k.v * e) : fmt(k.v * e) + '%',
          hasSpark: !!k.arr, noSpark: !k.arr, foot: k.foot || '', line: sp.line, area: sp.area,
          cardStyle: 'border-radius: 24px; padding: 20px; display: flex; flex-direction: column; gap: 10px; min-width: 0; animation-delay: ' + (120 + i * 80) + 'ms',
        };
      });

      // ---------- barras: juro real no fim de cada ano
      const anosReal = D.juro_real.por_ano.slice(-10);
      const reais = anosReal.map((r) => fisher(r.selic, r.ipca));
      const bTopo = Math.max(12, Math.ceil(Math.max(...reais)) + 1), bBase = Math.min(-4, Math.floor(Math.min(...reais)) - 1);
      const yB = (v) => 24 + (bTopo - v) / (bTopo - bBase) * 216;
      const zeroY = yB(0);
      const slot = (736 - 56) / anosReal.length, bw = 36;
      const hoverBar = Math.min(s.hoverBar, anosReal.length - 1);
      const bars = anosReal.map((r, i) => {
        const v = reais[i], isNow = i === anosReal.length - 1, hov = hoverBar === i;
        const x = 56 + slot * i + (slot - bw) / 2;
        return {
          x: x.toFixed(1), y: (v >= 0 ? yB(v) : zeroY).toFixed(1), w: bw, h: Math.max(2, Math.abs(yB(v) - zeroY)).toFixed(1), cx: (x + bw / 2).toFixed(1),
          isNow: isNow, cls: v >= 0 ? 'pm-bar' : 'pm-bar pm-bar-neg',
          fill: isNow ? AZUL : (hov ? 'rgba(237,237,237,.58)' : 'rgba(237,237,237,.26)'),
          style: 'cursor: pointer; animation-delay: ' + (380 + i * 70) + 'ms',
          labelStyle: 'font-size: 12px; text-anchor: middle; font-variant-numeric: tabular-nums; animation-delay: ' + (900 + i * 70) + 'ms',
          ly: (v >= 0 ? yB(v) - 8 : yB(v) + 16).toFixed(1), valueTxt: fmt(v, 1) + '%',
          year: isNow ? r.ano + '*' : String(r.ano), enter: () => this.setState({ hoverBar: i }),
        };
      });
      const hb = anosReal[hoverBar];
      const barDetail = (hoverBar === anosReal.length - 1 ? 'Hoje' : String(hb.ano)) + ': Selic ' + fmt(hb.selic) + '% · IPCA ' + fmt(hb.ipca) + '% · juro real ' + fmt(fisher(hb.selic, hb.ipca)) + '%';
      const barTicks = [];
      for (let t = Math.ceil(bBase / 4) * 4; t <= bTopo; t += 4) if (t !== 0) barTicks.push({ y: yB(t).toFixed(1), ty: (yB(t) + 4).toFixed(1), label: fmt(t, 0) + '%' });

      // ---------- Ibovespa: retorno em cada ano
      const ibovAnos = B.por_ano.slice(-10);
      const iTopo = Math.max(36, Math.ceil(Math.max(...ibovAnos.map((r) => r.retorno))) + 4);
      const iBase = Math.min(-16, Math.floor(Math.min(...ibovAnos.map((r) => r.retorno))) - 4);
      const yI = (v) => 24 + (iTopo - v) / (iTopo - iBase) * 216;
      const ibovZeroY = yI(0);
      const islot = (736 - 56) / ibovAnos.length, ibw = 36;
      const hoverIbov = Math.min(s.hoverIbov, ibovAnos.length - 1);
      const ibovBars = ibovAnos.map((r, i) => {
        const v = r.retorno, isNow = i === ibovAnos.length - 1, hov = hoverIbov === i;
        const x = 56 + islot * i + (islot - ibw) / 2;
        return {
          x: x.toFixed(1), y: (v >= 0 ? yI(v) : ibovZeroY).toFixed(1), w: ibw, h: Math.max(2, Math.abs(yI(v) - ibovZeroY)).toFixed(1),
          cx: (x + ibw / 2).toFixed(1), isNow: isNow, cls: v >= 0 ? 'pm-bar' : 'pm-bar pm-bar-neg',
          fill: isNow ? AMBAR : (v < 0 ? (hov ? 'rgba(143,176,255,.75)' : 'rgba(143,176,255,.45)') : (hov ? 'rgba(237,237,237,.58)' : 'rgba(237,237,237,.26)')),
          style: 'cursor: pointer; animation-delay: ' + (380 + i * 70) + 'ms',
          labelStyle: 'font-size: 12px; text-anchor: middle; font-variant-numeric: tabular-nums; animation-delay: ' + (900 + i * 70) + 'ms',
          ly: (v >= 0 ? yI(v) - 8 : yI(v) + 16).toFixed(1), valueTxt: comSinal(v) + '%',
          year: isNow ? r.ano + '*' : String(r.ano), enter: () => this.setState({ hoverIbov: i }),
        };
      });
      const hi = ibovAnos[hoverIbov];
      const ibovDetail = (hoverIbov === ibovAnos.length - 1 ? hi.ano + ' até ' + ddmm(ibovData) : String(hi.ano)) + ': ' + fmtPts(hi.fechamento) + ' pts · ' + comSinal(hi.retorno, 2) + '%';
      const ibovTicks = [];
      for (let t = Math.ceil(iBase / 10) * 10; t <= iTopo; t += 10) if (t !== 0) ibovTicks.push({ y: yI(t).toFixed(1), ty: (yI(t) + 4).toFixed(1), label: fmt(t, 0) + '%' });
      const melhor = ibovAnos.slice(0, -1).reduce((a, b) => (b.retorno > a.retorno ? b : a));
      const ibovCaption = 'Melhor ano do período: ' + melhor.ano + ' (' + comSinal(melhor.retorno, 2) + '%). Em ' + ibovData.getFullYear() + ', o Ibovespa acumula ' + comSinal(B.var_ano) + '% até ' + ddmm(ibovData) + '.';

      // ---------- Ibovespa: últimos pregões
      const wMin = Math.min(...ibovUlt.map((x) => x.valor)) * 0.985, wMax = Math.max(...ibovUlt.map((x) => x.valor)) * 1.015;
      const wX = (i) => 28 + i * (292 - 28) / (ibovUlt.length - 1), wY = (v) => 16 + (wMax - v) / (wMax - wMin) * 108;
      const ibovWeekLine = caminho(ibovUlt.map((w, i) => [wX(i), wY(w.valor)]));
      const ibovWeekDots = ibovUlt.map((w, i) => ({ x: wX(i).toFixed(1), y: wY(w.valor).toFixed(1), label: diaMes(dia(w.data)) }));
      const ibovWeekRows = ibovUlt.map((w, i) => ({
        day: diaMes(dia(w.data)), pts: fmtPts(w.valor),
        note: i === 0 ? 'Ponto de partida' : comSinal((w.valor / ibovUlt[i - 1].valor - 1) * 100, 2) + '% no dia',
        rowStyle: 'display: flex; justify-content: space-between; gap: 10px; padding: 8px 4px; border-top: ' + (i ? '1px solid rgba(229,229,229,.10)' : '0'),
      }));
      const maxima = B.maxima_12m;
      const distMax = (B.fechamento / maxima.valor - 1) * 100;
      const ibovWeekCaption = 'Máxima dos últimos 12 meses: ' + fmtPts(maxima.valor) + ' pontos em ' + ddmm(dia(maxima.data)) + '. '
        + (distMax < -0.05 ? 'O fechamento de ' + ddmm(ibovData) + ' está ' + fmt(Math.abs(distMax), 1) + '% abaixo dela.' : 'O índice está na máxima.');

      // ---------- índice do medo (manual.js)
      const medo = M.medo.leituras;
      const medoNow = medo[medo.length - 1][1], medoRec = M.medo.recorde.valor;
      const gMax = 50, gcx = 140, gcy = 140, gr = 110;
      const ang = (v) => Math.PI * (1 - Math.min(v, gMax) / gMax);
      const gPt = (v, r) => [gcx + r * Math.cos(ang(v)), gcy - r * Math.sin(ang(v))];
      const arco = (a, b) => { const p1 = gPt(a, gr), p2 = gPt(b, gr); return 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A' + gr + ' ' + gr + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); };
      const agulha = gPt(medoNow * e, gr - 24), recPt = gPt(medoRec, gr);
      const zona = medoNow < 20 ? 'Calmo' : (medoNow < 30 ? 'Atenção' : 'Turbulência');
      const zonaCor = medoNow < 20 ? OSSO : (medoNow < 30 ? 'rgba(240,179,122,.8)' : AMBAR);
      const mX = (i) => 24 + i * (256 - 24) / (medo.length - 1), mY = (v) => 8 + (gMax - v) / gMax * 68;

      // ---------- inflação contra a meta
      const n0 = s.range === '12m' ? 12 : (s.range === '3a' ? 36 : hist.length);
      const serie = hist.slice(hist.length - n0);
      const vals = serie.map((x) => x.valor);
      const anoDe = (i) => Number(serie[i].mes.slice(0, 4)), mesDe = (i) => Number(serie[i].mes.slice(5)) - 1;
      const metas = serie.map((x, i) => meta(anoDe(i)));
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
        if (s.range === '12m') { if (i % 3 === 0 || i === vals.length - 1) xlabels.push({ x: X(i).toFixed(1), label: MESES[mesDe(i)] + '/' + String(anoDe(i)).slice(2) }); }
        else if (mesDe(i) === 0) xlabels.push({ x: X(i).toFixed(1), label: String(anoDe(i)) });
      });
      const ultimoV = vals[vals.length - 1];
      const infl = {
        band: caminho(cima.concat(baixo.slice().reverse())) + ' Z', center: caminho(centro), line: caminho(vals.map((v, i) => [X(i), Y(v)])),
        ticks: ticks, xlabels: xlabels,
        lastX: X(vals.length - 1).toFixed(1), lastY: Y(ultimoV).toFixed(1), labelX: (X(vals.length - 1) + 12).toFixed(1), labelY: (Y(ultimoV) + 4).toFixed(1),
        lastTxt: fmt(ultimoV) + '%',
      };
      const acimaTeto = ip12.filter((x) => x.valor > 4.5).length;
      const inflCaption = acimaTeto + ' dos últimos 12 meses ficaram acima do teto de 4,5%. A meta ficou em 3% a partir de 2024; antes, era maior.';
      const segs = [['12m', '12 meses'], ['3a', '3 anos'], ['all', 'Desde ' + hist[0].mes.slice(0, 4)]].map((g) => ({
        label: g[1], on: s.range === g[0] ? 'true' : 'false', cls: s.range === g[0] ? 'pm-seg pm-seg-on' : 'pm-seg', pick: () => this.setState({ range: g[0] }),
      }));

      // ---------- termômetro de ancoragem
      const ancoras = [['IPCA hoje (12 meses)', ipca], ...anos.map((a, k) => ['Focus · ' + a, I[k].mediana])];
      const anchors = ancoras.map((a, i) => {
        const pct = Math.max(0, Math.min(100, a[1] / 6 * 100));
        return {
          label: a[0], valueTxt: fmt(a[1]) + '%',
          dotStyle: 'position: absolute; top: 50%; left: ' + pct.toFixed(2) + '%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: ' + (a[1] > 4.5 ? AMBAR : OSSO) + '; border: 3px solid rgba(10,10,10,.55); box-sizing: border-box; animation-delay: ' + (900 + i * 120) + 'ms',
        };
      });
      const anosAcima = anos.filter((a, k) => I[k].mediana > 4.5);
      const ancCaption = 'Em ' + anos[2] + ', a inflação esperada é ' + fmt(I[2].mediana) + '%' + (I[2].mediana > 3 ? ', ainda acima da meta de 3%.' : ', na meta de 3%.')
        + ' Em laranja, o que passa do teto de 4,5%' + (anosAcima.length ? ': ' + anosAcima.join(' e ') + '.' : '; nenhuma expectativa passa do teto agora.');

      // ---------- simulador
      const simReal = fisher(s.simSelic, s.simIpca), simples = s.simSelic - s.simIpca;
      let postura = 'Neutra', posturaCor = OSSO, desc = 'Juro real perto do neutro: nem acelera nem freia a economia.';
      if (simReal < neutro - 1) { postura = 'Estimulativa'; posturaCor = AZUL; desc = 'Juro real abaixo do neutro: estimula crédito, consumo e investimento.'; }
      else if (simReal > neutro + 1) { postura = 'Contracionista'; posturaCor = AMBAR; desc = 'Juro real acima do neutro: freia a economia para conter a inflação.'; }
      const pos = (v) => Math.max(0, Math.min(100, (v + 5) / 20 * 100));

      // ---------- próximos eventos e alertas
      const cores = { Focus: AZUL, Copom: AMBAR, Ata: OSSO, Feriado: 'transparent' };
      const faixa = (t) => 'width: 3px; align-self: stretch; min-height: 28px; border-radius: 9999px; flex: 0 0 auto; background: ' + (t === 'Feriado' ? 'rgba(237,237,237,.35)' : cores[t]);
      const proximos = this.eventos.filter((x) => x.data >= hoje && x.tipo !== 'Feriado' && x.titulo !== 'Copom: 1º dia de reunião').slice(0, 5);
      const events = proximos.map((x, i) => ({
        day: String(x.data.getDate()), month: MESES[x.data.getMonth()], title: x.titulo, desc: x.desc, accent: faixa(x.tipo),
        rowStyle: 'border-radius: 16px; padding: 10px 12px; display: flex; gap: 12px; align-items: center; animation-delay: ' + (700 + i * 70) + 'ms',
      }));
      const alertas = [];
      if (ultimo && tipoMudanca) {
        alertas.push([ultimo.data > decisaoMudanca
          ? 'Copom manteve a Selic em ' + fmt(selic) + '% em ' + dm(ultimo.data) + '.'
          : 'Copom ' + (tipoMudanca === 'corte' ? 'cortou' : 'subiu') + ' a Selic de ' + fmt(selicAnterior) + '% para ' + fmt(selic) + '% em ' + dm(decisaoMudanca) + '.', OSSO]);
      }
      alertas.push(['IPCA em 12 meses (' + fmt(ipca) + '%) está ' + faixaMeta.replace(' (4,5%)', ' de 4,5%').replace(' (1,5%)', ' de 1,5%') + '.', ipca > 4.5 ? AMBAR : OSSO]);
      alertas.push(['Copom decide a Selic ' + (proximo ? (copomDays === 'Hoje' ? 'hoje.' : 'em ' + copomDays + ' ' + copomWord + '.') : 'em data a definir.'), OSSO]);
      if (S[1].variacao != null) {
        alertas.push([S[1].variacao === 0 ? 'Focus: Selic esperada para ' + anos[1] + ' ficou estável em ' + fmt(S[1].mediana) + '%.'
          : 'Focus: Selic esperada para ' + anos[1] + (S[1].variacao > 0 ? ' subiu' : ' caiu') + ' de ' + fmt(antes(S[1])) + '% para ' + fmt(S[1].mediana) + '%.', AZUL]);
      }
      alertas.push(['Ibovespa ' + (ibovSemana >= 0 ? 'subiu ' : 'caiu ') + fmt(Math.abs(ibovSemana), 1) + '% nos últimos cinco pregões.', AMBAR]);
      const alerts = alertas.map((a) => ({ text: a[0], dotStyle: 'width: 8px; height: 8px; margin-top: 7px; border-radius: 9999px; flex: 0 0 auto; background: ' + a[1] }));

      // ---------- Copom: o que o mercado precifica
      const corte = (v) => (v > 0 ? fmt(v) + ' p.p. de corte' : fmt(-v) + ' p.p. de alta');
      const dif = selic - S[0].mediana, difAntes = antes(S[0]) == null ? null : selic - antes(S[0]);
      let copomPricing = Math.abs(dif) < 0.001 ? 'A mediana indica Selic parada até dezembro.' : 'A mediana implica ' + corte(dif) + ' até dezembro.';
      if (difAntes != null && Math.abs(difAntes - dif) > 0.001) copomPricing += Math.abs(difAntes) < 0.001 ? ' Na semana anterior, indicava Selic parada.' : ' Na semana anterior eram ' + corte(difAntes) + '.';

      // ---------- Focus
      const nomes = { IPCA: ['IPCA', 'inflação no ano'], Selic: ['Selic', 'no fim do ano'], 'PIB Total': ['PIB', 'crescimento no ano'], 'Câmbio': ['Câmbio', 'R$ por dólar no fim do ano'] };
      const celula = (x, dinheiro) => {
        const valor = dinheiro ? 'R$ ' + fmt(x.mediana) : fmt(x.mediana) + '%';
        if (x.variacao == null) return { value: valor, delta: '—' };
        const d = x.variacao;
        return { value: valor, delta: d === 0 ? '= estável' : seta(d) + fmt(Math.abs(d)) + (dinheiro ? '' : ' p.p.') };
      };
      const focusRows = F.tabela.map((r) => ({ name: nomes[r.indicador][0], unit: nomes[r.indicador][1], cells: r.valores.map((x) => celula(x, r.indicador === 'Câmbio')) }));
      const tS = [selic, ...S.map((x) => x.mediana)], tI = [ipca, ...I.map((x) => x.mediana)];
      const tL = ['Hoje', ...anos.map((a) => 'Fim de ' + a)];
      const tTopo = Math.max(16, Math.ceil(Math.max(...tS) / 4) * 4);
      const tX = (i) => 110 + i * (660 - 110) / 3, tY = (v) => 16 + (tTopo - v) / tTopo * 250;
      const selPts = tS.map((v, i) => [tX(i), tY(v)]), ipPts = tI.map((v, i) => [tX(i), tY(v)]);
      const tTicks = [];
      for (let t = 0; t <= tTopo; t += 4) tTicks.push({ y: tY(t).toFixed(1), ty: (tY(t) + 4).toFixed(1), label: t + '%' });
      const traj = {
        selic: caminho(selPts), ipca: caminho(ipPts), area: caminho(selPts.concat(ipPts.slice().reverse())) + ' Z', ticks: tTicks,
        pts: tS.map((v, i) => ({
          x: tX(i).toFixed(1), ys: tY(v).toFixed(1), yi: tY(tI[i]).toFixed(1), lys: (tY(v) - 12).toFixed(1), lyi: (tY(tI[i]) + 22).toFixed(1),
          lyr: ((tY(v) + tY(tI[i])) / 2 + 4).toFixed(1), selicTxt: fmt(v) + '%', ipcaTxt: fmt(tI[i]) + '%', realTxt: 'real ' + fmt(fisher(v, tI[i]), 1) + '%', label: tL[i],
        })),
      };
      const realFim = fisher(tS[3], tI[3]);
      const trajCaption = 'O juro real esperado vai de ' + fmt(realNow, 1) + '% hoje para ' + fmt(realFim, 1) + '% no fim de ' + anos[2]
        + (realFim > neutro ? ', ainda acima' : ', abaixo') + ' do juro neutro de referência. "Hoje" usa a Selic atual e o IPCA de 12 meses até ' + ipcaMesNome + '.';
      const leituras = {
        IPCA: ['Inflação esperada maior.', 'Inflação esperada menor.'], Selic: ['O mercado espera juros mais altos.', 'O mercado espera juros mais baixos.'],
        'PIB Total': ['Crescimento esperado maior.', 'Crescimento esperado menor.'], 'Câmbio': ['Dólar esperado mais caro.', 'Dólar esperado mais barato.'],
      };
      const mudancas = [];
      F.tabela.forEach((r) => r.valores.forEach((x) => {
        if (!x.variacao) return;
        const dinheiro = r.indicador === 'Câmbio', f = (v) => (dinheiro ? 'R$ ' + fmt(v) : fmt(v) + '%');
        let leitura = leituras[r.indicador][x.variacao > 0 ? 0 : 1];
        if (r.indicador === 'IPCA' && x.mediana > 4.5 && antes(x) <= 4.5) leitura += ' Passou do teto de 4,5%.';
        mudancas.push({ name: nomes[r.indicador][0] + ' ' + x.ano, change: f(antes(x)) + ' → ' + f(x.mediana), read: leitura, peso: Math.abs(x.variacao) });
      }));
      mudancas.sort((a, b) => b.peso - a.peso);
      const moves = mudancas.length ? mudancas.slice(0, 4) : [{ name: 'Nenhuma mudança', change: '', read: 'As medianas ficaram iguais às da semana anterior.' }];
      const qTexts = [
        'A mediana do IPCA de ' + anos[0] + ' e ' + anos[1] + ' subiu, caiu ou ficou igual?',
        'A expectativa para ' + anos[1] + ' está acima ou abaixo da meta de 3%?',
        'O mercado espera cortes ou altas da Selic até o fim de ' + anos[1] + '?',
        'Há quantas semanas seguidas o IPCA de ' + anos[1] + ' vai na mesma direção?',
        'Em uma frase: o mercado ficou mais otimista ou pessimista?',
      ];
      const questions = qTexts.map((t, i) => ({ text: t, checked: !!s.checks[i], toggle: () => { const c = s.checks.slice(); c[i] = !c[i]; this.setState({ checks: c }); } }));
      const coleta = dia(F.coleta_ate), coletaAntes = dia(F.coleta_anterior);

      // ---------- agenda do mês atual
      const ano = hoje.getFullYear(), mes = hoje.getMonth();
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      const doDia = (d) => this.eventos.filter((x) => x.data.getFullYear() === ano && x.data.getMonth() === mes && x.data.getDate() === d);
      const calendar = [];
      for (let i = 0; i < new Date(ano, mes, 1).getDay(); i++) calendar.push({ blank: true, real: false, dots: [] });
      for (let d = 1; d <= diasNoMes; d++) {
        const lista = doDia(d), on = s.day === d;
        calendar.push({
          blank: false, real: true, n: String(d), on: on ? 'true' : 'false', cls: on ? 'pm-day pm-day-on' : 'pm-day',
          aria: d + ' de ' + MESES_LONGOS[mes] + (lista.length ? ', ' + lista.map((x) => x.titulo).join(', ') : ''),
          pick: () => this.setState({ day: d }),
          dots: lista.map((x) => ({ style: 'width: 6px; height: 6px; border-radius: 9999px; ' + (x.tipo === 'Feriado' ? 'border: 1px solid #c2c2c2; box-sizing: border-box' : 'background: ' + cores[x.tipo]) })),
        });
      }
      while (calendar.length % 7 !== 0) calendar.push({ blank: true, real: false, dots: [] });
      const dayEvents = doDia(s.day).map((x) => ({ title: x.titulo, desc: x.desc, accent: faixa(x.tipo) }));
      const prox = new Date(ano, mes + 1, 1);
      const nextMonth = this.eventos.filter((x) => x.data.getFullYear() === prox.getFullYear() && x.data.getMonth() === prox.getMonth() && x.titulo !== 'Copom: 1º dia de reunião')
        .map((x) => ({ day: x.data.getDate() + ' ' + MESES[x.data.getMonth()], title: x.titulo, accent: faixa(x.tipo) }));

      const diffs = [
        'Juro real pela fórmula exata de Fisher',
        'Juro real de hoje e o esperado pelo mercado',
        'Distância do juro neutro de referência',
        'Inflação contra a meta e a banda de cada ano',
        'Contagem para o Copom e o que o mercado precifica',
        'Dados atualizados sozinhos todo dia útil',
        'Simulador e leitura semanal do próprio autor',
      ].map((t, i) => ({ text: t, n: String(i + 1).padStart(2, '0') }));

      const h = agora.getHours();
      const saudacao = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
      const leitura = M.leitura || {};

      return {
        rootClass: this.props.movimento !== false ? 'pm-root' : 'pm-root pm-still',
        nav: nav,
        isOverview: s.view === 'overview', isFocus: s.view === 'focus', isAgenda: s.view === 'agenda', isMetodo: s.view === 'metodo',
        notifOpen: s.notifOpen, toggleNotif: () => this.setState({ notifOpen: !s.notifOpen }),
        alerts: alerts, alertCount: String(alerts.length),
        askName: s.askName, showPanel: !s.askName,
        nameDraft: s.nameDraft, onNameInput: (ev) => this.setState({ nameDraft: ev.target.value }),
        namePreview: saudacao + (s.nameDraft.trim() ? ', ' + s.nameDraft.trim().replace(/\s+/g, ' ') : ''),
        saveName: (ev) => this.saveName(ev), skipName: () => this.skipName(), changeName: () => this.changeName(),
        hasName: !!s.name, noName: !s.name, initials: s.name ? iniciais(s.name) : '',
        greeting: saudacao, greetSuffix: s.name ? ', ' + s.name : '',
        subtitle: 'Juros, inflação e expectativas no Brasil · IPCA até ' + mesLongo(ipcaMes) + ' · Focus com coleta até ' + ddmm(coleta) + ' · Ibovespa até ' + ddmm(ibovData) + ' · atualizado em ' + atualizadoTxt,
        copomShort: copomShort, copomDays: copomDays, copomWord: copomWord, copomWhen: copomWhen,
        selicTxt: fmt(selic) + '%', copomFocusTxt: fmt(S[0].mediana) + '%', copomFocusLabel: 'Focus para dez/' + anos[0], copomPricing: copomPricing,
        kpis: kpis,
        bars: bars, barTicks: barTicks, zeroY: zeroY.toFixed(1), neutroY: yB(neutro).toFixed(1), neutroTxt: '~' + fmt(neutro, neutro % 1 ? 2 : 0) + '%',
        barDetail: barDetail, barsNowTxt: anosReal[anosReal.length - 1].ano + ' = Selic atual e IPCA até ' + ipcaMesNome,
        barsFrom: anosReal[0].ano, barsTo: anosReal[anosReal.length - 1].ano,
        ibovBars: ibovBars, ibovTicks: ibovTicks, ibovZeroY: ibovZeroY.toFixed(1), ibovDetail: ibovDetail, ibovCaption: ibovCaption,
        ibovSubNow: ibovData.getFullYear() + ' até ' + ddmm(ibovData), ibovNowLegend: ibovData.getFullYear() + ' até agora',
        ibovFrom: ibovAnos[0].ano, ibovTo: ibovAnos[ibovAnos.length - 1].ano,
        ibovWeekLine: ibovWeekLine, ibovWeekDots: ibovWeekDots, ibovWeekRows: ibovWeekRows, ibovWeekCaption: ibovWeekCaption,
        ibovFallTxt: comSinal(ibovSemana) + '%',
        ibovWeekAria: 'Linha do Ibovespa nos últimos seis pregões, de ' + ddmm(dia(ibovUlt[0].data)) + ' a ' + ddmm(ibovData),
        medoArcCalm: arco(0, 20), medoArcWarn: arco(20, 30), medoArcHigh: arco(30, gMax),
        medoTicks: [0, 20, 30, 50].map((t) => { const p = gPt(t, gr + 20); return { x: p[0].toFixed(1), y: (p[1] + 4).toFixed(1), label: String(t) }; }),
        medoNeedleX: agulha[0].toFixed(1), medoNeedleY: agulha[1].toFixed(1),
        medoRecordShow: true, medoRecX: recPt[0].toFixed(1), medoRecY: recPt[1].toFixed(1),
        medoValueTxt: fmt(medoNow * e), medoZone: zona,
        medoPillStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; white-space: nowrap; color: #161616; background: ' + zonaCor,
        medoAria: 'Índice do medo em ' + fmt(medoNow) + ' pontos, faixa de ' + zona.toLowerCase() + '; recorde de ' + fmt(medoRec) + ' em ' + M.medo.recorde.data,
        medoPts: medo.map((m, i) => ({ x: mX(i).toFixed(1), y: mY(m[1]).toFixed(1), label: m[0], fill: m[1] >= 30 ? AMBAR : OSSO })),
        medoPath: 'M' + medo.map((m, i) => mX(i).toFixed(1) + ' ' + mY(m[1]).toFixed(1)).join(' L'),
        medoLine30: mY(30).toFixed(1), medoLine30Txt: (mY(30) - 5).toFixed(1),
        medoRecData: M.medo.recorde.data, medoRecTxt: fmt(medoRec), medoComment: M.medo.comentario,
        medoFoot: 'Atualização manual · último dado: ' + M.medo.ultimoDado + '. Escala de 0 a 100; acima de 30, a B3 associa a forte turbulência.',
        medoLineAria: 'Leituras recentes do índice do medo: ' + medo.map((m) => m[0] + ' ' + fmt(m[1])).join(', '),
        events: events,
        infl: infl, segs: segs, inflCaption: inflCaption,
        anchors: anchors, ancCaption: ancCaption,
        simSelic: s.simSelic, simIpca: s.simIpca, simSelicTxt: fmt(s.simSelic) + '%', simIpcaTxt: fmt(s.simIpca, 1) + '%',
        onSelic: (ev) => this.setState({ simSelic: parseFloat(ev.target.value) }),
        onIpca: (ev) => this.setState({ simIpca: parseFloat(ev.target.value) }),
        resetSim: () => this.setState({ simSelic: selic, simIpca: ipca }),
        simRealTxt: fmt(simReal) + '%', simStance: postura, simDesc: desc,
        simStanceStyle: 'padding: 4px 10px; border-radius: 9999px; font-size: 13px; color: #161616; background: ' + posturaCor,
        simNeutroStyle: 'position: absolute; top: -4px; bottom: -4px; left: ' + pos(neutro).toFixed(2) + '%; width: 2px; margin-left: -1px; background: rgba(240,179,122,.9)',
        simMarkerStyle: 'position: absolute; top: 50%; left: ' + pos(simReal).toFixed(2) + '%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 9999px; background: ' + posturaCor + '; border: 3px solid rgba(10,10,10,.6); box-sizing: border-box; transition: left .25s ease, background-color .25s',
        simSimpleTxt: fmt(simples) + '%', simErrTxt: fmt(Math.abs(simples - simReal)) + ' p.p.',
        hasLeitura: !!leitura.texto, noLeitura: !leitura.texto, leituraTexto: leitura.texto || '',
        leituraRef: leitura.data ? 'Publicada em ' + leitura.data : 'Publicada toda semana, depois do Focus de segunda',
        focusSub: 'Boletim Focus com coleta até ' + ddmmaaaa(coleta) + ' · mediana das instituições consultadas',
        focusPrevTxt: ddmm(coletaAntes), focusYears: anos, focusLastYear: anos[2],
        focusRows: focusRows, traj: traj, trajCaption: trajCaption, moves: moves, questions: questions,
        checksDone: s.checks.filter(Boolean).length + ' de 5 respondidas',
        agendaSub: maiuscula(MESES_LONGOS[mes]) + ' de ' + ano + ' · clique em um dia para ver os eventos',
        agendaMonth: maiuscula(MESES_LONGOS[mes]), nextMonthName: maiuscula(MESES_LONGOS[prox.getMonth()]),
        calendar: calendar, dayTitle: s.day + ' de ' + MESES_LONGOS[mes] + ' · ' + SEMANA[new Date(ano, mes, s.day).getDay()],
        dayEvents: dayEvents, dayEmpty: dayEvents.length === 0, december: nextMonth,
        metSelic: fmt(selic) + '% desde ' + ddmmaaaa(selicDesde), metIpca: fmt(ipca) + '% em ' + mesLongo(ipcaMes),
        metFocus: 'Coleta até ' + ddmmaaaa(coleta), metIbov: fmtPts(B.fechamento) + ' pontos em ' + ddmmaaaa(ibovData),
        metMedo: M.medo.ultimoDado + ' (manual)', metUpdated: ddmmaaaa(atualizado) + ' às ' + atualizado.getHours() + 'h' + String(atualizado.getMinutes()).padStart(2, '0'),
        fisherExample: 'Hoje: (' + fmt(1 + selic / 100, 4) + ' ÷ ' + fmt(1 + ipca / 100, 4) + ') − 1 = ' + fmt(realNow) + '% ao ano. A subtração simples daria ' + fmt(selic - ipca) + '%.',
        diffs: diffs,
        footer: 'Painel criado por ' + M.autor.nomeCompleto + '. Fontes: Banco Central do Brasil, SGS (séries 432 e 13522) e Boletim Focus (coleta até ' + ddmmaaaa(coleta) + '). Ibovespa: Yahoo Finance via yfinance, fechamentos até '
          + ddmmaaaa(ibovData) + '. Índice do medo: S&P/B3 Ibovespa VIX, ' + M.medo.fonte + '. Ranking mundial: MoneYou e Lev Intelligence (maio/2026). Juro real calculado pela fórmula de Fisher. Dados atualizados automaticamente em dias úteis; última atualização em ' + atualizadoTxt + '.',
      };
    }
  }

  // ---------- inicia o painel quando o dados.json chegar
  fetch('dados.json', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((dados) => {
      const painel = new Painel(dados, window.MANUAL, { neutro: 5, movimento: true });
      Motor.montar(document.getElementById('app'), document.getElementById('modelo'), painel);
      if (painel.state.askName) painel.focarNome();
      else painel.animateIn();
    })
    .catch((erro) => {
      console.error(erro);
      document.getElementById('app').innerHTML = '<p style="padding:24px;color:#ededed;font-family:sans-serif">Não foi possível carregar os dados do painel.</p>';
    });
})();
