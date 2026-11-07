# Relatório de análise — Painel Macro Brasil

Data da análise: 07/11/2026 · Versão analisada: commit `e48991c`

Este relatório revisa todo o repositório (coletor Python, robô do GitHub Actions,
HTML, JavaScript, CSS e dados). O foco são **inconsistências que atrapalham a experiência
de quem usa o painel**. Cada ponto foi conferido no código e, quando possível, abrindo o
painel num navegador (desktop 1440 px, iPhone 13 e modo "menos movimento").

---

## Status das correções (atualizado em 07/11/2026)

| # | Problema | Status |
|---|---|---|
| 1 | Data do corte da Selic | ✅ Copom de setembro corrigido para 15–16/09; a data da decisão vem do próprio SGS; Metodologia diz "em vigor desde 17/09 (decisão de 16/09)"; teste acusa decisão fora de quarta-feira |
| 2 | Card "Brasil no mundo" | ✅ Números no `manual.json` com o mês do ranking em destaque, linha "Brasil hoje" calculada e diferencial de juros com os EUA |
| 3 | Índice do medo | ✅ Trocado por volatilidade calculada sozinha (Ibovespa, 21 pregões); escala 0–60% descrita certo; VIX manual vira referência com "há X dias" e selo "desatualizado" |
| 4 | Leitura da semana vazia | ✅ Leituras em `leituras/*.md`; sem leitura nova, aparece um resumo automático do Focus |
| 5 | Sem aviso de dado velho | ✅ Faixa de aviso quando uma fonte falha ou a coleta para; status de cada fonte na Metodologia; validação antes de salvar; versões fixas |
| 6 | Calendário acabando | ⚠️ Feriados de 2027 cadastrados e Focus pula para o próximo dia útil. **O calendário do Copom de 2027 ainda precisa ser cadastrado à mão**; o painel e os testes avisam |
| 7 | Fechamento no meio do pregão | ✅ Robô roda às 19h e o coletor descarta a linha do dia antes das 18h |
| 8 | Menu duplicado | ✅ Computador: só o menu do topo. Celular: só a barra fixa no rodapé |
| 9 | Tela de nome obrigatória | ✅ Painel abre direto; convite discreto; "Cancelar" e "Remover meu nome" |
| 10 | Sino de alertas | ✅ Conta só o que não foi visto; fecha com Esc e clique fora; `aria-expanded` correto; novidades desde a última visita |
| 11 | Cores | ✅ Azul = agora/destaque, âmbar = inflação e alerta, cinza = histórico (regra documentada em `js/util.js`) |
| 12 | Formatos | ✅ Datas `06/11` e `6 de novembro`; 2 casas em taxas, 1 em rótulos e bolsa; "—" no lugar de valor ausente |
| 13 | Fuso | ✅ Datas e horas sempre no fuso de Brasília, com "(Brasília)" |
| 14 | Menos movimento | ✅ Respeitado também nos números; contagem animada só na primeira entrada |
| 15 | Acessibilidade | ✅ Barras com foco por teclado e rótulo; "Toque ou passe o mouse"; `aria-valuetext` nos controles; agenda com meses |
| 16 | Textos fixos | ✅ Frase dos anos negativos gerada pelos dados; asterisco explicado; "Banco Central, IBGE e B3" |
| 17 | Simulador | ✅ Passo de 0,01 e duas casas; marcações −5%, neutro e 15% |
| 18 | Clicável e espaços vazios | ✅ Sem efeito de elevação em cards não clicáveis; linhas alinhadas pelo topo |
| 19 | Juro neutro sem fonte | ✅ Valor, fonte e data no `manual.json`, explicados na Metodologia |
| 20 | Perguntas do Focus | ✅ Resposta do painel ao marcar (inclusive a das semanas seguidas); marcações salvas por semana |
| 21 | Erros de carregamento | ✅ Tela de erro com "Tentar de novo" e explicação para quem abre o arquivo direto; cada bloco falha sozinho |
| 22 | Manutenção | ✅ README completo, publicação no GitHub Pages, testes, `og:image` absoluta, favicon, código sem uso removido. ⚠️ Estilos inline: os repetidos viraram classes; o resto sai aos poucos |

