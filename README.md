# Painel Macro Brasil

[![Atualizar dados](https://github.com/financedan/painel-macro/actions/workflows/atualizar.yml/badge.svg)](https://github.com/financedan/painel-macro/actions/workflows/atualizar.yml)
[![Testes](https://github.com/financedan/painel-macro/actions/workflows/testes.yml/badge.svg)](https://github.com/financedan/painel-macro/actions/workflows/testes.yml)

Juros, inflação e expectativas do Brasil em um só painel, com as contas explicadas.
Os dados se atualizam sozinhos todo dia útil, às 19h de Brasília.

**Site:** https://financedan.github.io/painel-macro/ · **Feed RSS:** `/feed.xml`

## O que tem no painel

| Aba | Conteúdo |
|---|---|
| Visão geral | Selic, IPCA, juro real (ex-post e ex-ante), Copom com a Selic esperada por reunião, inflação contra a meta (com contador da meta contínua), ancoragem, Ibovespa, bolsa x CDI em 10 anos, calculadora de rendimento, volatilidade, simulador, Brasil no mundo, leitura da semana |
| Expectativas | Boletim Focus com a faixa de respostas, trajetória do juro real, histórico semanal, Selic reunião a reunião, juro real de mercado e inflação implícita (Tesouro Direto), perguntas com a resposta do painel |
| Economia | Selic e cada decisão do Copom desde 2017, IPCA por grupo, núcleos, dólar, IBC-Br, desemprego, dívida bruta, IGP-M, diferencial de juros Brasil x EUA |
| Agenda | Copom, atas, Focus e feriados, com navegação entre meses e exportação para a sua agenda (.ics) |
| Metodologia | Fontes com o status da última coleta, fórmulas, juro neutro, glossário, como citar e download dos dados em CSV |

Cada bloco tem um botão **?** com uma explicação simples. O **Modo explicativo** (no topo) abre todas de uma vez.

## Como funciona

```
GitHub Actions (seg–sex, 19h) → coletar.py → site/dados.json ─┐
                                                              ├→ site/index.html + js/ (sem bibliotecas)
site/manual.json (você edita) ────────────────────────────────┤
leituras/AAAA-MM-DD.md (você escreve) → site/leituras.json ───┘
```

- `coletar.py` busca os dados no Banco Central (SGS e Focus), IBGE (SIDRA), Tesouro Transparente e Yahoo Finance.
  Se uma fonte falhar, mantém o último dado bom dela, e o site avisa o visitante que aquele dado pode estar defasado.
  Antes de salvar, confere se os números fazem sentido (ex.: Selic entre 0 e 40%).
- O robô também gera a imagem de prévia do link (`site/img/og.png`, com os números do dia), o `feed.xml` e as meta tags.
- `site/js/painel.js` é o núcleo; cada aba tem seu arquivo em `site/js/secoes/`. Se um bloco falhar, só ele some da tela.

## Rodar no seu computador

```bash
python -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements-dev.txt
```

```bash
python coletar.py
```

```bash
cd site && python -m http.server 8000
```

Depois abra http://localhost:8000. Abrir o `index.html` com dois cliques não funciona: o navegador bloqueia a leitura dos dados fora de um servidor.

## O que você atualiza à mão

Tudo fica em **`site/manual.json`** (dá para editar direto no GitHub, no botão de lápis):

| Campo | Quando atualizar |
|---|---|
| `copom` | Quando o BC divulgar o calendário do ano seguinte. Use o número da reunião (`R1/2027`, `R2/2027`...) para o painel cruzar com o Focus. **Hoje o calendário termina em 09/12/2026.** |
| `feriados` | Uma vez por ano (2026 e 2027 já estão cadastrados). |
| `eventos` | Opcional: outros eventos da agenda, ex.: `{"data": "2027-01-10", "titulo": "IPCA de dezembro", "tipo": "IBGE"}`. |
| `neutro` | Quando o BC revisar a estimativa de juro neutro. |
| `ranking_mundo` | Quando sair um ranking novo de juro real. |
| `vix` | Opcional: leituras do S&P/B3 Ibovespa VIX citadas pela imprensa (o painel já calcula a volatilidade sozinho). |

O teste automático avisa se uma decisão do Copom não cair numa quarta-feira ou se o calendário estiver acabando.

### Leitura da semana

Crie um arquivo `leituras/AAAA-MM-DD.md` (a data da segunda-feira do Focus). A primeira linha pode ser o título (`# ...`);
parágrafos são separados por linha em branco e `**negrito**` funciona. Enquanto não houver leitura da semana, o painel
mostra um resumo automático do Focus.

## Publicação (uma vez só)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Pronto: o workflow `Publicar site` publica a pasta `site/` a cada mudança na `main` e depois de cada coleta.

### Avisos no Telegram (opcional)

Crie os segredos `TELEGRAM_TOKEN` (do @BotFather) e `TELEGRAM_CHAT` em **Settings → Secrets and variables → Actions**.
O robô passa a mandar mensagem quando a coleta falha e quando há novidade (Selic mudou, novo Focus, novo IPCA).

## Testes

```bash
python -m pytest -q
```

```bash
npm install && npx playwright install chromium && npm test
```

O primeiro testa o coletor e o `manual.json`; o segundo abre o painel num navegador de verdade (computador, celular,
"menos movimento" e com fontes faltando). Os dois rodam sozinhos no GitHub a cada mudança.

## Documentos

- [RELATORIO-UX.md](RELATORIO-UX.md): análise de inconsistências (e o que foi corrigido).
- [IDEIAS.md](IDEIAS.md): ideias de melhorias (e o que foi implementado).
