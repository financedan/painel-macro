"""
coletar.py — busca os dados do Painel Macro Brasil e salva em site/dados.json

Fontes:
  - Selic meta ............ Banco Central, SGS série 432
  - IPCA em 12 meses ...... Banco Central, SGS série 13522
  - Boletim Focus ......... Banco Central, API de Expectativas (Olinda)
  - Ibovespa .............. yfinance, ticker ^BVSP

Como rodar (com o .venv ativado):  python coletar.py
"""

import json
from urllib.parse import quote
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
import yfinance as yf

PASTA_SAIDA = Path(__file__).parent / "site"
ARQUIVO_SAIDA = PASTA_SAIDA / "dados.json"
CABECALHO = {"User-Agent": "painel-macro (projeto de estudo)"}
FUSO_BRASILIA = timezone(timedelta(hours=-3))


# ---------------------------------------------------------------- utilidades
def baixar_json(url, params=None):
    """Baixa um JSON e tenta de novo até 3 vezes se a API falhar."""
    ultimo_erro = None
    for tentativa in range(3):
        try:
            resposta = requests.get(url, params=params, headers=CABECALHO, timeout=60)
            if resposta.status_code != 200:
                # mostra o que a API respondeu, para facilitar achar o problema
                raise RuntimeError(f"HTTP {resposta.status_code}: {resposta.text[:300]}")
            return resposta.json()
        except Exception as erro:  # rede instável, API fora do ar...
            ultimo_erro = erro
            print(f"  tentativa {tentativa + 1} falhou: {erro}")
    raise RuntimeError(f"Não consegui baixar {url}") from ultimo_erro


def juro_real(selic, ipca):
    """Equação de Fisher: quanto a Selic rende acima da inflação."""
    return ((1 + selic / 100) / (1 + ipca / 100) - 1) * 100


def arredondar(x, casas=2):
    return round(float(x), casas)


# ---------------------------------------------------------------- Banco Central (SGS)
def serie_sgs(codigo, inicio):
    """Série do SGS a partir de uma data. Devolve lista de (date, valor)."""
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"
    params = {
        "formato": "json",
        "dataInicial": inicio.strftime("%d/%m/%Y"),
        "dataFinal": date.today().strftime("%d/%m/%Y"),
    }
    dados = baixar_json(url, params)
    return [(datetime.strptime(d["data"], "%d/%m/%Y").date(), float(d["valor"])) for d in dados]


def coletar_selic_e_ipca():
    print("Selic e IPCA (Banco Central)...")
    # a API só aceita janelas de até 10 anos em séries diárias
    inicio = date(date.today().year - 9, 1, 1)
    selic = serie_sgs(432, inicio)
    ipca = serie_sgs(13522, inicio)

    selic_hoje_data, selic_hoje = selic[-1]
    ipca_mes, ipca_hoje = ipca[-1]

    # juro real no fim de cada ano: Selic do último dia do ano x IPCA 12m de dezembro
    selic_fim_ano = {}
    for dia, valor in selic:
        selic_fim_ano[dia.year] = valor  # fica com o último valor de cada ano
    ipca_dez = {mes.year: valor for mes, valor in ipca if mes.month == 12}
    ipca_dez[ipca_mes.year] = ipca_hoje  # ano atual: usa o último IPCA disponível

    por_ano = []
    for ano in sorted(selic_fim_ano):
        if ano in ipca_dez:
            por_ano.append({
                "ano": ano,
                "selic": selic_fim_ano[ano],
                "ipca": ipca_dez[ano],
                "juro_real": arredondar(juro_real(selic_fim_ano[ano], ipca_dez[ano])),
            })

    return {
        "selic": {"valor": selic_hoje, "data": selic_hoje_data.isoformat()},
        "ipca12m": {
            "valor": ipca_hoje,
            "mes": ipca_mes.strftime("%Y-%m"),
            "historico": [{"mes": m.strftime("%Y-%m"), "valor": v} for m, v in ipca],
        },
        "juro_real": {"hoje": arredondar(juro_real(selic_hoje, ipca_hoje)), "por_ano": por_ano},
    }


# ---------------------------------------------------------------- Boletim Focus
INDICADORES_FOCUS = ["IPCA", "Selic", "PIB Total", "Câmbio"]


