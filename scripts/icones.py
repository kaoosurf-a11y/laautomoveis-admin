"""Gera src/assets/icones/ com a fonte Tabler recortada so nos icones que o painel usa.

Antes o index.html puxava do CDN a fonte inteira (~730 KB) e o CSS de 5 mil icones
(~186 KB) pra usar ~100. Rodar de novo sempre que usar um icone novo (icone fora da
lista aparece em branco, nao quebra a tela):

    pip install fonttools   # ou PYTHONPATH apontando pra um fonttools descompactado
    python3 scripts/icones.py

Sai em WOFF (zlib) porque o WOFF2 pede o modulo brotli, que a VPS nao tem.
"""
import io
import os
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

VERSAO = "3.0.0"
CDN = f"https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@{VERSAO}/dist"
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DESTINO = os.path.join(RAIZ, "src", "assets", "icones")


def baixar(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def arquivos():
    for pasta, _, nomes in os.walk(os.path.join(RAIZ, "src")):
        for n in nomes:
            if re.search(r"\.(jsx?|css)$", n) and not n.startswith("tabler-recorte"):
                yield os.path.join(pasta, n)
    yield os.path.join(RAIZ, "index.html")


# Nomes usados: "ti-xxx" literal e as duas pontas de `ti ti-${cond?"a":"b"}`.
usados = set()
for f in arquivos():
    txt = open(f, encoding="utf-8").read()
    usados.update(re.findall(r"\bti-([a-z0-9]+(?:-[a-z0-9]+)*)", txt))
    for expr in re.findall(r"ti ti-\$\{([^}]*)\}", txt):
        usados.update(re.findall(r"[\"']([a-z0-9-]+)[\"']", expr))

css = baixar(f"{CDN}/tabler-icons.min.css").decode()
regras, codigos, faltando = [], [], []
for nome in sorted(usados):
    m = re.search(r"\.ti-%s:before\{content:\"\\([0-9a-f]+)\"\}" % re.escape(nome), css)
    if not m:
        faltando.append(nome)
        continue
    regras.append('.ti-%s:before{content:"\\%s"}' % (nome, m.group(1)))
    codigos.append(int(m.group(1), 16))
base = re.search(r"\.ti\{[^}]*\}", css).group(0)  # familia, alinhamento, suavizacao (igual ao CDN)

fonte = TTFont(io.BytesIO(baixar(f"{CDN}/fonts/tabler-icons.ttf")))
# A tabela de ligaduras (GSUB) dessa versao vem corrompida e derruba o recorte; o painel
# usa so o codigo de cada icone (content:"\\xxxx"), entao ela sai.
for tabela in ("GSUB", "GPOS"):
    if tabela in fonte:
        del fonte[tabela]
opcoes = subset.Options()
opcoes.flavor = "woff"
opcoes.layout_features = []
opcoes.name_IDs = ["*"]
recortador = subset.Subsetter(opcoes)
recortador.populate(unicodes=codigos)
recortador.subset(fonte)
os.makedirs(DESTINO, exist_ok=True)
fonte.flavor = "woff"
fonte.save(os.path.join(DESTINO, "tabler-recorte.woff"))

with open(os.path.join(DESTINO, "tabler-recorte.css"), "w", encoding="utf-8") as out:
    out.write(f"/* Gerado por scripts/icones.py (Tabler Icons {VERSAO}, {len(regras)} icones). Nao editar a mao. */\n")
    out.write('@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;'
              'src:url("./tabler-recorte.woff") format("woff")}\n')
    out.write(base + "\n" + "\n".join(regras) + "\n")

print(f"{len(regras)} icones, fonte {os.path.getsize(os.path.join(DESTINO, 'tabler-recorte.woff'))} bytes")
# Classes que nao sao icone (ex.: "ti-" solto) caem aqui; conferir a lista.
if faltando:
    print("sem icone no Tabler:", ", ".join(faltando))
