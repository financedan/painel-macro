"""
coletar.py — busca os dados do Painel Macro Brasil e salva em site/dados.json

Fontes (todas gratuitas, sem chave):
  - Banco Central, SGS ......... Selic (432), IPCA 12m (13522), IPCA do mês (433), núcleos do IPCA,
                                 CDI (12), dólar (1), TR (7811), IBC-Br (24364), desemprego (24369),
                                 dívida bruta (13762), IGP-M (189)
  - Banco Central, Olinda ...... Boletim Focus (anuais, inflação 12 meses e Selic por reunião)
  - IBGE, SIDRA ................ IPCA por grupo (tabela 7060)
  - Tesouro Transparente ....... taxas do Tesouro Direto (juro real de mercado e inflação implícita)
  - yfinance ................... Ibovespa (^BVSP), Treasury 10 anos (^TNX), T-bill 3 meses (^IRX), Brent (BZ=F)

Também gera: site/leituras.json (a partir de leituras/*.md), site/resumos.json, site/feed.xml,
site/img/og.png (prévia de link com os números do dia) e as meta tags do site/index.html.

Como rodar (com o .venv ativado):
  python coletar.py                 coleta tudo
  python coletar.py --so-leituras   só monta o leituras.json (usado na publicação do site)
"""

import csv
import io
import json
import math
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

import requests

RAIZ = Path(__file__).parent
PASTA_SAIDA = RAIZ / "site"
ARQUIVO_SAIDA = PASTA_SAIDA / "dados.json"
ARQUIVO_MANUAL = PASTA_SAIDA / "manual.json"
PASTA_LEITURAS = RAIZ / "leituras"
ARQUIVO_AVISOS = RAIZ / "avisos.txt"  # lido pelo robô para mandar mensagens (não vai para o site)
CABECALHO = {"User-Agent": "painel-macro (projeto de estudo)"}
FUSO_BRASILIA = timezone(timedelta(hours=-3))
SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados"
OLINDA = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
TESOURO_CSV = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/"
               "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")


# ---------------------------------------------------------------- utilidades
def agora_br():
    return datetime.now(FUSO_BRASILIA)


def hoje_br():
    return agora_br().date()


def baixar(url, params=None, tentativas=3, como="json"):
    """Baixa um JSON (ou texto) e tenta de novo, esperando um pouco mais a cada falha."""
    ultimo_erro = None
    for tentativa in range(tentativas):
        try:
            resposta = requests.get(url, params=params, headers=CABECALHO, timeout=90)
            if resposta.status_code != 200:
                raise RuntimeError(f"HTTP {resposta.status_code}: {resposta.text[:300]}")
            if como == "json":
                return resposta.json()
            resposta.encoding = resposta.encoding or "latin-1"
            return resposta.text
        except Exception as erro:  # rede instável, API fora do ar...
            ultimo_erro = erro
            print(f"  tentativa {tentativa + 1} falhou: {erro}")
            if tentativa < tentativas - 1:
                time.sleep(2 ** (tentativa + 1))
    raise RuntimeError(f"Não consegui baixar {url}") from ultimo_erro


def juro_real(selic, ipca):
    """Equação de Fisher: quanto a Selic rende acima da inflação."""
    return ((1 + selic / 100) / (1 + ipca / 100) - 1) * 100


def arredondar(x, casas=2):
    return None if x is None else round(float(x), casas)


def mes_txt(d):
    return d.strftime("%Y-%m")


def acumular(variacoes_pct):
    """Junta variações mensais (em %) numa variação acumulada (em %)."""
    fator = 1.0
    for v in variacoes_pct:
        fator *= 1 + v / 100
    return (fator - 1) * 100


# ---------------------------------------------------------------- Banco Central (SGS)
def serie_sgs(codigo, inicio, fim=None):
    """Série do SGS a partir de uma data, em ordem cronológica. Devolve lista de (date, valor)."""
    params = {
        "formato": "json",
        "dataInicial": inicio.strftime("%d/%m/%Y"),
        "dataFinal": (fim or hoje_br()).strftime("%d/%m/%Y"),
    }
    dados = baixar(SGS.format(codigo), params)
    pares = [(datetime.strptime(d["data"], "%d/%m/%Y").date(), float(d["valor"])) for d in dados]
    return sorted(pares)  # algumas séries (ex.: 13762) vêm em ordem decrescente


def inicio_10_anos():
    # a API só aceita janelas de até 10 anos em séries diárias
    return date(hoje_br().year - 9, 1, 1)


