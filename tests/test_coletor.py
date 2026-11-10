"""Testes do coletor e do manual.json. Rodar: python -m pytest -q"""

import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

import coletar  # noqa: E402


def test_fisher():
    assert round(coletar.juro_real(13.75, 4.58), 2) == 8.77
    assert coletar.juro_real(5, 5) == 0


def test_acumular():
    assert round(coletar.acumular([1, 1]), 4) == 2.01


def test_semanas_fechadas_ignora_semana_atual():
    hoje = date(2026, 11, 7)  # sábado
    datas = [date(2026, 10, 29), date(2026, 10, 30), date(2026, 11, 5), date(2026, 11, 6), date(2026, 10, 23)]
    assert coletar.semanas_fechadas(datas, hoje) == [date(2026, 10, 23), date(2026, 10, 30)]


def test_sem_pregao_em_andamento():
    pares = [(date(2026, 11, 5), 1.0), (date(2026, 11, 6), 2.0)]
    durante = datetime(2026, 11, 6, 11, 0, tzinfo=coletar.FUSO_BRASILIA)
    depois = datetime(2026, 11, 6, 19, 0, tzinfo=coletar.FUSO_BRASILIA)
    assert coletar.sem_pregao_em_andamento(pares, durante) == pares[:1]
    assert coletar.sem_pregao_em_andamento(pares, depois) == pares


def test_volatilidade():
    assert coletar.volatilidade([100.0] * 30) == 0
    assert coletar.volatilidade([100.0] * 5) is None
    v = coletar.volatilidade([100 * (1.01 if i % 2 else 0.99) for i in range(30)])
    assert 20 < v < 40


def test_tesouro_referencia():
    texto = ("Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n"
             "Tesouro IPCA+;15/08/2032;06/11/2026;7,86;7,98;1;1;1\n"
             "Tesouro IPCA+;15/05/2045;06/11/2026;7,43;7,55;1;1;1\n"
             "Tesouro Prefixado;01/01/2032;06/11/2026;15,17;15,29;1;1;1\n"
             "Tesouro Prefixado;01/01/2027;06/11/2026;13,59;13,71;1;1;1\n"
             "Tesouro Selic;01/03/2027;06/11/2026;0,02;0,03;1;1;1\n")
    por_dia = coletar.ler_tesouro(texto)
    ref = coletar.referencia_tesouro(date(2026, 11, 6), por_dia[date(2026, 11, 6)])
    assert ref["venc_ipca"] == "2032-08-15" and ref["venc_pre"] == "2032-01-01"
    assert ref["implicita"] == round(((1.1517 / 1.0786) - 1) * 100, 2)


def test_validar_aponta_dado_absurdo():
    assert "selic" in coletar.validar({"selic": {"valor": 99}})
    assert coletar.validar({"selic": {"valor": 13.75}}) == {}


def test_resumo_da_semana():
    dados = {"focus": {"coleta_ate": "2026-10-30", "tabela": [
        {"indicador": "IPCA", "valores": [{"ano": 2026, "mediana": 5.22, "variacao": 0.03}, {"ano": 2027, "mediana": 4.76, "variacao": 0.42}]},
        {"indicador": "Câmbio", "valores": [{"ano": 2026, "mediana": 5.34, "variacao": 0.29}]},
    ]}}
    texto = coletar.resumo_da_semana(dados)
    assert "IPCA de 2027 subiu de 4,34% para 4,76%" in texto
    assert "R$ 5,05 para R$ 5,34" in texto
    assert "acima do teto" in texto


def test_montar_leituras(tmp_path, monkeypatch):
    (tmp_path / "leituras").mkdir()
    (tmp_path / "site").mkdir()
    (tmp_path / "leituras" / "2026-11-09.md").write_text("# Título\n\nTexto **forte**.", encoding="utf-8")
    (tmp_path / "leituras" / "LEIA-ME.md").write_text("ignorado", encoding="utf-8")
    monkeypatch.setattr(coletar, "PASTA_LEITURAS", tmp_path / "leituras")
    monkeypatch.setattr(coletar, "PASTA_SAIDA", tmp_path / "site")
    leituras = coletar.montar_leituras()
    assert leituras == [{"data": "2026-11-09", "titulo": "Título", "texto": "Texto **forte**."}]


# ---------------------------------------------------------------- fontes
def test_nucleos_sao_os_da_media_do_bc():
    # RPM set/2026, p. 36: "A média considera os núcleos EX0, EX3, MS, DP e P55";
    # códigos da Tabela 11 da Nota Técnica BCB nº 57
    assert coletar.NUCLEOS == {11427: "EX0", 27839: "EX3", 4466: "MS", 16122: "DP", 28750: "P55"}


def test_coletor_nao_usa_fontes_nao_oficiais():
    codigo = (RAIZ / "coletar.py").read_text(encoding="utf-8")
    assert "yfinance" not in codigo and "yahoo" not in codigo.lower()


