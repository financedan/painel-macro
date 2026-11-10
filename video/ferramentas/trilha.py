"""
trilha.py — trilha instrumental da apresentação (85 s), sintetizada do zero (sem samples).

Versão com mais energia, sincronizada com o roteiro (site/apresentacao/apresentacao.js):
  0–10 s    introdução: pad, arpejo crescendo, toques nos números, subida até o painel
  10 s      o painel: entra a batida (120 bpm), baixo pulsando, chimbal
  25–50 s   indicadores: palmas no 2 e no 4, arpejo de "dados", impacto em cada número de impacto
  50–70 s   interatividade: batida continua, cliques nos mesmos instantes do cursor
  70–81 s   encerramento: a batida sai, pad e pulso suave; subida até a marca
  80,9 s    impacto na marca e acorde final
Em cada varredura de vidro entre cenas, um "swoosh" de ruído filtrado.

Rodar: python video/ferramentas/trilha.py   (gera video/saida/trilha.wav; o MP3 do site sai do montar.sh)
"""

import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 85.0
BPM = 120
B = 60 / BPM                      # 0,5 s por batida
CAPITULOS = [10.0, 25.0, 50.0, 70.0]
SLAMS = [25.0, 31.6, 37.6, 43.6, 47.2]
VARREDURAS = [20.15, 24.95, 31.55, 37.55, 43.55, 47.15, 49.95, 54.15, 58.35, 61.95, 66.15]
TOQUES = [0.9, 1.25, 1.6, 5.9]
CLIQUES = [51.75, 55.55, 57.6, 59.8, 63.4, 65.1, 67.2]
MARCA = 80.9
SAIDA = Path(__file__).resolve().parents[1] / "saida" / "trilha.wav"

rng = np.random.default_rng(11)
n = int(SR * DUR)
t = np.arange(n) / SR
L = np.zeros(n)
R = np.zeros(n)


def nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def suavizar(x, corte):
    """Passa-baixa de um polo."""
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def envelope(m, ataque, soltura):
    e = np.ones(m)
    a = min(int(ataque * SR), m // 2)
    s = min(int(soltura * SR), m // 2)
    if a:
        e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if s:
        e[-s:] *= np.cos(np.linspace(0, np.pi / 2, s)) ** 2
    return e


def somar(ini, sl, sr=None):
    i0 = int(ini * SR)
    if i0 >= n or i0 < 0:
        return
    m = min(len(sl), n - i0)
    L[i0:i0 + m] += sl[:m]
    R[i0:i0 + m] += (sr if sr is not None else sl)[:m]


def curva(pontos):
    xs, ys = zip(*pontos)
    return lambda x: float(np.interp(x, xs, ys))


# acordes de 2 compassos (4 s): Am9 · Fmaj7 · Cmaj7 · G6
ACORDES = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 67]]
SEG = 8 * B


def acorde_em(x):
    if x >= MARCA - 0.05:
        return ACORDES[0]
    return ACORDES[int(x // SEG) % len(ACORDES)]


# ---------- pad (macio, aberto)
ini = 0.0
while ini < DUR:
    ac = acorde_em(ini + 0.01)
    dur = min(SEG + 1.2, DUR - ini)
    m = int(dur * SR)
    tt = np.arange(m) / SR
    pl, pr = np.zeros(m), np.zeros(m)
    for f0 in map(nota, ac):
        for h in range(1, 5):
            amp = 1 / h ** 1.7
            fase = rng.uniform(0, 2 * np.pi)
            pl += amp * np.sin(2 * np.pi * f0 * h * 0.9985 * tt + fase)
            pr += amp * np.sin(2 * np.pi * f0 * h * 1.0015 * tt + fase + 0.4)
    env = envelope(m, 0.9, 1.2) * 0.022
    somar(ini, pl * env, pr * env)
    ini += SEG
pad_vol = curva([(0, 0), (2.5, 0.8), (9.6, 0.9), (10, 0.6), (69.5, 0.6), (70.5, 1.0), (80.8, 1.0), (81.2, 1.2), (DUR, 0.0)])
gv = np.array([pad_vol(x) for x in t[::480]])
gv = np.interp(t, t[::480], gv)
L *= gv
R *= gv

# ---------- bateria
kick_vol = curva([(0, 0), (9.99, 0), (10, 1), (69.9, 1), (70, 0), (DUR, 0)])
hat_vol = curva([(0, 0), (9.99, 0), (10, 0.7), (24.9, 0.7), (25, 1), (69.9, 1), (70, 0), (DUR, 0)])
clap_vol = curva([(0, 0), (24.99, 0), (25, 1), (69.9, 1), (70, 0), (DUR, 0)])

m = int(0.42 * SR)
tt = np.arange(m) / SR
KICK = np.sin(2 * np.pi * (48 * tt + 110 * (1 - np.exp(-tt * 28)) / 28)) * np.exp(-tt * 9) * 0.42
KICK += np.exp(-tt * 400) * 0.08 * rng.standard_normal(m)  # clique de ataque
m = int(0.05 * SR)
HAT = rng.standard_normal(m)
HAT = (HAT - suavizar(HAT, 6000)) * np.exp(-np.arange(m) / SR * 90) * 0.06
m = int(0.22 * SR)
tt = np.arange(m) / SR
ruido = rng.standard_normal(m)
CLAP = (ruido - suavizar(ruido, 900)) * (np.exp(-tt * 22) + 0.6 * np.exp(-((tt - 0.012) * 200) ** 2)) * 0.11

b = 10.0
i = 0
while b < 70:
    somar(b, KICK * kick_vol(b))
    if i % 2 == 1:
        somar(b, CLAP * clap_vol(b) * 0.9, CLAP * clap_vol(b))
    somar(b + B / 2, HAT * hat_vol(b) * 0.8, HAT * hat_vol(b))
    if 25 <= b < 70:
        somar(b + B / 4, HAT * 0.35 * hat_vol(b), HAT * 0.25 * hat_vol(b))
        somar(b + 3 * B / 4, HAT * 0.25 * hat_vol(b), HAT * 0.35 * hat_vol(b))
    b += B
    i += 1

# ---------- baixo: colcheias na fundamental, com envelope curto
baixo_vol = curva([(0, 0), (9.99, 0), (10, 0.9), (69.9, 0.9), (70, 0.35), (80.8, 0.35), (80.9, 1.0), (DUR, 0)])
b = 10.0
while b < 84:
    ac = acorde_em(b)
    f = nota(ac[0] - 24)
    m = int(0.24 * SR)
    tt = np.arange(m) / SR
    onda = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) + 0.12 * np.sin(2 * np.pi * 3 * f * tt)
    v = baixo_vol(b) * (0.6 if b >= 70 and b < 80.9 else 1)
    somar(b, onda * np.exp(-tt * 9) * 0.085 * v)
    b += B / 2 if b < 70 or b >= 80.9 else B

# ---------- arpejo de "dados" (semicolcheias nas notas do acorde, oitava acima)
arp_vol = curva([(0, 0), (1.0, 0), (9.5, 0.9), (10, 0.5), (24.9, 0.5), (25, 0.9), (69.8, 0.9), (70, 0.25), (80.8, 0.25), (81, 0), (DUR, 0)])
b = 1.0
i = 0
while b < 81:
    ac = acorde_em(b)
    f = nota(ac[[0, 2, 4, 1, 3, 2][i % 6]] + 12)
    m = int(0.16 * SR)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 26) * 0.045 * arp_vol(b)
    pan = 0.5 + 0.4 * np.sin(i * 0.9)
    somar(b, s * (1 - pan) * 2, s * pan * 2)
    b += B / 4
    i += 1