def coletar_selic_e_ipca():
    print("Selic e IPCA (Banco Central)...")
    inicio = inicio_10_anos()
    selic = serie_sgs(432, inicio)
    ipca = serie_sgs(13522, inicio)

    selic_hoje_data, selic_hoje = selic[-1]
    ipca_mes, ipca_hoje = ipca[-1]

    # cada mudança da meta: a nova meta vale a partir do dia seguinte à decisão do Copom
    mudancas = []
    for (dia_ant, v_ant), (dia, v) in zip(selic, selic[1:]):
        if v != v_ant:
            mudancas.append({"vigencia": dia.isoformat(), "decisao": (dia - timedelta(days=1)).isoformat(),
                             "de": v_ant, "para": v})
    ultima = mudancas[-1] if mudancas else None

    selic_fim_mes = {}
    for dia, valor in selic:
        selic_fim_mes[mes_txt(dia)] = valor

    # juro real no fim de cada ano: Selic do último dia do ano x IPCA 12m de dezembro
    selic_fim_ano = {}
    for dia, valor in selic:
        selic_fim_ano[dia.year] = valor
    ipca_dez = {mes.year: valor for mes, valor in ipca if mes.month == 12}
    ipca_dez[ipca_mes.year] = ipca_hoje  # ano atual: usa o último IPCA disponível

    por_ano = [{"ano": ano, "selic": selic_fim_ano[ano], "ipca": ipca_dez[ano]}
               for ano in sorted(selic_fim_ano) if ano in ipca_dez]

    return {
        "selic": {
            "valor": selic_hoje,
            "data": selic_hoje_data.isoformat(),
            "desde": ultima["vigencia"] if ultima else selic[0][0].isoformat(),
            "decisao": ultima["decisao"] if ultima else None,
            "anterior": ultima["de"] if ultima else None,
            "mudancas": mudancas,
            "fim_de_mes": [{"mes": m, "valor": v} for m, v in selic_fim_mes.items()],
        },
        "ipca12m": {
            "valor": ipca_hoje,
            "mes": mes_txt(ipca_mes),
            "historico": [{"mes": mes_txt(m), "valor": v} for m, v in ipca],
        },
        "juro_real": {"por_ano": por_ano},
    }


NUCLEOS = {4466: "MS", 16122: "DP", 27838: "EX2", 27839: "EX3", 28751: "P55"}


def coletar_inflacao_mensal():
    print("IPCA do mês e núcleos (Banco Central)...")
    inicio = date(hoje_br().year - 4, 1, 1)
    ipca = serie_sgs(433, inicio)
    ultimo_mes, ultimo = ipca[-1]
    no_ano = [v for d, v in ipca if d.year == ultimo_mes.year]

    # núcleos: cada um acumulado em 12 meses; o painel mostra a média deles
    acumulados = {}
    for codigo in NUCLEOS:
        serie = serie_sgs(codigo, inicio)
        for i in range(11, len(serie)):
            mes = mes_txt(serie[i][0])
            acumulados.setdefault(mes, []).append(acumular([v for _, v in serie[i - 11:i + 1]]))
    media = [{"mes": m, "valor": arredondar(sum(vs) / len(vs))}
             for m, vs in sorted(acumulados.items()) if len(vs) == len(NUCLEOS)]

    return {
        "ipca_mensal": {
            "mes": mes_txt(ultimo_mes),
            "valor": ultimo,
            "acumulado_ano": arredondar(acumular(no_ano)),
            "historico": [{"mes": mes_txt(d), "valor": v} for d, v in ipca[-36:]],
        },
        "nucleos": {"nomes": list(NUCLEOS.values()), "codigos": list(NUCLEOS), "historico": media[-36:]},
    }


GRUPOS_IPCA = {7170: "Alimentação e bebidas", 7445: "Habitação", 7486: "Artigos de residência",
               7558: "Vestuário", 7625: "Transportes", 7660: "Saúde e cuidados pessoais",
               7712: "Despesas pessoais", 7766: "Educação", 7786: "Comunicação"}


def coletar_grupos_ipca():
    print("IPCA por grupo (IBGE)...")
    codigos = ",".join(str(c) for c in GRUPOS_IPCA)
    url = f"https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63,66,2265/p/last%201/c315/{codigos}"
    linhas = baixar(url, {"formato": "json"})[1:]
    grupos, mes = {}, None
    campo = {"63": "mes", "66": "peso", "2265": "doze_meses"}
    for linha in linhas:
        if linha["V"] in ("...", "-", "X"):
            continue
        mes = linha["D3C"][:4] + "-" + linha["D3C"][4:]
        g = grupos.setdefault(int(linha["D4C"]), {"nome": GRUPOS_IPCA[int(linha["D4C"])]})
        g[campo[linha["D2C"]]] = float(linha["V"])
    itens = []
    for g in grupos.values():
        if {"mes", "peso", "doze_meses"} <= g.keys():
            g["contribuicao_mes"] = arredondar(g["mes"] * g["peso"] / 100)
            itens.append(g)
    if len(itens) != len(GRUPOS_IPCA):
        raise RuntimeError("O IBGE devolveu grupos incompletos.")
    return {"ipca_grupos": {"mes": mes, "itens": sorted(itens, key=lambda g: -g["peso"])}}


# ---------------------------------------------------------------- Boletim Focus
INDICADORES_FOCUS = ["IPCA", "Selic", "PIB Total", "Câmbio"]


def consulta_olinda(entidade, filtro, campos, topo=20000):
    # a API do BC exige espaço como %20 (o requests mandaria "+"), por isso a URL é montada à mão
    url = (OLINDA + entidade + "?$filter=" + quote(filtro, safe="'()")
           + "&$select=" + campos + "&$format=json&$top=" + str(topo))
    return baixar(url)["value"]