def test_serie_fred_usa_a_api_com_chave(monkeypatch):
    class Resp:
        status_code = 200
        def json(self):
            return {"observations": [{"date": "2026-11-04", "value": "3.88"}, {"date": "2026-11-05", "value": "."}]}
    pedidos = []
    monkeypatch.setenv("FRED_API_KEY", "chave-teste")
    monkeypatch.setattr(coletar.requests, "get", lambda url, params=None, **k: pedidos.append((url, params)) or Resp())
    monkeypatch.setattr(coletar, "baixar", lambda *a, **k: (_ for _ in ()).throw(AssertionError("não devia usar o CSV")))
    assert coletar.serie_fred("DFF", date(2026, 11, 1)) == [(date(2026, 11, 4), 3.88)]
    assert pedidos[0][0] == coletar.FRED_API and pedidos[0][1]["series_id"] == "DFF"


def test_serie_fred_cai_para_o_csv_sem_vazar_a_chave(monkeypatch, capsys):
    def falha(*a, **k):
        raise coletar.requests.ConnectionError("https://api.stlouisfed.org/?api_key=chave-secreta")
    monkeypatch.setenv("FRED_API_KEY", "chave-secreta")
    monkeypatch.setattr(coletar.requests, "get", falha)
    monkeypatch.setattr(coletar.time, "sleep", lambda s: None)
    monkeypatch.setattr(coletar, "baixar", lambda *a, **k: "observation_date,DFF\n2026-11-04,3.88\n")
    assert coletar.serie_fred("DFF", date(2026, 11, 1)) == [(date(2026, 11, 4), 3.88)]
    assert "chave-secreta" not in capsys.readouterr().out


def test_serie_fred_le_csv(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    monkeypatch.setattr(coletar, "baixar", lambda *a, **k: "observation_date,DFF\n2026-11-04,3.88\n2026-11-05,.\n")
    assert coletar.serie_fred("DFF", date(2026, 11, 1)) == [(date(2026, 11, 4), 3.88)]


def test_ibovespa_b3_le_tabela(monkeypatch):
    resposta = {"results": [{"day": 5, "rateValue1": "160.000,50", "rateValue2": None, "rateValue11": "166.192,10"},
                            {"day": 31, "rateValue2": "1,00"}]}  # 31/02 não existe e é ignorado
    monkeypatch.setattr(coletar, "baixar", lambda *a, **k: resposta)
    monkeypatch.setattr(coletar, "hoje_br", lambda: date(2026, 11, 7))
    coletar._CACHE_B3.clear()
    pares = coletar.ibovespa_b3(2026)
    assert pares == [(date(2026, 1, 5), 160000.5), (date(2026, 11, 5), 166192.1)]
    coletar._CACHE_B3.clear()


# ---------------------------------------------------------------- manual.json
MANUAL = json.loads((RAIZ / "site" / "manual.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("reuniao", MANUAL["copom"], ids=lambda r: r["decisao"])
def test_copom_decide_na_quarta(reuniao):
    decisao, inicio = date.fromisoformat(reuniao["decisao"]), date.fromisoformat(reuniao["inicio"])
    assert decisao.weekday() == 2, "a decisão do Copom sai numa quarta-feira"
    assert decisao - inicio == timedelta(days=1)


def test_datas_do_manual_sao_validas():
    for f in MANUAL["feriados"]:
        date.fromisoformat(f["data"])
    assert 0 < MANUAL["neutro"]["valor"] < 15
    date.fromisoformat(MANUAL["ranking_mundo"]["publicado_em"])


def test_todo_dado_manual_tem_fonte_com_link():
    fontes = [MANUAL["copom_fonte"], MANUAL["feriados_fonte"], MANUAL["neutro"]["fonte"], MANUAL["ranking_mundo"]["fonte"]]
    for f in fontes:
        assert f["texto"] and f["url"].startswith("https://"), f
        date.fromisoformat(f["conferido_em"])
    for ev in MANUAL["eventos"]:
        assert ev.get("fonte", "").startswith("https://"), f"evento sem fonte: {ev}"


def test_feriados_de_ano_sem_calendario_oficial_estao_marcados_como_previstos():
    for f in MANUAL["feriados"]:
        if f["data"] >= "2027-01-01":
            assert f.get("previsto"), f"{f['data']} precisa de \"previsto\": true até a B3 publicar o calendário"


def test_calendario_do_copom_nao_esta_acabando():
    """Só avisa (não falha): o calendário do ano seguinte precisa ser cadastrado à mão."""
    ultima = max(date.fromisoformat(r["decisao"]) for r in MANUAL["copom"])
    if (ultima - date.today()).days < 60:
        pytest.skip(f"AVISO: o calendário do Copom em site/manual.json termina em {ultima:%d/%m/%Y}. Cadastre as próximas reuniões.")