# ---------- subidas (ruído filtrado crescendo) antes dos capítulos e da marca
for alvo, dur in [(10.0, 2.5), (25.0, 1.5), (50.0, 1.5), (70.0, 1.2), (MARCA, 2.1)]:
    m = int(dur * SR)
    r = rng.standard_normal(m)
    corte_baixo = suavizar(r, 400)
    s = (r - corte_baixo) * np.linspace(0, 1, m) ** 2.4
    s *= 0.05
    somar(alvo - dur, s * 0.9, s)

# ---------- impactos: capítulos, números de impacto, toques da abertura e a marca
def impacto(x, forca):
    m = int(1.6 * SR)
    tt = np.arange(m) / SR
    boom = np.sin(2 * np.pi * (nota(33) * (1 + 0.8 * np.exp(-tt * 10))) * tt) * np.exp(-tt * 3.0)
    r = rng.standard_normal(m)
    ar = (r - suavizar(r, 700)) * np.exp(-tt * 9) * 0.25
    s = (boom * 0.34 + ar) * forca
    somar(x, s, s * 0.97)


for c in CAPITULOS:
    impacto(c, 0.8)
for s_ in SLAMS:
    impacto(s_, 0.75)
for x in TOQUES:
    impacto(x, 0.35)
impacto(MARCA, 1.0)

# ---------- swoosh em cada varredura de vidro
for x in VARREDURAS:
    m = int(0.62 * SR)
    tt = np.arange(m) / SR
    r = rng.standard_normal(m)
    s = (r - suavizar(r, 1200)) * np.sin(np.pi * tt / tt[-1]) ** 2 * 0.07
    pan = np.linspace(0.1, 0.9, m)  # acompanha a varredura da esquerda para a direita
    somar(x, s * (1 - pan) * 2, s * pan * 2)

# ---------- cliques de interface (mesmos instantes do cursor)
for c in CLIQUES:
    m = int(0.06 * SR)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * 2400 * tt) * 0.6 + rng.standard_normal(m) * 0.3) * np.exp(-tt * 140) * 0.13
    somar(c, s)

# ---------- brilho agudo na abertura e no fim
for a0, a1 in ((0.4, 9.8), (80.9, 84.8)):
    m = int((a1 - a0) * SR)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * nota(88) * tt) + 0.6 * np.sin(2 * np.pi * nota(95) * tt)) * envelope(m, 1.5, 2.5) * 0.006
    somar(a0, s * np.sin(2 * np.pi * 0.3 * tt) ** 2, s * np.cos(2 * np.pi * 0.3 * tt) ** 2)

# ---------- mixagem: compressão leve e volume de trilha de vídeo
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 2.2) / 2.2          # saturação suave segura os picos dos impactos
mix = mix / np.max(np.abs(mix)) * 0.62  # ≈ −17 LUFS, pico verdadeiro abaixo de −1 dBFS
fade = np.ones(n)
fade[-int(2.2 * SR):] = np.linspace(1, 0, int(2.2 * SR)) ** 1.4
fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
mix *= fade[:, None]

SAIDA.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(SAIDA), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print(f"trilha: {SAIDA} ({DUR:.0f} s, {SR} Hz, {BPM} bpm)")