def semanas_fechadas(datas, hoje):
    """Último dia de coleta de cada semana já encerrada (o boletim de segunda usa a coleta até a sexta)."""
    semana_atual = hoje.isocalendar()[:2]
    ultimo = {}
    for dia in datas:
        semana = dia.isocalendar()[:2]
        if semana == semana_atual:
            continue
        if semana not in ultimo or dia > ultimo[semana]:
            ultimo[semana] = dia
    return sorted(ultimo.values())


def coletar_focus():
    """
    Medianas do Focus para este ano e os 2 seguintes, quanto mudaram na semana, a faixa
    das respostas (mínimo e máximo) e a trajetória semanal do último ano.
    """
    print("Boletim Focus (Banco Central)...")
    hoje = hoje_br()
    anos = [hoje.year, hoje.year + 1, hoje.year + 2]
    desde = (hoje - timedelta(days=372)).isoformat()

    nomes = " or ".join(f"Indicador eq '{n}'" for n in INDICADORES_FOCUS)
    refs = " or ".join(f"DataReferencia eq '{a}'" for a in anos)
    linhas = consulta_olinda(
        "ExpectativasMercadoAnuais",
        f"({nomes}) and ({refs}) and Data ge '{desde}' and baseCalculo eq 0",
        "Indicador,Data,DataReferencia,Mediana,Minimo,Maximo,numeroRespondentes",
    )
    datas = semanas_fechadas({date.fromisoformat(l["Data"]) for l in linhas}, hoje)
    if len(datas) < 2:
        raise RuntimeError("O Focus voltou com menos de 2 semanas de dados.")
    data_atual, data_anterior = datas[-1], datas[-2]
    semanais = set(d.isoformat() for d in datas)

    linha_de = {}  # (indicador, ano, data) -> linha
    for linha in linhas:
        linha_de[(linha["Indicador"], int(linha["DataReferencia"]), linha["Data"])] = linha

    def med(ind, ano, dia):
        l = linha_de.get((ind, ano, dia))
        # o boletim publica com 2 casas (5,2166 vira 5,22); a variação usa os valores já arredondados
        return arredondar(l["Mediana"]) if l else None

    tabela, historico = [], {}
    for indicador in INDICADORES_FOCUS:
        valores = []
        for ano in anos:
            atual = med(indicador, ano, data_atual.isoformat())
            anterior = med(indicador, ano, data_anterior.isoformat())
            l = linha_de.get((indicador, ano, data_atual.isoformat()), {})
            valores.append({
                "ano": ano,
                "mediana": atual,
                "variacao": arredondar(atual - anterior) if atual is not None and anterior is not None else None,
                "minimo": arredondar(l.get("Minimo")),
                "maximo": arredondar(l.get("Maximo")),
                "respondentes": l.get("numeroRespondentes"),
            })
            historico.setdefault(indicador, {})[str(ano)] = [
                {"data": d, "mediana": med(indicador, ano, d)}
                for d in sorted(semanais) if med(indicador, ano, d) is not None
            ]
        tabela.append({"indicador": indicador, "valores": valores})

    focus = {
        "coleta_ate": data_atual.isoformat(),
        "coleta_anterior": data_anterior.isoformat(),
        "anos": anos,
        "tabela": tabela,
        "historico": historico,
    }

    # inflação esperada para os próximos 12 meses (série suavizada), usada no juro real ex-ante
    try:
        l12 = consulta_olinda(
            "ExpectativasMercadoInflacao12Meses",
            f"Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '{(hoje - timedelta(days=35)).isoformat()}'",
            "Data,Mediana",
        )
        validas = [l for l in l12 if l["Data"] <= data_atual.isoformat()]
        ult = max(validas, key=lambda l: l["Data"])
        focus["ipca_12m"] = {"data": ult["Data"], "mediana": arredondar(ult["Mediana"])}
    except Exception as erro:
        print(f"  aviso: inflação 12 meses do Focus indisponível ({erro})")

    # Selic esperada reunião a reunião (R1/2027 = 1ª reunião de 2027)
    try:
        ls = consulta_olinda(
            "ExpectativasMercadoSelic",
            f"baseCalculo eq 0 and (Data eq '{data_atual.isoformat()}' or Data eq '{data_anterior.isoformat()}')",
            "Data,Reuniao,Mediana,Minimo,Maximo,numeroRespondentes",
        )
        antes = {l["Reuniao"]: arredondar(l["Mediana"]) for l in ls if l["Data"] == data_anterior.isoformat()}

        def ordem(r):
            n, a = r[1:].split("/")
            return int(a), int(n)

        reunioes = sorted((l for l in ls if l["Data"] == data_atual.isoformat()), key=lambda l: ordem(l["Reuniao"]))
        focus["reunioes"] = [{
            "reuniao": l["Reuniao"], "mediana": arredondar(l["Mediana"]),
            "anterior": antes.get(l["Reuniao"]),
            "minimo": arredondar(l["Minimo"]), "maximo": arredondar(l["Maximo"]),
            "respondentes": l["numeroRespondentes"],
        } for l in reunioes]
    except Exception as erro:
        print(f"  aviso: Selic por reunião indisponível ({erro})")

    return {"focus": focus}