def coletar_focus():
    """
    Medianas do Focus para este ano e os 2 seguintes, e quanto mudaram na semana.
    O boletim de segunda-feira usa a coleta até a sexta anterior, então pegamos
    o último dia de cada semana já fechada.
    """
    print("Boletim Focus (Banco Central)...")
    hoje = date.today()
    anos = [hoje.year, hoje.year + 1, hoje.year + 2]
    desde = (hoje - timedelta(days=35)).isoformat()

    url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
    nomes = " or ".join(f"Indicador eq '{n}'" for n in INDICADORES_FOCUS)
    filtro = f"({nomes}) and Data ge '{desde}' and baseCalculo eq 0"
    # a API do BC exige espaço como %20 (o requests mandaria "+"), por isso a URL é montada à mão
    url += (
        "?$filter=" + quote(filtro, safe="'()")
        + "&$select=Indicador,Data,DataReferencia,Mediana"
        + "&$format=json&$top=5000"
    )
    linhas = baixar_json(url)["value"]

    # agrupa por semana e fica com o último dia de cada semana já encerrada
    semana_atual = hoje.isocalendar()[:2]
    ultimo_dia_da_semana = {}
    for linha in linhas:
        dia = date.fromisoformat(linha["Data"])
        semana = dia.isocalendar()[:2]
        if semana == semana_atual:
            continue
        if semana not in ultimo_dia_da_semana or dia > ultimo_dia_da_semana[semana]:
            ultimo_dia_da_semana[semana] = dia
    datas = sorted(ultimo_dia_da_semana.values())
    if len(datas) < 2:
        raise RuntimeError("O Focus voltou com menos de 2 semanas de dados.")
    data_atual, data_anterior = datas[-1], datas[-2]

    mediana = {}  # (indicador, ano, data) -> valor
    for linha in linhas:
        # o boletim publica com 2 casas (5,2166 vira 5,22); a variação usa os valores já arredondados
        mediana[(linha["Indicador"], int(linha["DataReferencia"]), linha["Data"])] = arredondar(linha["Mediana"])

    tabela = []
    for indicador in INDICADORES_FOCUS:
        valores = []
        for ano in anos:
            atual = mediana.get((indicador, ano, data_atual.isoformat()))
            anterior = mediana.get((indicador, ano, data_anterior.isoformat()))
            valores.append({
                "ano": ano,
                "mediana": atual,
                "variacao": arredondar(atual - anterior) if atual is not None and anterior is not None else None,
            })
        tabela.append({"indicador": indicador, "valores": valores})

    return {
        "focus": {
            "coleta_ate": data_atual.isoformat(),
            "coleta_anterior": data_anterior.isoformat(),
            "anos": anos,
            "tabela": tabela,
        }
    }


# ---------------------------------------------------------------- Ibovespa
def coletar_ibovespa():
    print("Ibovespa (yfinance)...")
    historico = yf.Ticker("^BVSP").history(period="12y", auto_adjust=False)["Close"].dropna()
    if historico.empty:
        raise RuntimeError("O yfinance não devolveu dados do Ibovespa.")
    datas = [d.date() for d in historico.index]
    fechamentos = [float(v) for v in historico.values]

    ultimo, data_ultimo = fechamentos[-1], datas[-1]
    ha_5_pregoes = fechamentos[-6] if len(fechamentos) > 5 else fechamentos[0]

    fim_de_ano = {}
    for d, v in zip(datas, fechamentos):
        fim_de_ano[d.year] = v
    anos = sorted(fim_de_ano)
    por_ano = [
        {"ano": ano, "fechamento": arredondar(fim_de_ano[ano]),
         "retorno": arredondar((fim_de_ano[ano] / fim_de_ano[ano - 1] - 1) * 100)}
        for ano in anos[1:]
    ]
    fim_ano_passado = fim_de_ano.get(data_ultimo.year - 1)

    ultimo_ano = [(d, v) for d, v in zip(datas, fechamentos) if d >= data_ultimo - timedelta(days=365)]
    data_max, valor_max = max(ultimo_ano, key=lambda par: par[1])

    return {
        "ibovespa": {
            "fechamento": arredondar(ultimo),
            "data": data_ultimo.isoformat(),
            "var_semana": arredondar((ultimo / ha_5_pregoes - 1) * 100),
            "var_ano": arredondar((ultimo / fim_ano_passado - 1) * 100) if fim_ano_passado else None,
            "maxima_12m": {"valor": arredondar(valor_max), "data": data_max.isoformat()},
            "por_ano": por_ano,
            "ultimos_dias": [{"data": d.isoformat(), "valor": arredondar(v)} for d, v in ultimo_ano[-30:]],
        }
    }


# ---------------------------------------------------------------- principal
def main():
    dados = {"atualizado_em": datetime.now(FUSO_BRASILIA).isoformat(timespec="minutes")}
    erros = []
    for coletar in (coletar_selic_e_ipca, coletar_focus, coletar_ibovespa):
        try:
            dados.update(coletar())
        except Exception as erro:
            erros.append(f"{coletar.__name__}: {erro}")
            print(f"  ERRO em {coletar.__name__}: {erro}")

    # se uma fonte falhar, mantém o dado antigo dela em vez de apagar do site
    if erros and ARQUIVO_SAIDA.exists():
        antigo = json.loads(ARQUIVO_SAIDA.read_text(encoding="utf-8"))
        for chave, valor in antigo.items():
            dados.setdefault(chave, valor)
    dados["erros"] = erros

    PASTA_SAIDA.mkdir(exist_ok=True)
    ARQUIVO_SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nResumo:")
    if "selic" in dados:
        print(f"  Selic ........ {dados['selic']['valor']}% ({dados['selic']['data']})")
        print(f"  IPCA 12m ..... {dados['ipca12m']['valor']}% ({dados['ipca12m']['mes']})")
        print(f"  Juro real .... {dados['juro_real']['hoje']}%")
    if "focus" in dados:
        ipca_focus = dados["focus"]["tabela"][0]["valores"][0]
        print(f"  Focus ........ coleta até {dados['focus']['coleta_ate']} | IPCA {ipca_focus['ano']}: {ipca_focus['mediana']}%")
    if "ibovespa" in dados:
        print(f"  Ibovespa ..... {dados['ibovespa']['fechamento']} pontos ({dados['ibovespa']['data']})")
    print(f"\nSalvo em {ARQUIVO_SAIDA}")
    if erros:
        raise SystemExit("Terminou com erros: " + " | ".join(erros))


if __name__ == "__main__":
    main()
