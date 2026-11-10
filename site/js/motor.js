/*
 * motor.js — transforma o modelo HTML do painel em tela, sem bibliotecas.
 *
 * O modelo (a <template id="modelo"> do index.html) usa:
 *   {{nome}}                                 → valor vindo do painel.js
 *   <template data-for="lista" data-as="x">  → repete o bloco para cada item
 *   <template data-if="condicao">            → mostra o bloco só se for verdadeiro
 *   onClick="{{funcao}}"                     → evento (click, change, mouseenter...)
 *
 * A cada mudança, o motor monta a tela nova na memória e só altera na página
 * o que mudou. Assim as animações não reiniciam e os controles não travam.
 */
(function () {
  function buscar(caminho, escopo) {
    caminho = caminho.trim();
    if (caminho === 'true') return true;
    if (caminho === 'false') return false;
    return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), escopo);
  }

  function interpolar(texto, escopo) {
    const inteiro = texto.match(/^\s*\{\{([^}]+)\}\}\s*$/);
    if (inteiro) return { inteiro: true, valor: buscar(inteiro[1], escopo) };
    return {
      inteiro: false,
      valor: texto.replace(/\{\{([^}]+)\}\}/g, (m, c) => { const v = buscar(c, escopo); return v == null ? '' : String(v); }),
    };
  }

  function ouvir(el, tipo) {
    el.__tipos = el.__tipos || new Set();
    if (el.__tipos.has(tipo)) return;
    el.__tipos.add(tipo);
    el.addEventListener(tipo, (ev) => { const f = el.__on && el.__on[tipo]; if (f) f(ev); });
  }

  function filhos(no) { return no.content ? no.content.childNodes : no.childNodes; }

  function montar(no, escopo, destino) {
    if (no.nodeType === 3) {
      destino.appendChild(document.createTextNode(interpolar(no.nodeValue, escopo).valor));
      return;
    }
    if (no.nodeType !== 1) return;

    if (no.localName === 'template' && no.hasAttribute('data-for')) {
      const lista = buscar(no.getAttribute('data-for'), escopo) || [];
      const nome = no.getAttribute('data-as');
      lista.forEach((item, i) => {
        const e2 = Object.assign({}, escopo, { [nome]: item, $index: i });
        filhos(no).forEach((f) => montar(f, e2, destino));
      });
      return;
    }
    if (no.localName === 'template' && no.hasAttribute('data-if')) {
      if (buscar(no.getAttribute('data-if'), escopo)) filhos(no).forEach((f) => montar(f, escopo, destino));
      return;
    }

    const el = document.createElementNS(no.namespaceURI, no.localName);
    el.__on = {};
    let valor, marcado;
    for (const at of Array.from(no.attributes)) {
      const r = interpolar(at.value, escopo);
      if (at.name.startsWith('on')) {
        let tipo = at.name.slice(2).toLowerCase();
        if (tipo === 'change') tipo = 'input';
        if (typeof r.valor === 'function') { el.__on[tipo] = r.valor; ouvir(el, tipo); }
        continue;
      }
      if (at.name === 'value' && no.localName === 'input') { valor = r.valor; continue; }
      if (at.name === 'checked' && no.localName === 'input') { marcado = !!r.valor; continue; }
      // atributos aria-* precisam do texto "true"/"false" (leitores de tela não entendem atributo vazio)
      if (at.name.startsWith('aria-') && typeof r.valor === 'boolean') { el.setAttribute(at.name, String(r.valor)); continue; }
      if (r.inteiro && (r.valor === false || r.valor == null)) continue;
      el.setAttribute(at.name, r.valor === true ? '' : String(r.valor));
    }
    if (valor !== undefined) el.value = valor;
    if (marcado !== undefined) el.checked = marcado;
    filhos(no).forEach((f) => montar(f, escopo, el));
    destino.appendChild(el);
  }

  // Dois nós "são o mesmo" se têm a mesma tag e o mesmo id / seção.
  function mesmo(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1) {
      for (const k of ['id', 'aria-labelledby']) if (a.getAttribute(k) !== b.getAttribute(k)) return false;
    }
    return true;
  }

  function atualizarNo(velho, novo) {
    // classes "js-..." são postas pelo movimento.js (ex.: bloco já revelado) e sobrevivem ao redesenho
    const js = velho.classList ? Array.from(velho.classList).filter((c) => c.startsWith('js-')) : [];
    for (const at of Array.from(velho.attributes)) if (!novo.hasAttribute(at.name)) velho.removeAttribute(at.name);
    for (const at of Array.from(novo.attributes)) if (velho.getAttribute(at.name) !== at.value) velho.setAttribute(at.name, at.value);
    js.forEach((c) => velho.classList.add(c));
    velho.__on = novo.__on;
    for (const tipo in novo.__on) ouvir(velho, tipo);
    if (novo.localName === 'input') {
      if (velho.value !== novo.value) velho.value = novo.value;
      if (velho.checked !== novo.checked) velho.checked = novo.checked;
    }
    comparar(velho, novo);
  }

  function comparar(paiVelho, paiNovo) {
    const a = Array.from(paiVelho.childNodes), b = Array.from(paiNovo.childNodes);
    for (let i = 0; i < b.length; i++) {
      const v = a[i], n = b[i];
      if (!v) paiVelho.appendChild(n);
      else if (!mesmo(v, n)) paiVelho.replaceChild(n, v);
      else if (v.nodeType !== 1) { if (v.nodeValue !== n.nodeValue) v.nodeValue = n.nodeValue; }
      else atualizarNo(v, n);
    }
    for (let i = b.length; i < a.length; i++) paiVelho.removeChild(a[i]);
  }

  window.Motor = {
    montar(raiz, modelo, componente) {
      let agendado = false;
      const desenhar = () => {
        agendado = false;
        const valores = componente.renderVals();
        const nova = document.createElement('div');
        filhos(modelo).forEach((f) => montar(f, valores, nova));
        comparar(raiz, nova);
        if (componente.depoisDeDesenhar) componente.depoisDeDesenhar(raiz);
      };
      componente.atualizar = () => {
        if (!agendado) { agendado = true; requestAnimationFrame(desenhar); }
      };
      desenhar();
    },
  };
})();