# ---------------------------------------------------------------- Ibovespa e mercados (yfinance)
def historico_yf(ticker, periodo):
    import yfinance as yf

    serie = yf.Ticker(ticker).history(period=periodo, auto_adjust=False)["Close"].dropna()
    if serie.empty:
        raise RuntimeError(f"O yfinance não devolveu dados de {ticker}.")
    return [(d.date(), float(v)) for d, v in zip(serie.index, serie.values)]


def sem_pregao_em_andamento(pares, agora=None):
    """Tira a linha de hoje enquanto a bolsa está aberta: antes das 18h ela é um preço do meio do pregão."""
    agora = agora or agora_br()
    if pares and pares[-1][0] == agora.date() and agora.hour < 18:
        return pares[:-1]
    return pares


def volatilidade(fechamentos, janela=21):
    """Volatilidade realizada anualizada (em %) dos últimos `janela` pregões."""
    rets = [math.log(b / a) for a, b in zip(fechamentos, fechamentos[1:])][-janela:]
    if len(rets) < janela:
        return None
    media = sum(rets) / len(rets)
    var = sum((r - media) ** 2 for r in rets) / (len(rets) - 1)
    return math.sqrt(var) * math.sqrt(252) * 100


def coletar_ibovespa():
    print("Ibovespa (yfinance)...")
    pares = sem_pregao_em_andamento(historico_yf("^BVSP", "max"))
    datas = [d for d, _ in pares]
    fechamentos = [v for _, v in pares]

    ultimo, data_ultimo = fechamentos[-1], datas[-1]

    fim_de_ano = {}
    for d, v in pares:
        fim_de_ano[d.year] = v
    anos = sorted(a for a in fim_de_ano if a >= data_ultimo.year - 12)
    por_ano = [
        {"ano": ano, "fechamento": arredondar(fim_de_ano[ano]),
         "retorno": arredondar((fim_de_ano[ano] / fim_de_ano[ano - 1] - 1) * 100)}
        for ano in anos if ano - 1 in fim_de_ano
    ]
    fim_ano_passado = fim_de_ano.get(data_ultimo.year - 1)

    ultimo_ano = [(d, v) for d, v in pares if d >= data_ultimo - timedelta(days=365)]
    data_max, valor_max = max(ultimo_ano, key=lambda par: par[1])
    data_max_h, valor_max_h = max(pares, key=lambda par: par[1])

    vols = []
    for i in range(len(fechamentos) - 120, len(fechamentos)):
        v = volatilidade(fechamentos[:i + 1])
        if v is not None:
            vols.append({"data": datas[i].isoformat(), "valor": arredondar(v)})

    return {
        "ibovespa": {
            "fechamento": arredondar(ultimo),
            "data": data_ultimo.isoformat(),
            "var_ano": arredondar((ultimo / fim_ano_passado - 1) * 100) if fim_ano_passado else None,
            "maxima_12m": {"valor": arredondar(valor_max), "data": data_max.isoformat()},
            "maxima_historica": {"valor": arredondar(valor_max_h), "data": data_max_h.isoformat()},
            "por_ano": por_ano,
            "ultimos_dias": [{"data": d.isoformat(), "valor": arredondar(v)} for d, v in ultimo_ano[-30:]],
            "volatilidade": {"janela": 21, "atual": vols[-1]["valor"] if vols else None, "historico": vols},
        }
    }


def fim_de_mes(pares):
    saida = {}
    for d, v in pares:
        saida[mes_txt(d)] = v
    return saida


def coletar_comparacao():
    """Ibovespa x CDI em 10 anos (base 100), e o Ibovespa em dólar e descontada a inflação."""
    print("Bolsa x renda fixa (Banco Central + yfinance)...")
    inicio = inicio_10_anos()
    cdi = serie_sgs(12, inicio)  # % ao dia
    dolar = fim_de_mes(serie_sgs(1, inicio))
    ipca = {mes_txt(d): v for d, v in serie_sgs(433, inicio)}
    ibov = fim_de_mes(sem_pregao_em_andamento(historico_yf("^BVSP", "11y")))

    indice_cdi, fator = {}, 1.0
    for d, v in cdi:
        fator *= 1 + v / 100
        indice_cdi[mes_txt(d)] = fator

    meses = sorted(m for m in ibov if m in indice_cdi and m in dolar and m >= mes_txt(inicio))
    if len(meses) < 24:
        raise RuntimeError("Poucos meses em comum entre Ibovespa, CDI e dólar.")
    base = meses[0]
    indice_ipca, f = {}, 1.0
    for m in meses[1:]:
        f *= 1 + ipca.get(m, 0) / 100
        indice_ipca[m] = f
    indice_ipca[base] = 1.0

    serie = []
    for m in meses:
        serie.append({
            "mes": m,
            "ibov": arredondar(ibov[m] / ibov[base] * 100, 1),
            "cdi": arredondar(indice_cdi[m] / indice_cdi[base] * 100, 1),
            "ibov_real": arredondar(ibov[m] / ibov[base] / indice_ipca[m] * 100, 1),
            "ibov_dolar": arredondar((ibov[m] / dolar[m]) / (ibov[base] / dolar[base]) * 100, 1),
        })
    return {"comparacao": {"base": base, "serie": serie, "cdi_hoje": cdi[-1][1], "cdi_data": cdi[-1][0].isoformat()}}


