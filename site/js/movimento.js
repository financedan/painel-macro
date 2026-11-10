/*
 * movimento.js — animações do painel ao rolar a página:
 *   - cada bloco entra (sobe e aparece) quando chega na tela, e só então os gráficos se desenham;
 *   - os números grandes (classe pm-conta) contam do zero até o valor;
 *   - um brilho suave acompanha o mouse sobre os cartões.
 * Com "menos movimento" ligado no sistema as animações continuam, só que mais suaves (sem desfoque).
 */
(function () {
  const P = (window.PM = window.PM || {});
  const ALVOS = 'main article, main .pm-secao, main section > .pm-cab';
  let observador = null;
  const contados = new WeakSet();

  const quieto = () => !!document.querySelector('.pm-still');

  // ---------- números que contam até o valor (mantém prefixo, sufixo, sinal e casas decimais)
  const NUM = /[-+−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?|[-+−]?\d+(?:,\d+)?/;
  function formatar(v, modelo) {
    const casas = (modelo.split(',')[1] || '').length;
    const milhar = /\d\.\d{3}/.test(modelo);
    let s = Math.abs(v).toFixed(casas).replace('.', ',');
    if (milhar) s = s.replace(/^(\d+)/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    const sinal = /^[-−]/.test(modelo) ? '−' : /^\+/.test(modelo) ? '+' : '';
    return sinal + s;
  }
  function contar(el, atraso) {
    if (contados.has(el)) return;
    contados.add(el);
    const no = el.firstChild;
    if (!no || no.nodeType !== 3) return;
    const final = no.nodeValue, m = final.match(NUM);
    if (!m) return;
    const alvo = Number(m[0].replace(/[−]/g, '-').replace(/\./g, '').replace(',', '.'));
    if (!isFinite(alvo) || alvo === 0) return;
    const antes = final.slice(0, m.index), depois = final.slice(m.index + m[0].length);
    const dur = 1800;
    let inicio = 0, escrito = null;
    const passo = (agora) => {
      if (escrito !== null && no.nodeValue !== escrito) return;   // o painel redesenhou com outro valor: para
      if (!inicio) inicio = agora + atraso;
      const t = Math.max(0, Math.min(1, (agora - inicio) / dur));
      const e = 1 - Math.pow(1 - t, 4);
      escrito = t >= 1 ? final : antes + formatar(alvo * e, m[0]) + depois;
      no.nodeValue = escrito;
      if (t < 1) requestAnimationFrame(passo);
      else { el.classList.add('js-brilho'); setTimeout(() => el.classList.remove('js-brilho'), 900); }
    };
    no.nodeValue = antes + formatar(0, m[0]) + depois;
    escrito = no.nodeValue;
    requestAnimationFrame(passo);
  }

  function revelar(el, imediato) {
    el.classList.add('js-visto');
    const atraso = imediato ? 350 : 120;
    el.querySelectorAll('.pm-conta').forEach((n, i) => contar(n, atraso + i * 90));
    if (el.classList.contains('pm-conta')) contar(el, atraso);
  }

  // chamado depois de cada desenho do painel: observa os blocos novos
  P.movimento = {
    observar(raiz) {
      if (quieto() || !('IntersectionObserver' in window)) return;
      if (!observador) {
        observador = new IntersectionObserver((entradas) => {
          entradas.forEach((en) => {
            const el = en.target;
            if (!el.classList.contains('js-obs')) return;
            if (!el.classList.contains('js-pronto')) {
              // primeira olhada: o que já está na tela só ganha a contagem; o resto espera a rolagem
              el.classList.add('js-pronto');
              if (en.isIntersecting) { revelar(el, true); observador.unobserve(el); }
              else el.classList.add('js-revela');
              return;
            }
            if (en.isIntersecting) { revelar(el, false); observador.unobserve(el); }
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      }
      raiz.querySelectorAll(ALVOS).forEach((el) => {
        if (el.classList.contains('js-obs')) return;
        el.classList.add('js-obs');
        observador.observe(el);
      });
    },
  };

  // ---------- brilho que acompanha o mouse nos cartões
  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || quieto()) return;
    const card = ev.target.closest && ev.target.closest('main article.pm-glass');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
    card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
  }, { passive: true });
})();
