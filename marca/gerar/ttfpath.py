"""Texto -> contorno SVG a partir de um .ttf (TrueType 'glyf'), sem dependencias.
Uso: texto_em_path(fonte, texto, tamanho, x, y_base, tracking) -> (d, largura)."""
import struct


class Fonte:
    def __init__(self, caminho):
        self.b = open(caminho, 'rb').read()
        n = struct.unpack('>H', self.b[4:6])[0]
        self.t = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack('>4sIII', self.b[12 + 16 * i:28 + 16 * i])
            self.t[tag.decode('latin1')] = (off, ln)
        h = self.t['head'][0]
        self.upm = struct.unpack('>H', self.b[h + 18:h + 20])[0]
        self.loc_longo = struct.unpack('>h', self.b[h + 50:h + 52])[0] == 1
        self.ng = struct.unpack('>H', self.b[self.t['maxp'][0] + 4:self.t['maxp'][0] + 6])[0]
        hh = self.t['hhea'][0]
        self.nhm = struct.unpack('>H', self.b[hh + 34:hh + 36])[0]
        self.cmap = self._cmap()

    def _cmap(self):
        c = self.t['cmap'][0]
        n = struct.unpack('>H', self.b[c + 2:c + 4])[0]
        for i in range(n):
            pid, eid, off = struct.unpack('>HHI', self.b[c + 4 + 8 * i:c + 12 + 8 * i])
            s = c + off
            if struct.unpack('>H', self.b[s:s + 2])[0] == 4 and pid in (0, 3):
                segx2 = struct.unpack('>H', self.b[s + 6:s + 8])[0]
                seg = segx2 // 2
                ends = struct.unpack('>%dH' % seg, self.b[s + 14:s + 14 + segx2])
                starts = struct.unpack('>%dH' % seg, self.b[s + 16 + segx2:s + 16 + 2 * segx2])
                deltas = struct.unpack('>%dh' % seg, self.b[s + 16 + 2 * segx2:s + 16 + 3 * segx2])
                ro_off = s + 16 + 3 * segx2
                ros = struct.unpack('>%dH' % seg, self.b[ro_off:ro_off + segx2])
                m = {}
                for k in range(seg):
                    for cp in range(starts[k], ends[k] + 1):
                        if cp == 0xFFFF:
                            continue
                        if ros[k] == 0:
                            g = (cp + deltas[k]) & 0xFFFF
                        else:
                            a = ro_off + 2 * k + ros[k] + 2 * (cp - starts[k])
                            g = struct.unpack('>H', self.b[a:a + 2])[0]
                            if g:
                                g = (g + deltas[k]) & 0xFFFF
                        m[cp] = g
                return m
        raise ValueError('sem cmap formato 4')

    def avanco(self, g):
        h = self.t['hmtx'][0]
        i = min(g, self.nhm - 1)
        return struct.unpack('>H', self.b[h + 4 * i:h + 4 * i + 2])[0]

    def _loca(self, g):
        l = self.t['loca'][0]
        if self.loc_longo:
            a, b = struct.unpack('>II', self.b[l + 4 * g:l + 4 * g + 8])
        else:
            a, b = [2 * v for v in struct.unpack('>HH', self.b[l + 2 * g:l + 2 * g + 4])]
        return a, b

    def contornos(self, g):
        """Lista de contornos; cada um e lista de (x, y, on)."""
        a, b = self._loca(g)
        if a == b:
            return []
        p = self.t['glyf'][0] + a
        nc = struct.unpack('>h', self.b[p:p + 2])[0]
        p += 10
        if nc >= 0:
            ends = struct.unpack('>%dH' % nc, self.b[p:p + 2 * nc]); p += 2 * nc
            il = struct.unpack('>H', self.b[p:p + 2])[0]; p += 2 + il
            npt = ends[-1] + 1 if nc else 0
            flags = []
            while len(flags) < npt:
                f = self.b[p]; p += 1
                flags.append(f)
                if f & 8:
                    r = self.b[p]; p += 1
                    flags.extend([f] * r)
            xs, ys = [], []
            for eixo, curto, igual in ((xs, 2, 16), (ys, 4, 32)):
                v = 0
                for f in flags:
                    if f & curto:
                        d = self.b[p]; p += 1
                        v += d if f & igual else -d
                    elif not f & igual:
                        v += struct.unpack('>h', self.b[p:p + 2])[0]; p += 2
                    eixo.append(v)
            out, ini = [], 0
            for e in ends:
                out.append([(xs[i], ys[i], flags[i] & 1) for i in range(ini, e + 1)])
                ini = e + 1
            return out
        out = []
        while True:
            fl, gi = struct.unpack('>HH', self.b[p:p + 4]); p += 4
            if fl & 1:
                dx, dy = struct.unpack('>hh', self.b[p:p + 4]); p += 4
            else:
                dx, dy = struct.unpack('>bb', self.b[p:p + 2]); p += 2
            if fl & 8:
                p += 2
            elif fl & 0x40:
                p += 4
            elif fl & 0x80:
                p += 8
            for c in self.contornos(gi):
                out.append([(x + dx, y + dy, on) for x, y, on in c])
            if not fl & 0x20:
                break
        return out


def _d(contornos, esc, x0, yb):
    X = lambda x: x0 + x * esc
    Y = lambda y: yb - y * esc
    partes = []
    for c in contornos:
        if not c:
            continue
        pts = list(c)
        # comeca num ponto on-curve (ou no meio de dois off)
        k = next((i for i, q in enumerate(pts) if q[2]), None)
        if k is None:
            a, b2 = pts[0], pts[1]
            pts.insert(0, ((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, 1)); k = 0
        pts = pts[k:] + pts[:k]
        s = 'M%.2f %.2f' % (X(pts[0][0]), Y(pts[0][1]))
        i, n = 1, len(pts)
        while i <= n:
            q = pts[i % n]
            if q[2]:
                s += 'L%.2f %.2f' % (X(q[0]), Y(q[1])); i += 1
            else:
                r = pts[(i + 1) % n]
                if r[2]:
                    fim = r; i += 2
                else:
                    fim = ((q[0] + r[0]) / 2, (q[1] + r[1]) / 2, 1); i += 1
                s += 'Q%.2f %.2f %.2f %.2f' % (X(q[0]), Y(q[1]), X(fim[0]), Y(fim[1]))
        partes.append(s + 'Z')
    return ''.join(partes)


def texto_em_path(caminho, texto, tamanho, x, yb, tracking=0.0, ajustes=None):
    """ajustes: {indice: dx em unidades de tamanho} para espacamento otico."""
    f = Fonte(caminho)
    esc = tamanho / f.upm
    d, cx, posicoes = '', x, []
    for i, ch in enumerate(texto):
        g = f.cmap[ord(ch)]
        cx += (ajustes or {}).get(i, 0)
        posicoes.append(cx)
        d += _d(f.contornos(g), esc, cx, yb)
        cx += f.avanco(g) * esc + tracking
    return d, cx - tracking - x, posicoes, esc, f