def coletar_economia():
    print("Economia real (Banco Central)...")
    hoje = hoje_br()
    inicio = date(hoje.year - 4, 1, 1)

    def mensal(codigo, n=36):
        return [{"mes": mes_txt(d), "valor": v} for d, v in serie_sgs(codigo, inicio)][-n:]

    dolar_d = serie_sgs(1, hoje - timedelta(days=800))
    dolar_m = fim_de_mes(dolar_d)
    ibc = serie_sgs(24364, inicio)
    ibc_12m = [{"mes": mes_txt(ibc[i][0]),
                "valor": arredondar(sum(v for _, v in ibc[i - 11:i + 1]) / sum(v for _, v in ibc[i - 23:i - 11]) * 100 - 100)}
               for i in range(23, len(ibc))]
    igpm = serie_sgs(189, inicio)
    igpm_12m = [{"mes": mes_txt(igpm[i][0]), "valor": arredondar(acumular([v for _, v in igpm[i - 11:i + 1]]))}
                for i in range(11, len(igpm))]
    tr = serie_sgs(7811, hoje - timedelta(days=400))

    return {
        "economia": {
            "dolar": {"valor": dolar_d[-1][1], "data": dolar_d[-1][0].isoformat(),
                      "historico": [{"mes": m, "valor": v} for m, v in sorted(dolar_m.items())][-24:]},
            "ibcbr": {"historico": ibc_12m[-24:], "nota": "variação da média de 12 meses contra os 12 meses anteriores"},
            "desemprego": {"historico": mensal(24369, 24)},
            "divida": {"historico": mensal(13762, 24)},
            "igpm": {"historico": igpm_12m[-24:], "mes": mensal(189, 1)[-1]},
            "tr_mes": {"mes": mes_txt(tr[-1][0]), "valor": tr[-1][1]},
        }
    }


def coletar_mundo():
    print("Mundo (yfinance)...")
    saida = {}
    for chave, ticker in (("treasury10", "^TNX"), ("tbill3m", "^IRX"), ("brent", "BZ=F")):
        d, v = historico_yf(ticker, "10d")[-1]
        saida[chave] = {"valor": arredondar(v), "data": d.isoformat(), "ticker": ticker}
    return {"mundo": saida}


# ---------------------------------------------------------------- Tesouro Direto
def ler_tesouro(texto):
    """Lê o CSV do Tesouro Direto e devolve {data: {tipo: [(vencimento, taxa_compra)]}}."""
    por_dia = {}
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    next(leitor)
    for linha in leitor:
        if len(linha) < 4 or linha[0] not in ("Tesouro IPCA+", "Tesouro Prefixado") or not linha[3]:
            continue
        dia = datetime.strptime(linha[2], "%d/%m/%Y").date()
        venc = datetime.strptime(linha[1], "%d/%m/%Y").date()
        por_dia.setdefault(dia, {}).setdefault(linha[0], []).append((venc, float(linha[3].replace(",", "."))))
    return por_dia


def referencia_tesouro(dia, titulos, anos=5):
    """IPCA+ com vencimento mais perto de `anos` anos e o Prefixado de vencimento mais parecido."""
    if "Tesouro IPCA+" not in titulos or "Tesouro Prefixado" not in titulos:
        return None
    alvo = dia + timedelta(days=365 * anos)
    v_ipca, real = min(titulos["Tesouro IPCA+"], key=lambda t: abs((t[0] - alvo).days))
    v_pre, pre = min(titulos["Tesouro Prefixado"], key=lambda t: abs((t[0] - v_ipca).days))
    return {"data": dia.isoformat(), "real": real, "prefixado": pre,
            "implicita": arredondar(((1 + pre / 100) / (1 + real / 100) - 1) * 100),
            "venc_ipca": v_ipca.isoformat(), "venc_pre": v_pre.isoformat()}


def coletar_tesouro():
    print("Tesouro Direto (Tesouro Transparente)...")
    por_dia = ler_tesouro(baixar(TESOURO_CSV, como="texto"))
    dias = sorted(d for d in por_dia if d >= hoje_br() - timedelta(days=3 * 366))
    if not dias:
        raise RuntimeError("O CSV do Tesouro veio sem datas recentes.")
    semanal = {}
    for d in dias:
        semanal[d.isocalendar()[:2]] = d
    historico = [r for d in sorted(semanal.values()) if (r := referencia_tesouro(d, por_dia[d]))]
    atual = referencia_tesouro(dias[-1], por_dia[dias[-1]])
    if not atual:
        raise RuntimeError("Faltam títulos IPCA+ ou Prefixado no último dia do CSV.")
    return {"tesouro": {"atual": atual,
                        "historico": [{"data": r["data"], "real": r["real"], "implicita": r["implicita"]} for r in historico]}}


