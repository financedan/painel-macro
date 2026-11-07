/*
 * painel.js — o núcleo do Painel Macro Brasil.
 * Lê dados.json (robô), manual.json (dados digitados à mão) e leituras.json,
 * guarda o estado da tela e junta o que cada seção (js/secoes/*.js) calcula.
 *
 * Cada seção registra funções em PM.secoes. Se uma delas falhar (um dado faltando,
 * por exemplo), só aquele bloco some da tela: o resto do painel continua funcionando.
 */
(function () {
  const P = window.PM;
  const { AZUL, AMBAR, OSSO } = P.cores;
  P.secoes = P.secoes || {};

  // Meta de inflação de cada ano (CMN). A partir de 2024 é 3%; desde 2025 a meta é contínua.
  const META = { 2017: 4.5, 2018: 4.5, 2019: 4.25, 2020: 4.0, 2021: 3.75, 2022: 3.5, 2023: 3.25 };
  P.meta = (ano) => META[ano] ?? 3.0;

  const VIEWS = [
    { id: 'visao', label: 'Visão geral', icon: P.icones.home },
    { id: 'expectativas', label: 'Expectativas', icon: P.icones.target },
    { id: 'economia', label: 'Economia', icon: P.icones.pulse },
    { id: 'agenda', label: 'Agenda', icon: P.icones.calendar },
    { id: 'metodologia', label: 'Metodologia', icon: P.icones.book },
  ];
  const viewDoEndereco = () => { const h = location.hash.replace('#', ''); return VIEWS.some((v) => v.id === h) ? h : 'visao'; };

  const NOMES_FONTES = {
    selic_e_ipca: 'Selic e IPCA', inflacao_mensal: 'IPCA do mês e núcleos', grupos_ipca: 'IPCA por grupo', focus: 'Boletim Focus',
    ibovespa: 'Ibovespa', comparacao: 'Bolsa x renda fixa', economia: 'Economia', mundo: 'Mundo', tesouro: 'Tesouro Direto',
  };

  // ---------- agenda: Copom, feriados e eventos do manual.json + Focus toda segunda
  function montarEventos(M, hoje) {
    const fechado = {};
    M.feriados.forEach((f) => { fechado[f[0]] = f; });
    const diaUtil = (d) => d.getDay() % 6 !== 0 && !fechado[P.chave(d)];
    const lista = [];
    M.feriados.forEach((f) => lista.push({ data: P.dia(f[0]), tipo: 'Feriado', titulo: f[1], desc: f[2] }));
    M.copom.forEach((c) => {
      const decisao = P.dia(c.decisao);
      lista.push({ data: P.dia(c.inicio), tipo: 'Copom', titulo: 'Copom: 1º dia de reunião', desc: 'Diretoria analisa o cenário', primeiroDia: true });
      lista.push({ data: decisao, tipo: 'Copom', titulo: 'Decisão do Copom', desc: c.nota ? P.maiuscula(c.nota) + ' · Selic anunciada à noite' : 'Selic anunciada à noite', decisao: true });
      lista.push({ data: P.somaDias(decisao, 6), tipo: 'Ata', titulo: 'Ata do Copom', desc: 'Publicada às 8h' });
    });
    (M.eventos || []).forEach((ev) => lista.push({ data: P.dia(ev.data), tipo: ev.tipo || 'Outro', titulo: ev.titulo, desc: ev.desc || '' }));
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 13, 0);
    for (let d = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1); d <= fim; d = P.somaDias(d, 1)) {
      if (d.getDay() !== 1) continue;
      if (diaUtil(d)) { lista.push({ data: d, tipo: 'Focus', titulo: 'Boletim Focus', desc: 'Segunda de manhã' }); continue; }
      let util = P.somaDias(d, 1);
      while (!diaUtil(util)) util = P.somaDias(util, 1);
      lista.push({ data: util, tipo: 'Focus', titulo: 'Boletim Focus', desc: 'Sai na ' + P.SEMANA[util.getDay()] + ' por causa do feriado' });
    }
    const ordem = { Feriado: 0, Focus: 1, Copom: 2, Ata: 3 };
    return lista.sort((a, b) => (a.data - b.data) || ((ordem[a.tipo] ?? 4) - (ordem[b.tipo] ?? 4)));
  }

  // ---------- nome do visitante (fica só no navegador dele)
  const CHAVE_NOME = 'pm-nome';
  function lerNome() { try { return localStorage.getItem(CHAVE_NOME); } catch (e) { return null; } }  // null = nunca respondeu
  function salvarNome(nome) { try { localStorage.setItem(CHAVE_NOME, nome); } catch (e) { /* navegação privada */ } }
  function iniciais(nome) {
    const partes = nome.split(' ').filter(Boolean);
    return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0][0]).toUpperCase();
  }

  class Painel {
    constructor(dados, manual, leituras, props) {
      this.D = dados;
      this.M = manual;
      this.leituras = leituras || [];
      this.props = props;
      const hoje = P.hojeBR();
      const F = dados.focus;
      const salvo = lerNome();
      this.state = {
        view: viewDoEndereco(), p: 1,
        hoverBar: 99, hoverIbov: 99,
        range: P.ler('pm-range', '3a'),
        simSelic: dados.selic.valor, simIpca: dados.ipca12m.valor,
        notifOpen: false,
        agendaMes: 0, day: hoje.getDate(),
        checks: P.ler('pm-checks-' + F.coleta_ate, [false, false, false, false, false]),
        explica: P.ler('pm-explica', false), ajuda: {},
        comp: 'ibov', histInd: 'IPCA', histAno: 1,
        calcValor: 10000, calcMeses: 24,
        name: salvo || '', nameDraft: salvo || '', askName: false, nomePendente: salvo === null,
        vistos: P.ler('pm-alertas-vistos', []),
      };
      this.eventos = montarEventos(manual, hoje);
      this.visita = this.registrarVisita();
      this.animou = false;
    }

    // ---------- "o que mudou desde a sua última visita"
    registrarVisita() {
      const D = this.D, I0 = D.focus.tabela[0].valores[0];
      const agora = {
        atualizado: D.atualizado_em, selic: D.selic.valor, ipca: D.ipca12m.valor, ipcaMes: D.ipca12m.mes,
        coleta: D.focus.coleta_ate, focusIpca: I0.mediana, focusAno: I0.ano, ibov: D.ibovespa.fechamento, ibovData: D.ibovespa.data,
        visto: P.chave(P.hojeBR()),
      };
      const salvo = P.ler('pm-visita', null);
      if (!salvo || !salvo.atual) { P.gravar('pm-visita', { atual: agora, anterior: null }); return null; }
      if (salvo.atual.atualizado !== agora.atualizado) {
        P.gravar('pm-visita', { atual: agora, anterior: salvo.atual });
        return salvo.atual;
      }
      return salvo.anterior;
    }

    setState(parcial) {
      Object.assign(this.state, typeof parcial === 'function' ? parcial(this.state) : parcial);
      if (this.atualizar) this.atualizar();
    }

    // números sobem do zero só na primeira entrada (e nunca com "menos movimento")
    animateIn() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this.props.movimento === false || this.animou) { this.setState({ p: 1 }); return; }
      this.animou = true;
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / 1400);
        this.setState({ p: t });
        if (t < 1) this._raf = requestAnimationFrame(passo);
      };
      this.setState({ p: 0 });
      this._raf = requestAnimationFrame(passo);
    }

    ligarEventosGlobais() {
      window.addEventListener('hashchange', () => {
        this.setState({ view: viewDoEndereco(), notifOpen: false, askName: false });
        if (this.state.view === 'visao') this.animateIn();
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        if (this.state.notifOpen) { this.setState({ notifOpen: false }); const b = document.querySelector('[data-sino]'); if (b) b.focus(); }
        else if (this.state.askName) this.cancelName();
      });
      document.addEventListener('click', (ev) => {
        if (this.state.notifOpen && !ev.target.closest('[data-sino], [data-alertas]')) this.setState({ notifOpen: false });
      });
    }

    focarNome() { setTimeout(() => { const campo = document.getElementById('pm-nome'); if (campo) campo.focus(); }, 120); }

    saveName(ev) {
      if (ev) ev.preventDefault();
      const nome = this.state.nameDraft.trim().replace(/\s+/g, ' ').slice(0, 30);
      salvarNome(nome);
      this.setState({ name: nome, nameDraft: nome, askName: false, nomePendente: false });
      try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
    }
    removeName() { salvarNome(''); this.setState({ name: '', nameDraft: '', askName: false, nomePendente: false }); }
    cancelName() { this.setState({ askName: false, nameDraft: this.state.name }); }
    dismissNameChip() { salvarNome(''); this.setState({ nomePendente: false }); }
    changeName() {
      this.setState({ askName: true, nameDraft: this.state.name, notifOpen: false });
      try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
      this.focarNome();
    }

    go(view) {
      if (location.hash.replace('#', '') === view) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* ok */ } return; }
      location.hash = view;
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* navegador antigo */ }
    }

    toggleNotif() {
      const abrir = !this.state.notifOpen;
      const parcial = { notifOpen: abrir };
      if (abrir && this._idsAlertas) {
        parcial.vistos = this._idsAlertas.slice();
        P.gravar('pm-alertas-vistos', parcial.vistos);
      }
      this.setState(parcial);
    }

    // ---------- valores comuns a todas as seções
    contexto() {
      const D = this.D, M = this.M, s = this.state;
      const hoje = P.hojeBR();
      const F = D.focus, anos = F.anos;
      const foco = (nome, k) => F.tabela.find((r) => r.indicador === nome).valores[k];
      const antes = (x) => (x.variacao == null || x.mediana == null ? null : Math.round((x.mediana - x.variacao) * 100) / 100);
      const decisoes = M.copom.map((c) => ({ ...c, data: P.dia(c.decisao), ini: P.dia(c.inicio) }));
      const ajuda = {};
      Object.keys(P.glossario).forEach((id) => {
        const aberto = !!s.ajuda[id];
        ajuda[id] = {
          on: s.explica || aberto, aberto: aberto, txt: P.glossario[id],
          toggle: () => this.setState({ ajuda: Object.assign({}, s.ajuda, { [id]: !aberto }) }),
          cls: aberto ? 'pm-help pm-help-on' : 'pm-help',
        };
      });
      return {
        D, M, s, pn: this, hoje, agora: new Date(),
        e: 1 - Math.pow(1 - s.p, 3),
        neutro: Number((M.neutro && M.neutro.valor) ?? 5),
        selic: D.selic.valor, ipca: D.ipca12m.valor, ipcaMes: D.ipca12m.mes, ipcaMesNome: P.nomeMes(D.ipca12m.mes),
        F, anos, foco, antes,
        I: [0, 1, 2].map((k) => foco('IPCA', k)), S: [0, 1, 2].map((k) => foco('Selic', k)),
        B: D.ibovespa, ibovData: P.dia(D.ibovespa.data),
        atualizado: P.dataHoraBR(D.atualizado_em),
        coleta: P.dia(F.coleta_ate), coletaAntes: P.dia(F.coleta_anterior),
        realNow: P.fisher(D.selic.valor, D.ipca12m.valor),
        eventos: this.eventos,
        decisoes, proximo: decisoes.find((c) => c.data >= hoje), ultimo: decisoes.filter((c) => c.data < hoje).pop(),
        ajuda, visita: this.visita,
      };
    }

    renderVals() {
      const s = this.state;
      const ctx = this.contexto();
      const nav = VIEWS.map((n) => {
        const on = s.view === n.id;
        return {
          label: n.label, icon: n.icon, go: () => this.go(n.id), current: on ? 'page' : 'false', href: '#' + n.id,
          pillClass: on ? 'pm-pill pm-pill-on' : 'pm-pill', dockClass: on ? 'pm-dockbtn pm-dockbtn-on' : 'pm-dockbtn',
        };
      });
      const h = new Date().getHours();
      const saudacao = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');

      // avisos de dado velho: fonte que falhou na última coleta ou coleta parada há dias
      const fontes = this.D.fontes || {};
      const falhas = Object.keys(fontes).filter((k) => !fontes[k].ok).map((k) => {
        const quando = fontes[k].atualizado_em ? ' (último dado bom em ' + P.dataHoraBR(fontes[k].atualizado_em).ddmm + ')' : '';
        return (NOMES_FONTES[k] || k) + quando;
      });
      const diasParado = P.diasUteisEntre(ctx.atualizado.data, ctx.hoje);
      const avisos = [];
      if (diasParado > 2) avisos.push('A última atualização automática foi em ' + ctx.atualizado.ddmmaaaa + ', ' + diasParado + ' dias úteis atrás. Os números podem estar defasados.');
      if (falhas.length) avisos.push('Não foi possível atualizar na última coleta: ' + falhas.join('; ') + '. O painel mostra o último dado disponível.');

      const vals = {
        rootClass: this.props.movimento !== false ? 'pm-root' : 'pm-root pm-still',
        nav: nav, views: VIEWS.length,
        isVisao: s.view === 'visao', isFocus: s.view === 'expectativas', isEconomia: s.view === 'economia', isAgenda: s.view === 'agenda', isMetodo: s.view === 'metodologia',
        askName: s.askName, showPanel: !s.askName,
        nameDraft: s.nameDraft, onNameInput: (ev) => this.setState({ nameDraft: ev.target.value }),
        namePreview: saudacao + (s.nameDraft.trim() ? ', ' + s.nameDraft.trim().replace(/\s+/g, ' ') : ''),
        saveName: (ev) => this.saveName(ev), cancelName: () => this.cancelName(), removeName: () => this.removeName(),
        changeName: () => this.changeName(), dismissNameChip: () => this.dismissNameChip(),
        nameHasSaved: !!s.name, nameNoSaved: !s.name,
        nomePendente: s.nomePendente && !s.name,
        hasName: !!s.name, noName: !s.name, initials: s.name ? iniciais(s.name) : '',
        greeting: saudacao, greetSuffix: s.name ? ', ' + s.name : '',
        explica: s.explica, explicaClass: s.explica ? 'pm-pill pm-pill-on' : 'pm-pill',
        toggleExplica: () => { P.gravar('pm-explica', !s.explica); this.setState({ explica: !s.explica }); },
        aj: ctx.ajuda,
        hasAvisos: avisos.length > 0, avisos: avisos.map((t) => ({ t })),
        notifOpen: s.notifOpen, toggleNotif: () => this.toggleNotif(),
      };

      Object.keys(P.secoes).forEach((nome) => {
        try {
          Object.assign(vals, P.secoes[nome](ctx));
          vals[nome + 'Ok'] = true; vals[nome + 'Falhou'] = false;
        } catch (erro) {
          if (!this._avisados) this._avisados = {};
          if (!this._avisados[nome]) { console.error('Bloco "' + nome + '" não pôde ser montado:', erro); this._avisados[nome] = true; }
          vals[nome + 'Ok'] = false; vals[nome + 'Falhou'] = true;
        }
      });

      // alertas: guarda os ids para marcar como vistos quando o sino for aberto
      const alertas = vals.alertasLista || [];
      this._idsAlertas = alertas.map((a) => a.id);
      const novos = alertas.filter((a) => !s.vistos.includes(a.id)).length;
      vals.alerts = alertas;
      vals.alertCount = String(novos);
      vals.hasNewAlerts = novos > 0;
      vals.alertLabel = novos ? 'Alertas: ' + novos + (novos === 1 ? ' novo' : ' novos') : 'Alertas';
      return vals;
    }
  }

  P.Painel = Painel;

  // ---------- inicia o painel quando os dados chegarem
  function erro(msg) {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const tpl = document.getElementById('modelo-erro').content.cloneNode(true);
    tpl.querySelector('[data-msg]').textContent = msg;
    tpl.querySelector('button').addEventListener('click', () => location.reload());
    app.appendChild(tpl);
  }

  const json = (url, opcional) => fetch(url, { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(url + ': HTTP ' + r.status); return r.json(); })
    .catch((e) => { if (opcional) return null; throw e; });

  if (location.protocol === 'file:') {
    erro('Abra o painel por um servidor: rode "python -m http.server" dentro da pasta site e acesse http://localhost:8000. Abrindo o arquivo direto, o navegador bloqueia a leitura dos dados.');
    return;
  }

  Promise.all([json('dados.json'), json('manual.json'), json('leituras.json', true)])
    .then(([dados, manual, leituras]) => {
      const movimento = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const painel = new Painel(dados, manual, leituras, { movimento: movimento });
      window.painel = painel;
      const app = document.getElementById('app');
      app.innerHTML = '';  // tira a tela de carregamento
      Motor.montar(app, document.getElementById('modelo'), painel);
      painel.ligarEventosGlobais();
      if (painel.state.view === 'visao') painel.animateIn();
    })
    .catch((e) => {
      console.error(e);
      erro('Não foi possível carregar os dados do painel. Verifique sua conexão e tente de novo.');
    });
})();