---

## 1. Como o projeto funciona (resumo)

```
GitHub Actions (seg–sex, 10h)  →  coletar.py  →  site/dados.json  →  site/index.html + js/painel.js
                                     │
                                     ├─ Banco Central SGS 432 (Selic) e 13522 (IPCA 12m)
                                     ├─ Banco Central Olinda (Boletim Focus)
                                     └─ yfinance ^BVSP (Ibovespa)

site/js/manual.js  →  dados digitados à mão: Copom, feriados, índice do medo, leitura da semana
site/js/motor.js   →  mini-motor de templates ({{campo}}, data-for, data-if) sem bibliotecas
```

| Arquivo | Papel |
|---|---|
| `coletar.py` | Baixa Selic, IPCA, Focus e Ibovespa; calcula juro real (Fisher); grava `site/dados.json`. Se uma fonte falha, mantém o dado antigo dela. |
| `.github/workflows/atualizar.yml` | Roda o coletor em dias úteis às 13h UTC (10h de Brasília) e faz commit do JSON. |
| `site/index.html` | Todo o layout em um `<template>`, com estilos inline. Quatro telas: Visão geral, Expectativas, Agenda, Metodologia. |
| `site/js/painel.js` | Toda a lógica e os textos: KPIs, gráficos SVG, alertas, agenda, simulador. |
| `site/js/manual.js` | Dados sem fonte automática (precisam de manutenção manual). |
| `site/css/painel.css` | Visual "vidro", animações, responsivo. |

O projeto é bem pensado: tem coleta automática, retentativas, preservação do dado antigo
em caso de falha, cálculo correto de juro real pela fórmula de Fisher e textos explicativos.
Os problemas abaixo são, na maioria, de **coerência entre partes** do painel.

---

## 2. Resumo dos problemas

| # | Problema | Gravidade | Onde |
|---|---|---|---|
| 1 | A data do último corte da Selic aparece de dois jeitos (16/9 e 17/9) | 🔴 Alta | `manual.js`, `painel.js` |
| 2 | Card "Brasil no mundo" está fixo no HTML e contradiz os dados atuais | 🔴 Alta | `index.html:397-411` |
| 3 | Índice do medo: dado manual desatualizado, rotulado como "Diária", e escala descrita de forma errada | 🔴 Alta | `manual.js`, `painel.js:539`, `index.html:597` |
| 4 | "Leitura da semana" vazia, mas o painel promete leitura semanal | 🔴 Alta | `manual.js:37-40`, `painel.js:496` |
| 5 | Nenhum aviso quando um dado está velho ou uma fonte falhou | 🔴 Alta | `coletar.py:235`, `painel.js` |
| 6 | Calendário do Copom e feriados acabam em dez/2026 | 🔴 Alta | `manual.js:12-25` |
| 7 | Risco de o "fechamento" do Ibovespa ser um preço do meio do pregão | 🟠 Média-alta | `atualizar.yml:6`, `coletar.py:188` |
| 8 | Menu duplicado (topo + barra lateral), muito visível no celular | 🟠 Média | `index.html:77-113`, `painel.css:68-71` |
| 9 | Tela de nome obrigatória bloqueia o painel na primeira visita | 🟠 Média | `index.html:27-64`, `painel.js:96` |
| 10 | Sino de alertas: contador sempre igual, não fecha com Esc ou clique fora | 🟠 Média | `index.html:86-101`, `painel.js:508` |
| 11 | Cores com significados diferentes em cada gráfico | 🟠 Média | vários |
| 12 | Datas e casas decimais em formatos misturados | 🟠 Média | `painel.js` |
| 13 | Hora da atualização muda conforme o fuso de quem visita | 🟡 Baixa-média | `painel.js:169-170` |
| 14 | "Menos movimento" do sistema é ignorado nos números animados | 🟡 Baixa-média | `painel.js:105-116, 578` |
| 15 | Gráficos só funcionam com mouse; problemas de acessibilidade | 🟡 Baixa-média | `index.html`, `motor.js:70` |
| 16 | Textos fixos que vão ficar errados com o tempo | 🟡 Baixa | `index.html:185`, `painel.js:364` |
| 17 | Simulador mostra 4,6% mas calcula com 4,58% | 🟡 Baixa | `index.html:381`, `painel.js:544` |
| 18 | Elementos parecem clicáveis mas não são; espaços vazios nos cards | 🟡 Baixa | `index.html`, `painel.css:17` |
| 19 | "Juro neutro de 5%" usado em tudo, mas sem explicação de origem | 🟡 Baixa | `painel.js:151, 578` |
| 20 | Perguntas do Focus: uma não pode ser respondida e as marcações se perdem | 🟡 Baixa | `painel.js:458-465` |
| 21 | Erro de carregamento pobre; um campo faltando derruba o painel inteiro | 🟡 Baixa | `painel.js:583-586` |
| 22 | README vazio, publicação não documentada, código sem uso | ⚪ Manutenção | raiz |