# ---------------------------------------------------------------- validação
def validar(dados):
    """Confere se os números fazem sentido. Devolve {chave: problema} das seções suspeitas."""
    problemas = {}

    def checar(chave, condicao, texto):
        if chave in dados and not condicao():
            problemas[chave] = texto

    hoje = hoje_br()
    checar("selic", lambda: 0 < dados["selic"]["valor"] < 40, "Selic fora de 0–40%")
    checar("ipca12m", lambda: -5 < dados["ipca12m"]["valor"] < 40 and len(dados["ipca12m"]["historico"]) >= 36,
           "IPCA fora de −5–40% ou histórico curto")
    checar("focus", lambda: len(dados["focus"]["tabela"]) == 4
           and all(v["mediana"] is not None for r in dados["focus"]["tabela"] for v in r["valores"])
           and (hoje - date.fromisoformat(dados["focus"]["coleta_ate"])).days < 21,
           "Focus incompleto ou com mais de 3 semanas")
    checar("ibovespa", lambda: dados["ibovespa"]["fechamento"] > 1000
           and len(dados["ibovespa"]["ultimos_dias"]) >= 6
           and len(dados["ibovespa"]["por_ano"]) >= 10, "Ibovespa com dados insuficientes")
    checar("comparacao", lambda: len(dados["comparacao"]["serie"]) >= 24, "Comparação curta")
    checar("tesouro", lambda: 0 < dados["tesouro"]["atual"]["real"] < 20, "Taxa real fora de 0–20%")
    checar("economia", lambda: 1 < dados["economia"]["dolar"]["valor"] < 20, "Dólar fora de R$ 1–20")
    return problemas


# ---------------------------------------------------------------- textos e arquivos derivados
NOMES_FOCUS = {"IPCA": "IPCA", "Selic": "Selic", "PIB Total": "PIB", "Câmbio": "câmbio"}


def br(v, casas=2):
    return f"{v:.{casas}f}".replace(".", ",").replace("-", "−")


def resumo_da_semana(dados):
    """Resumo automático do Focus, usado quando o autor ainda não escreveu a leitura da semana."""
    f = dados["focus"]
    mudancas = []
    for r in f["tabela"]:
        for v in r["valores"]:
            if v["variacao"]:
                unidade = "R$ " if r["indicador"] == "Câmbio" else ""
                sufixo = "" if r["indicador"] == "Câmbio" else "%"
                antes = v["mediana"] - v["variacao"]
                mudancas.append((abs(v["variacao"]), f"{NOMES_FOCUS[r['indicador']]} de {v['ano']} "
                                 f"{'subiu' if v['variacao'] > 0 else 'caiu'} de {unidade}{br(antes)}{sufixo} "
                                 f"para {unidade}{br(v['mediana'])}{sufixo}"))
    coleta = date.fromisoformat(f["coleta_ate"]).strftime("%d/%m")
    if not mudancas:
        return f"No Focus com coleta até {coleta}, as medianas ficaram iguais às da semana anterior."
    mudancas.sort(reverse=True)
    principais = [t for _, t in mudancas[:3]]
    texto = f"No Focus com coleta até {coleta}, as maiores mudanças foram: " + "; ".join(principais) + "."
    ipca = f["tabela"][0]["valores"]
    acima = [str(v["ano"]) for v in ipca if v["mediana"] > 4.5]
    if acima:
        texto += f" A inflação esperada segue acima do teto de 4,5% em {' e '.join(acima)}."
    return texto


def montar_leituras():
    """Converte leituras/AAAA-MM-DD.md em site/leituras.json (mais recente primeiro)."""
    leituras = []
    for arq in sorted(PASTA_LEITURAS.glob("*.md"), reverse=True):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", arq.stem):
            continue
        texto = arq.read_text(encoding="utf-8").strip()
        titulo = ""
        if texto.startswith("# "):
            titulo, _, texto = texto.partition("\n")
            titulo = titulo[2:].strip()
        if texto.strip():
            leituras.append({"data": arq.stem, "titulo": titulo, "texto": texto.strip()})
    (PASTA_SAIDA / "leituras.json").write_text(json.dumps(leituras, ensure_ascii=False, indent=2), encoding="utf-8")
    return leituras


def atualizar_resumos(dados):
    """Guarda o resumo automático de cada semana do Focus (para o feed RSS)."""
    arq = PASTA_SAIDA / "resumos.json"
    resumos = json.loads(arq.read_text(encoding="utf-8")) if arq.exists() else []
    if "focus" in dados and dados.get("resumo_semana"):
        coleta = dados["focus"]["coleta_ate"]
        resumos = [r for r in resumos if r["coleta"] != coleta]
        resumos.insert(0, {"coleta": coleta, "texto": dados["resumo_semana"]["texto"]})
    resumos = sorted(resumos, key=lambda r: r["coleta"], reverse=True)[:26]
    arq.write_text(json.dumps(resumos, ensure_ascii=False, indent=2), encoding="utf-8")
    return resumos


def ler_manual():
    return json.loads(ARQUIVO_MANUAL.read_text(encoding="utf-8"))


