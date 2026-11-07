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

- `coletar.py` busca os dados só em fontes oficiais: Banco Central (SGS e Focus), IBGE (SIDRA), B3 (Ibovespa), Tesouro Transparente e FRED, do Federal Reserve de St. Louis (EUA e petróleo).
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

## Fontes

**Toda informação do painel tem fonte com link**: cada bloco mostra a linha "Fonte:" e a aba Metodologia lista
todas as referências. Os testes falham se um bloco ficar sem fonte ou se um dado manual não tiver link.

| Informação | Fonte |
|---|---|
| Selic, IPCA, núcleos, CDI, dólar, TR, IBC-Br, desocupação, dívida, IGP-M | Banco Central, SGS (IBGE e FGV via BC) |
| Expectativas | Banco Central, Boletim Focus (API Olinda) |
| IPCA por grupo | IBGE, SIDRA tabela 7060 |
| Ibovespa | B3 (estatísticas oficiais do índice) |
| Juro real de mercado e inflação implícita | Tesouro Nacional, Tesouro Transparente |
| Juros dos EUA, inflação dos EUA, Brent | FRED (Federal Reserve, U.S. Treasury, BLS, EIA) |
| Juro neutro de 5,00% e definição de Selic real ex-ante | BC, Relatório de Política Monetária, set/2026, p. 80 |
| Média dos núcleos (EX0, EX3, MS, DP, P55) | BC, RPM set/2026, p. 36, e Nota Técnica nº 57 |
| Meta e meta contínua | BC (histórico das metas) e Decreto nº 12.079/2024 |
| Poupança, IR e custódia | Lei nº 12.703/2012, Lei nº 11.033/2004 e B3 (tarifação do Tesouro Direto) |
| Calendário do Copom e feriados | BC (calendário do Copom) e B3 (calendário de negociação) |
| Ranking mundial de juro real | Moneyou, via Agência Brasil |

## O que você atualiza à mão

Tudo fica em **`site/manual.json`** (dá para editar direto no GitHub, no botão de lápis). **Todo dado manual precisa de
fonte com link e data de conferência**; o teste automático falha se faltar.

| Campo | Quando atualizar |
|---|---|
| `copom` | Quando o BC divulgar o calendário do ano seguinte (até junho). Use o número da reunião (`R1/2028`...). Já cadastrado até dez/2027. |
| `feriados` | Quando a B3 publicar o calendário do ano. Datas de anos sem calendário oficial levam `"previsto": true`. |
| `eventos` | Opcional: outros eventos da agenda, sempre com fonte: `{"data": "2027-01-10", "titulo": "...", "tipo": "IBGE", "fonte": "https://..."}`. |
| `neutro` | Quando o BC revisar a taxa neutra no Relatório de Política Monetária. |
| `ranking_mundo` | Quando sair um ranking novo, com o link da matéria ou do relatório. |

O teste também avisa se uma decisão do Copom não cair numa quarta-feira.

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