---

## 3. Detalhamento

### 🔴 1. Data do último corte da Selic em duas versões

- O card **Selic (meta)** diz: *"Mantida em 4/11 · último corte em **16/9**"*.
- A tela **Metodologia** diz: *"13,75% desde **17/09/2026**"*.
- O `manual.js` registra a reunião de setembro como `inicio: '2026-09-16', decisao: '2026-09-17'`.

Três datas para o mesmo evento. A causa:

1. Em `manual.js`, a reunião de setembro está **um dia adiantada**. 16/09/2026 é quarta e 17/09 é
   quinta. O Copom decide às quartas (as outras reuniões do arquivo, 3–4/nov e 8–9/dez, são terça–quarta).
   O próprio SGS confirma: a nova Selic vale desde 17/09, então a decisão foi em 16/09.
2. `painel.js:159` calcula a decisão como "dia anterior ao `desde`" (16/9), mas a Metodologia
   mostra o `desde` cru (17/9) com a palavra "desde", sem explicar que é a data de vigência.
3. Com a decisão errada (quinta), a ata calculada (`decisao + 6`) cairia numa quarta, não na terça.

**Sugestão:** corrigir para `{ inicio: '2026-09-15', decisao: '2026-09-16' }`; na Metodologia escrever
"13,75% desde a decisão de 16/09/2026" (ou "em vigor desde 17/09"); validar no `painel.js` que
toda `decisao` cai numa quarta e mostrar aviso no console se não cair.

### 🔴 2. Card "Brasil no mundo" contradiz o resto do painel

O card é texto fixo no HTML (`index.html:397-411`):

- Mostra o Brasil com **9,33%** de juro real, enquanto o KPI ao lado mostra **8,77%** hoje.
- Diz *"logo após o corte da Selic para 14,50%"*, mas a Selic atual é **13,75%** (houve 3 cortes depois disso).
- "2º maior juro real do mundo" é de **maio/2026**, mas o card não mostra a data em destaque.
- Tem a classe `pm-lift` (sobe ao passar o mouse), o que sugere que é clicável, mas não é.

**Sugestão:** levar os números para o `manual.js` (como já é feito com o índice do medo), mostrar
"Ranking de maio/2026" em destaque no título e incluir uma linha "Brasil hoje: 8,77%" calculada.
Ou remover o card até haver um ranking mais recente.

### 🔴 3. Índice do medo: desatualizado, frequência errada e escala descrita errado

- Último dado manual: **26/10/2026**. Hoje é 07/11, ou seja, 12 dias sem atualizar, e o card não destaca isso.
- A Metodologia diz frequência **"Diária"** (`index.html:597`), mas a atualização é manual e esporádica.
- O rodapé do card diz *"Escala de 0 a 100"* (`painel.js:539`), mas o velocímetro vai de **0 a 50**
  (`gMax = 50`, `painel.js:321`). Valores acima de 50 ficam presos no fim do arco sem aviso.
