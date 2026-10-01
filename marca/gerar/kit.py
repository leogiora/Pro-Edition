"""Gera o kit do logo Cutline (direcao B: faixas cortadas pelo cursor)."""
import os
from ttfpath import texto_em_path

SAIDA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # marca/
os.makedirs(SAIDA, exist_ok=True)
FONTE = os.path.join(os.environ['LOCALAPPDATA'], r'Microsoft\Windows\Fonts\Montserrat-Bold.ttf')

NOITE, PAPEL, CORTE = '#0d0f13', '#eceef2', '#ff7d71'


def barra_esq(x0, x1, y, h):
    r = h / 2
    return f'M{x0 + r:g} {y:g}H{x1:g}V{y + h:g}H{x0 + r:g}A{r:g} {r:g} 0 0 1 {x0 + r:g} {y:g}Z'


def barra_dir(x0, x1, y, h):
    r = h / 2
    return f'M{x0:g} {y:g}H{x1 - r:g}A{r:g} {r:g} 0 0 1 {x1 - r:g} {y + h:g}H{x0:g}Z'


def simbolo(pequeno=False):
    """(d das faixas, d do cursor) no quadro 256x256."""
    if pequeno:  # corte para 16-32 px: faixas grossas, corte largo, cursor maior
        h, corte, ys = 44, (116, 140), (66, 126, 186)
        faixas = ((28, 196), (64, 228), (44, 212))
        cursor = 'M100 18H156L128 54Z'
    else:
        h, corte, ys = 28, (122, 134), (86, 132, 178)
        faixas = ((36, 184), (72, 220), (50, 200))
        cursor = 'M110 50H146L128 72Z'
    d = ''.join(barra_esq(a, corte[0], y, h) + barra_dir(corte[1], b, y, h) for (a, b), y in zip(faixas, ys))
    return d, cursor


def svg(vb, corpo, titulo='Cutline'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img"><title>{titulo}</title>{corpo}</svg>\n'


def grupo(d, cor):
    return f'<path fill="{cor}" d="{d}"/>'


def nome(x, yb, tam):
    """Cutline em Montserrat Bold com o pingo do i trocado pelo cursor."""
    ajustes = {1: -0.01 * tam, 2: -0.005 * tam}  # C-u e u-t um pouco mais juntos
    d, w, pos, esc, f = texto_em_path(FONTE, 'Cutlıne', tam, x, yb, -0.02 * tam, ajustes)
    # haste do ı: caixa dos pontos do glifo
    g = f.cmap[0x131]
    xs = [p[0] for c in f.contornos(g) for p in c]
    ys = [p[1] for c in f.contornos(g) for p in c]
    cx = pos[5] + (min(xs) + max(xs)) / 2 * esc
    haste = (max(xs) - min(xs)) * esc
    topo = yb - max(ys) * esc
    lw = haste * 1.7
    th = lw * 0.62
    gap = haste * 0.45
    tri = f'M{cx - lw / 2:.2f} {topo - gap - th:.2f}H{cx + lw / 2:.2f}L{cx:.2f} {topo - gap:.2f}Z'
    return d, tri, w


def escreve(nomearq, conteudo):
    open(os.path.join(SAIDA, nomearq), 'w', encoding='utf-8').write(conteudo)


# ---- simbolo
for pequeno, suf in ((False, ''), (True, '-pequeno')):
    d, cur = simbolo(pequeno)
    vb = '0 0 256 256'
    escreve(f'cutline-simbolo{suf}-preto.svg', svg(vb, grupo(d + cur, '#000000')))
    escreve(f'cutline-simbolo{suf}-branco.svg', svg(vb, grupo(d + cur, '#ffffff')))
    escreve(f'cutline-simbolo{suf}-claro.svg', svg(vb, grupo(d, NOITE) + grupo(cur, CORTE)))
    escreve(f'cutline-simbolo{suf}-escuro.svg', svg(vb, grupo(d, PAPEL) + grupo(cur, CORTE)))

# ---- icone de app: o simbolo pequeno num bloco escuro
d, cur = simbolo(True)
icone = (f'<rect width="256" height="256" rx="56" fill="{NOITE}"/>'
         f'<g transform="translate(28 28) scale(0.78125)">{grupo(d, PAPEL)}{grupo(cur, CORTE)}</g>')
escreve('cutline-icone-app.svg', svg('0 0 256 256', icone))

# ---- nome sozinho e assinaturas
dn, tri, w = nome(0, 120, 160)
escreve('cutline-nome-claro.svg', svg(f'-4 0 {w + 8:.0f} 160', grupo(dn, NOITE) + grupo(tri, CORTE)))
escreve('cutline-nome-escuro.svg', svg(f'-4 0 {w + 8:.0f} 160', grupo(dn, PAPEL) + grupo(tri, CORTE)))

d, cur = simbolo(False)
# horizontal: simbolo 256 de altura, nome com altura de x ~ altura das 3 faixas
# maiuscula do topo da faixa de cima (86) ate a base da de baixo (206): Montserrat C ~0,70 em
dn, tri, w = nome(262, 206, 171)
larg = 262 + w + 24
for tom, faixa, letra in (('claro', NOITE, NOITE), ('escuro', PAPEL, PAPEL), ('preto', '#000', '#000'), ('branco', '#fff', '#fff')):
    cc = '#000' if tom == 'preto' else '#fff' if tom == 'branco' else CORTE
    escreve(f'cutline-horizontal-{tom}.svg', svg(f'0 0 {larg:.0f} 256', grupo(d, faixa) + grupo(cur, cc) + grupo(dn, letra) + grupo(tri, cc)))

# empilhado: simbolo em cima, nome embaixo, centralizados
dn, tri, w = nome(0, 0, 120)
x0 = (256 - w) / 2
dn, tri, w = nome(x0, 330, 120)
for tom, faixa in (('claro', NOITE), ('escuro', PAPEL)):
    escreve(f'cutline-empilhado-{tom}.svg', svg(f'{min(0, x0) - 8:.0f} 20 {max(256, w) + 16:.0f} 340', grupo(d, faixa) + grupo(cur, CORTE) + grupo(dn, faixa) + grupo(tri, CORTE)))
print('ok', sorted(os.listdir(SAIDA)))