def gerar_feed(leituras, resumos, site_url):
    itens = []
    for l in leituras:
        itens.append((l["data"], l["titulo"] or "Leitura da semana", l["texto"], f"{site_url}#visao"))
    for r in resumos:
        itens.append((r["coleta"], f"Focus com coleta até {date.fromisoformat(r['coleta']).strftime('%d/%m/%Y')}",
                      r["texto"], f"{site_url}#expectativas"))
    itens.sort(reverse=True)
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0"><channel>',
           "<title>Painel Macro Brasil</title>", f"<link>{escape(site_url)}</link>",
           "<description>Juros, inflação e expectativas no Brasil, atualizados todo dia útil.</description>",
           "<language>pt-BR</language>"]
    for dia, titulo, texto, link in itens[:30]:
        quando = datetime.combine(date.fromisoformat(dia), datetime.min.time(), FUSO_BRASILIA).strftime("%a, %d %b %Y %H:%M:%S %z")
        xml += ["<item>", f"<title>{escape(titulo)}</title>", f"<link>{escape(link)}</link>",
                f"<guid isPermaLink=\"false\">{escape(dia + titulo)}</guid>", f"<pubDate>{quando}</pubDate>",
                f"<description>{escape(texto)}</description>", "</item>"]
    xml.append("</channel></rss>")
    (PASTA_SAIDA / "feed.xml").write_text("\n".join(xml), encoding="utf-8")


def frase_meta(dados):
    partes = []
    if "selic" in dados:
        partes.append(f"Selic {br(dados['selic']['valor'])}%")
    if "ipca12m" in dados:
        partes.append(f"IPCA 12 meses {br(dados['ipca12m']['valor'])}%")
    if "selic" in dados and "ipca12m" in dados:
        partes.append(f"juro real {br(juro_real(dados['selic']['valor'], dados['ipca12m']['valor']))}%")
    if "ibovespa" in dados:
        partes.append("Ibovespa " + f"{dados['ibovespa']['fechamento']:,.0f}".replace(",", ".") + " pontos")
    return " · ".join(partes)


def gerar_og(dados):
    """Imagem de prévia do link (1200x630) com os números do dia, no visual do painel."""
    try:
        from PIL import Image, ImageDraw, ImageFilter, ImageFont
    except ImportError:
        print("  aviso: Pillow não instalado, prévia do link não gerada")
        return

    def fonte(tamanho, negrito=False):
        for nome in (["DejaVuSans-Bold.ttf"] if negrito else ["DejaVuSans.ttf"]):
            for pasta in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu"):
                if Path(pasta, nome).exists():
                    return ImageFont.truetype(str(Path(pasta, nome)), tamanho)
        return ImageFont.load_default(size=tamanho)

    img = Image.open(PASTA_SAIDA / "img" / "fundo.jpg").convert("RGB")
    img = img.resize((1200, int(img.height * 1200 / img.width))).crop((0, 0, 1200, 630)).filter(ImageFilter.GaussianBlur(6))
    img = Image.blend(img, Image.new("RGB", img.size, (10, 10, 10)), 0.45)
    d = ImageDraw.Draw(img)
    d.text((64, 56), "Painel Macro Brasil", font=fonte(44, True), fill="#ededed")
    quando = agora_br().strftime("%d/%m/%Y")
    d.text((64, 116), f"Juros, inflação e expectativas · atualizado em {quando}", font=fonte(24), fill="#c2c2c2")
    cards = []
    if "selic" in dados:
        cards.append(("Selic", br(dados["selic"]["valor"]) + "%"))
    if "ipca12m" in dados:
        cards.append(("IPCA 12 meses", br(dados["ipca12m"]["valor"]) + "%"))
    if "selic" in dados and "ipca12m" in dados:
        cards.append(("Juro real", br(juro_real(dados["selic"]["valor"], dados["ipca12m"]["valor"])) + "%"))
    if "ibovespa" in dados:
        cards.append(("Ibovespa", f"{dados['ibovespa']['fechamento']:,.0f}".replace(",", ".")))
    largura = (1200 - 64 * 2 - 24 * (len(cards) - 1)) // max(1, len(cards))
    vidro = Image.new("RGBA", img.size, (0, 0, 0, 0))
    v = ImageDraw.Draw(vidro)
    for i in range(len(cards)):
        x = 64 + i * (largura + 24)
        v.rounded_rectangle((x, 330, x + largura, 550), radius=28, fill=(212, 212, 212, 34),
                            outline=(229, 229, 229, 70), width=2)
    img = Image.alpha_composite(img.convert("RGBA"), vidro).convert("RGB")
    d = ImageDraw.Draw(img)
    for i, (rotulo, valor) in enumerate(cards):
        x = 64 + i * (largura + 24)
        d.text((x + 28, 356), rotulo, font=fonte(26), fill="#c2c2c2")
        tamanho = 58
        while tamanho > 24 and d.textlength(valor, font=fonte(tamanho, True)) > largura - 56:
            tamanho -= 2
        d.text((x + 28, 420), valor, font=fonte(tamanho, True), fill="#ededed")
    img.save(PASTA_SAIDA / "img" / "og.png", optimize=True)