- "Recorde em 22/10" é o maior valor **das leituras digitadas**, não um recorde histórico. Do jeito que está, engana.
- Mistura formatos de data no mesmo card: leituras em `2/out` e recorde em `22/10`.
- O comentário fala da eleição ("a incerteza da eleição acabou"). É um texto de momento, que envelhece rápido.
- No gráfico pequeno, o texto "30 = turbulência" fica por cima da linha e dos pontos.

**Sugestão:** mostrar "Atualizado há X dias" calculado a partir da data do último dado, e deixar o card
esmaecido ou com selo "desatualizado" depois de alguns dias; trocar "Diária" por "Manual (fonte diária)";
corrigir o texto da escala; renomear "Recorde" para "Maior leitura recente".

### 🔴 4. "Leitura da semana" vazia

`manual.js` está com `leitura: { data: '', texto: '' }`. O card mostra *"A leitura desta semana sai depois do
próximo Boletim Focus"*, mas o item 07 de "O que este painel faz diferente" diz *"Simulador e leitura semanal
do próprio autor"*. Quem chega vê uma promessa não cumprida no lugar de destaque.

**Sugestão:** esconder o card enquanto não houver texto, ou mostrar a leitura anterior com a data dela.
Ajustar o item 07 para algo que já está entregue.

### 🔴 5. Nenhum aviso de dado velho ou fonte com falha

- O `coletar.py` grava a lista `erros` no `dados.json` (`coletar.py:235`), mas **o site nunca lê esse campo**.
  Se o Focus falhar por uma semana, o painel continua exibindo o Focus antigo como se fosse o atual.
- O site não compara `atualizado_em` com a data de hoje. Se o robô parar (o GitHub desliga agendamentos
  em repositórios sem atividade, a API do BC muda, o yfinance quebra), ninguém é avisado.
- `requirements.txt` não fixa versões (`requests`, `yfinance`). Uma atualização do yfinance pode quebrar a
  coleta sem nenhum aviso.

**Sugestão:** se `erros` não estiver vazio, mostrar um selo discreto ("Focus não atualizado hoje") no card
afetado. Mostrar um aviso geral se `atualizado_em` tiver mais de 3 dias úteis. Fixar versões no `requirements.txt`.

### 🔴 6. Calendário do Copom e feriados acabam em dezembro de 2026

- O `manual.js` tem só três reuniões do Copom (set, nov e dez de 2026). Depois de 09/12/2026, o painel
  mostra "Próximo Copom: a definir", o contador vira "—" e o alerta diz "em data a definir". O BC costuma
  divulgar o calendário do ano seguinte com bastante antecedência, então isso dá para evitar.
- Os feriados terminam em 01/01/2027. Em 2027, segundas de feriado (Carnaval, por exemplo) vão aparecer
  como "Boletim Focus · Segunda de manhã", o que estará errado.

**Sugestão:** cadastrar já o calendário do Copom de 2027 e os feriados nacionais de 2027. Mostrar um aviso
quando faltarem menos de 60 dias de calendário cadastrado.

### 🟠 7. "Fechamento" do Ibovespa pode ser preço do meio do pregão

O robô roda às 10h de Brasília (`atualizar.yml:6`), que é exatamente a abertura da B3. O agendamento do GitHub
costuma atrasar de 5 a 30 minutos. Nesse caso, o `yfinance` devolve uma linha do dia atual com o preço daquele
momento, e o `coletar.py:188` grava esse valor como **"fechamento"**, a variação na semana e o retorno do ano.
(Não aconteceu nos dados atuais porque a última execução foi num sábado, mas o risco existe em todo dia útil.)

**Sugestão:** descartar linhas com data igual a hoje antes das 18h, ou rodar o robô à noite (por exemplo
22h UTC = 19h de Brasília). Selic, IPCA e Focus continuam disponíveis nesse horário.

### 🟠 8. Menu duplicado