def atualizar_meta_html(dados, site_url):
    """Reescreve as meta tags entre <!-- meta:inicio --> e <!-- meta:fim --> com os números do dia."""
    arq = PASTA_SAIDA / "index.html"
    html = arq.read_text(encoding="utf-8")
    frase = escape(frase_meta(dados), {'"': "&quot;"})
    bloco = "\n".join([
        "<!-- meta:inicio (gerado pelo coletar.py) -->",
        f'<meta name="description" content="{frase}. Dados do Banco Central, IBGE e B3, atualizados todo dia útil.">',
        '<meta property="og:title" content="Painel Macro Brasil">',
        f'<meta property="og:description" content="{frase}.">',
        f'<meta property="og:image" content="{site_url}img/og.png">',
        f'<meta property="og:url" content="{site_url}">',
        '<meta name="twitter:card" content="summary_large_image">',
        "<!-- meta:fim -->",
    ])
    novo, n = re.subn(r"<!-- meta:inicio.*?<!-- meta:fim -->", bloco, html, flags=re.S)
    if n:
        arq.write_text(novo, encoding="utf-8")


def avisos_para_robo(antigo, dados):
    """Novidades que valem uma mensagem (Telegram), comparando com a coleta anterior."""
    avisos = []
    if "selic" in dados and antigo.get("selic") and dados["selic"]["valor"] != antigo["selic"]["valor"]:
        avisos.append(f"Selic mudou: {br(antigo['selic']['valor'])}% → {br(dados['selic']['valor'])}%.")
    if "focus" in dados and antigo.get("focus") and dados["focus"]["coleta_ate"] != antigo["focus"]["coleta_ate"]:
        avisos.append("Novo Boletim Focus. " + resumo_da_semana(dados))
    if "ipca12m" in dados and antigo.get("ipca12m") and dados["ipca12m"]["mes"] != antigo["ipca12m"]["mes"]:
        avisos.append(f"IPCA de 12 meses até {dados['ipca12m']['mes']}: {br(dados['ipca12m']['valor'])}%.")
    return avisos


# ---------------------------------------------------------------- principal
COLETORES = [
    (coletar_selic_e_ipca, ["selic", "ipca12m", "juro_real"]),
    (coletar_inflacao_mensal, ["ipca_mensal", "nucleos"]),
    (coletar_grupos_ipca, ["ipca_grupos"]),
    (coletar_focus, ["focus"]),
    (coletar_ibovespa, ["ibovespa"]),
    (coletar_comparacao, ["comparacao"]),
    (coletar_economia, ["economia"]),
    (coletar_mundo, ["mundo"]),
    (coletar_tesouro, ["tesouro"]),
]


def main():
    if "--so-leituras" in sys.argv:
        print(f"{len(montar_leituras())} leitura(s) em site/leituras.json")
        return

    agora = agora_br().isoformat(timespec="minutes")
    antigo = json.loads(ARQUIVO_SAIDA.read_text(encoding="utf-8")) if ARQUIVO_SAIDA.exists() else {}
    fontes_antigas = antigo.get("fontes", {})
    dados = {"atualizado_em": agora}
    erros, fontes = [], {}

    for coletar, chaves in COLETORES:
        nome = coletar.__name__.replace("coletar_", "")
        try:
            novo = coletar()
            problemas = validar(novo)
            if problemas:
                raise RuntimeError("; ".join(problemas.values()))
            dados.update(novo)
            fontes[nome] = {"ok": True, "atualizado_em": agora}
        except Exception as erro:
            erros.append(f"{nome}: {erro}")
            print(f"  ERRO em {nome}: {erro}")
            # mantém o dado antigo dessa fonte em vez de apagar do site
            for chave in chaves:
                if chave in antigo:
                    dados[chave] = antigo[chave]
            fontes[nome] = {"ok": False, "atualizado_em": fontes_antigas.get(nome, {}).get("atualizado_em"),
                            "erro": str(erro)[:200]}

    if "focus" in dados:
        dados["resumo_semana"] = {"coleta": dados["focus"]["coleta_ate"], "texto": resumo_da_semana(dados)}
    dados["fontes"] = fontes
    dados["erros"] = erros

    PASTA_SAIDA.mkdir(exist_ok=True)
    ARQUIVO_SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")

    manual = ler_manual()
    site_url = manual.get("site_url", "")
    leituras = montar_leituras()
    gerar_feed(leituras, atualizar_resumos(dados), site_url)
    try:
        gerar_og(dados)
        atualizar_meta_html(dados, site_url)
    except Exception as erro:
        print(f"  aviso: prévia do link não gerada ({erro})")
    ARQUIVO_AVISOS.write_text("\n".join(avisos_para_robo(antigo, dados)), encoding="utf-8")

    print("\nResumo:")
    print("  " + frase_meta(dados))
    if "focus" in dados:
        print(f"  Focus com coleta até {dados['focus']['coleta_ate']}")
    for nome, f in fontes.items():
        print(f"  {'ok ' if f['ok'] else 'ERRO'} {nome}")
    print(f"\nSalvo em {ARQUIVO_SAIDA}")
    if erros:
        raise SystemExit("Terminou com erros: " + " | ".join(erros))


if __name__ == "__main__":
    main()