As mesmas quatro opções aparecem **duas vezes**: nos botões do topo (`pm-topnav`) e na barra lateral
(`pm-dock`). No desktop isso já é redundante. **No celular**, as duas viram faixas horizontais, uma embaixo
da outra, e ocupam quase meia tela antes do conteúdo (ver captura em 390 px). Além disso, a faixa do topo
corta o texto ("Age…") sem nenhum sinal de que dá para rolar para o lado.

**Sugestão:** manter só uma navegação por tamanho de tela, por exemplo os botões do topo no desktop e uma
barra fixa no rodapé no celular, escondendo a outra.

### 🟠 9. Tela de nome bloqueia a primeira visita

Quem entra pela primeira vez vê uma tela cheia pedindo o nome antes de ver qualquer número. Para um painel
de dados, isso aumenta a chance de a pessoa sair. Outros pontos:

- Ao clicar no avatar para trocar o nome, não existe "Cancelar": as saídas são salvar ou "Continuar sem nome",
  e esta **apaga** o nome já salvo.
- Num link compartilhado (por exemplo, a prévia do WhatsApp com `og:image`), o primeiro contato não mostra dado nenhum.

**Sugestão:** abrir direto no painel com saudação genérica e pedir o nome num aviso discreto ou no avatar.
Na troca de nome, incluir "Cancelar", que volta sem mudar nada.

### 🟠 10. Sino de alertas

- O selo mostra sempre **5** (o total de alertas gerados), nunca diminui e nunca zera. Parece notificação não
  lida, mas não é. Depois da primeira visita, ensina a pessoa a ignorar o sino.
- O painel **não fecha** com `Esc` nem com clique fora (testado), só clicando no sino de novo.
- Acessibilidade: com o painel fechado o atributo `aria-expanded` some, e com ele aberto fica `aria-expanded=""`.
  Leitores de tela não entendem o estado. A causa está no `motor.js:70`, que descarta atributos com valor
  `false` e transforma `true` em texto vazio.

**Sugestão:** marcar como lido (guardar no `localStorage` o que já foi visto) ou trocar o número por um ponto
só quando houver novidade; fechar com `Esc` e clique fora; no motor, tratar `aria-*` como texto `"true"`/`"false"`.

### 🟠 11. Cores com significados que mudam

| Cor | Significa… |
|---|---|
| Azul `#8fb0ff` | "Hoje" (juro real) · "Ano de **queda**" (Ibovespa) · "Focus" (agenda) · "Estimulativa" (simulador) · área do juro real (trajetória) |
| Âmbar `#f0b37a` | IPCA · ano **atual** do Ibovespa · Copom · turbulência · contracionista · acima do teto |

No gráfico de juro real, azul destaca o ano atual. No gráfico do Ibovespa, logo abaixo, o ano atual é âmbar
e o azul passa a significar queda. Quem lê o painel de cima para baixo aprende uma regra e ela muda no card seguinte.

**Sugestão:** fixar um significado por cor (por exemplo, azul = "agora/atual", âmbar = "inflação/alerta",
cinza = histórico) e usar outra forma, como barra vazada ou para baixo, para "ano de queda".

### 🟠 12. Datas e números em formatos misturados

Na mesma tela aparecem: `4/11`, `06/11`, `29/out`, `8–9 dez`, `7 dez`, `17/09/2026`, `2/out` e `22/10`.
Os números também variam:

- juro real **8,77%** no KPI, **8,8%** na barra e na trajetória;
- Ibovespa **−0,4%** no KPI e no destaque, **−0,41%**/**+4,58%** em outros lugares;
- Câmbio no Focus: valor "R$ 5,34" e variação "▲ 0,29" sem unidade.

**Sugestão:** escolher um formato curto (`06/11`) e um longo (`6 de novembro`), e uma regra de casas
decimais (2 para taxas, 1 para variação de bolsa). Centralizar isso nas funções `fmt`/`ddmm`.

### 🟡 13. Hora da atualização depende do fuso de quem visita

`painel.js:169-170` usa `getHours()` no fuso do navegador. O JSON diz `12:26-03:00`, mas quem abre o painel
fora do Brasil (testado em UTC) vê **"atualizado em 07/11 às 15h26"**. A saudação (bom dia/boa tarde) também
usa o fuso local, mas aí isso é desejável.

**Sugestão:** formatar com `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })` e escrever "(Brasília)".

### 🟡 14. "Menos movimento" ignorado nos números

O CSS respeita `prefers-reduced-motion`, mas o JavaScript liga a contagem animada (`movimento: true` fixo em
`painel.js:578`). Testado com "menos movimento" ativado: 150 ms depois de abrir, o KPI da Selic mostrava
**4,08%** em vez de 13,75%. A animação também se repete toda vez que se volta para "Visão geral".

**Sugestão:** `movimento: !matchMedia('(prefers-reduced-motion: reduce)').matches`, e animar só na primeira entrada.

### 🟡 15. Acessibilidade dos gráficos e controles

- Os detalhes das barras (juro real e Ibovespa) só aparecem com o mouse ou com toque. As barras não recebem
  foco pelo teclado (0 barras com `tabindex`).
- O texto "Passe o mouse nas barras" não serve para celular.
- Os seletores do simulador não têm `aria-valuetext` com "%".
- A agenda diz "clique em um dia" e não tem setas para outros meses.

**Sugestão:** `tabindex="0"` e `onFocus` nas barras; texto "Toque ou passe o mouse"; navegação entre meses na agenda.

### 🟡 16. Textos fixos que vão envelhecer

- `index.html:185`: *"Em 2020 e 2021 o juro real ficou negativo"* é fixo, mas o gráfico mostra uma janela
  móvel de 10 anos. Em poucos anos o texto vai falar de barras que não aparecem mais.
- `painel.js:364`: *"A meta ficou em 3% a partir de 2024; antes, era maior"*. Está correto, mas o comentário
  do código (`painel.js:11`) diz "Desde 2025". Vale alinhar.
- O asterisco em "2026\*" no gráfico de juro real não é explicado na legenda (no do Ibovespa é).
- O cabeçalho diz "Dados do Banco Central", mas o Ibovespa vem do Yahoo e o índice do medo da imprensa.

**Sugestão:** gerar a frase das barras negativas a partir dos dados; legendar o asterisco; trocar o subtítulo
por "Dados do Banco Central e da B3".

### 🟡 17. Simulador: mostra uma coisa e calcula outra

O seletor de IPCA anda de 0,1 em 0,1, mas começa em 4,58. Ele **mostra "4,6%"** e calcula com 4,58. Resultado:
"Subtração simples daria **9,17%**", quando 13,75 − 4,6 daria 9,15. Pequeno, mas confunde quem confere a conta.
A barrinha de posição (de −5% a 15%) também não tem marcações, então não dá para ler a escala.

**Sugestão:** passo de 0,01 ou mostrar 2 casas; colocar marcações "0%" e "neutro 5%" na barrinha.

### 🟡 18. Clicável ou não? E espaços vazios

- Os KPIs e o card "Brasil no mundo" sobem ao passar o mouse (`pm-lift`), como se fossem links, mas não fazem nada.
- No desktop, os cards "Juro real ao fim de cada ano" e "Ibovespa: retorno em cada ano" esticam até a altura
  do vizinho e ficam com um grande espaço vazio embaixo.
- O KPI "Juro real esperado 2027" quebra o título e o rodapé em duas linhas, desalinhando a fileira de cards.

**Sugestão:** tirar o efeito de elevação de quem não é clicável (ou fazer o KPI levar à seção correspondente);
`align-items: flex-start` nas linhas de cards ou ampliar o gráfico; encurtar o título do KPI.

### 🟡 19. "Juro neutro de referência ~5%" sem fonte

O valor de 5% está fixo (`painel.js:578`) e sustenta o KPI "3,8 p.p. acima do juro neutro", a linha tracejada
do gráfico, a classificação do simulador e a frase da trajetória. A Metodologia não diz de onde vem esse número.

**Sugestão:** levar o valor para o `manual.js` com fonte e data (por exemplo, a estimativa citada pelo Copom/BC)
e explicar na Metodologia.

### 🟡 20. "Perguntas para ler o Focus"

- *"Há quantas semanas seguidas o IPCA de 2027 vai na mesma direção?"*: o painel só tem a variação de uma
  semana, então a pessoa não consegue responder usando o próprio painel.
- As marcações somem ao recarregar a página.
- "Respondidas" é só marcar a caixa; não existe resposta nem retorno.

**Sugestão:** coletar algumas semanas do Focus (o coletor já busca 35 dias) para responder a pergunta 4;
guardar as marcações no `localStorage` por semana do Focus; ou mostrar a "resposta do painel" ao marcar.

### 🟡 21. Erros de carregamento

- Abrir o `index.html` direto do arquivo (duplo clique) falha, porque o `fetch('dados.json')` exige um servidor.
  A pessoa vê só *"Não foi possível carregar os dados do painel."*, sem explicação e sem botão de tentar de novo.
- Se uma chave faltar no JSON (por exemplo, na primeira execução com o Focus falhando, quando não há dado
  antigo para aproveitar), o `renderVals` quebra e **o painel inteiro** some, em vez de só o card afetado.
- Medianas ausentes no Focus viram `null`, e `fmt(null)` mostra **"0,00%"** como se fosse um valor real.

**Sugestão:** mensagem de erro com o visual do painel e um botão "Tentar de novo"; proteger cada bloco
(`D.focus ? … : placeholder`); mostrar "—" quando o valor for `null`.

### ⚪ 22. Manutenção e documentação

- `README.md` tem uma linha. Faltam: como rodar localmente (`python -m http.server` dentro de `site/`), como
  o site é publicado (o GitHub Pages "por branch" só serve a raiz ou `/docs`, não `/site`; não há workflow de
  deploy no repositório) e o que precisa ser atualizado à mão no `manual.js`.
- Código e dados sem uso: `MANUAL.autor.nome`, `MANUAL.autor.iniciais`, `ibovespa.var_semana` (o JS recalcula),
  `juro_real.hoje` e `por_ano[].juro_real` (o JS recalcula), a classe `.pm-note`, o id `t-elei` (sobra de
  um card "eleição"), a variável `december` (na verdade é "próximo mês") e `ibovFallTxt` (mostra alta também).
- `og:image` usa caminho relativo (`img/fundo.jpg`); redes sociais exigem URL absoluta, então a prévia do link
  fica sem imagem. Também não há favicon.
- Todo o visual está em estilos inline no `index.html` (634 linhas), o que torna qualquer ajuste de padrão
  (cores, tamanhos) trabalhoso e propenso a novas inconsistências.

---

## 4. Plano de ação sugerido

**Rápido (menos de 1 hora, muito impacto)**
1. Corrigir as datas de setembro do Copom e o texto "desde" da Metodologia (#1).
2. Cadastrar o Copom e os feriados de 2027 (#6).
3. Atualizar ou remover o card "Brasil no mundo" (#2).
4. Esconder "Leitura da semana" quando estiver vazia e ajustar o item 07 (#4).
5. Índice do medo: corrigir "0 a 100" → "0 a 50", "Diária" → "Manual" e mostrar "há X dias" (#3).
6. Fuso fixo de Brasília na hora da atualização (#13) e `prefers-reduced-motion` no JS (#14).

**Curto prazo (1 a 2 dias)**
7. Mudar o horário do robô ou filtrar o pregão do dia no Ibovespa (#7).
8. Ler `erros` e `atualizado_em` no site e mostrar selos de "dado desatualizado" (#5); fixar versões no `requirements.txt`.
9. Uma navegação só por tamanho de tela (#8).
10. Tela de nome opcional e "Cancelar" na troca (#9); alertas que fecham e marcam como lidos (#10).

**Médio prazo**
11. Guia de cores e formatos (datas, decimais) aplicado em todo o painel (#11, #12).
12. Acessibilidade dos gráficos e da agenda (#15); resiliência a dados faltando (#21).
13. README com execução local, publicação e rotina de manutenção do `manual.js` (#22); tirar estilos inline aos poucos.
