# Perfis de edição — 3 empresas × 2 tipos

Cada vídeo é de uma **empresa** (AndroClinic, GrandCare, Menopausa Cancelada) e de
um **tipo** (Ads ou Instagram orgânico). São 6 perfis, e o Pro Edition tem de
saber qual é antes de editar. Regra do Leo, 2026-09-25.

Levantado em 2026-09-25 em três fontes:
- Biblioteca de Anúncios da Meta: anúncios em vídeo de cada página, os de maior alcance e os mais recentes.
- Instagram de cada empresa: reels recentes.
- Projetos do Premiere em `C:\Edição`: fontes, trilhas e gráficos usados de fato.

Os quadros foram vistos em mosaicos de 12 momentos por vídeo; o som não foi
ouvido. O que está marcado com **?** falta confirmar com o Leo.

| Empresa | Página nos anúncios | Instagram |
|---|---|---|
| AndroClinic | Androclinic Brasil (id 281650945034666), ~77 vídeos | @androclinic.saude |
| GrandCare | Grand Care Brasil (id 154969534364950), ~5 vídeos | @grandcarebr |
| Menopausa Cancelada | Menopausa Cancelada (id 106449212160487), ~7 vídeos | @menopausa.cancelada |

## Ads

| | AndroClinic | GrandCare | Menopausa Cancelada |
|---|---|---|---|
| **Legenda** | Bebas Neue, MAIÚSCULA, branca com sombra, 1 a 3 palavras, no terço de baixo | igual à AndroClinic (Bebas Neue no `Grandcare.prproj`) | dois jeitos (ver abaixo) |
| **Layout** | doutor em tela cheia; B-roll entra na metade de baixo (split) | igual; tarja com o nome do doutor no começo | apresentadora com os produtos na mesa |
| **Logo** | — | GrandCare branco no canto superior direito | — |
| **Transição** | light leak em alguns cortes | light leak (Premiere Composer) | — |
| **Música** | trilha baixa de fundo | `Confident.wav`, `Main Version.wav` | ? |
| **Preço** | faixa separada, tamanho 150 | — | — |
| **Duração** | 60 a 85 s | 40 a 86 s | 45 a 155 s |

Os dois jeitos de legenda da Menopausa Cancelada:
1. Com os produtos na mesa: maiúscula condensada sobre uma faixa roxa.
2. Recente, estilo gravação pessoal (UGC):
   - minúscula, sem serifa;
   - palavra-chave maior e em negrito;
   - emoji (💧).

## Instagram (orgânico)

| | AndroClinic | GrandCare | Menopausa Cancelada |
|---|---|---|---|
| **Gancho** | capa com caixa azul da marca | caixa preta arredondada no topo: texto branco MAIÚSCULO + emoji, nos primeiros segundos | caixa branca com pergunta em preto, no topo, nos primeiros segundos |
| **Legenda** | palavras comuns pequenas e minúsculas; palavra-chave em MAIÚSCULA grande e negrito; às vezes destaque verde-amarelo em itálico | minúscula, branca, negrito e regular misturados; palavra-chave em amarelo e negrito; mantém a pontuação | minúscula em Helvetica Light; palavra-chave em MAIÚSCULA grande, Helvetica Bold; emoji no meio da frase (❤️) |
| **Posição** | na linha do split (meio da tela) | meio da tela | meio da tela, na linha do split |
| **Layout** | B-roll em cima, doutor embaixo | podcast: dois enquadramentos | B-roll 3D médico em cima e apresentadora embaixo; figurinha de produto |
| **Som** | ? | ? | lo-fi e hip-hop (Pixabay e `01. Assets`) + efeitos: câmera, porta, caixa registradora, fanfarra |
| **Animação** | ? | ? | Premiere Composer (light leak); 90 a 110 gráficos de texto por projeto |

Fontes lidas dos projetos:
- AndroClinic: Bebas Neue (1.299 legendas no `Andro 19.09`).
- Menopausa Cancelada: Helvetica Bold e Light, Arial Black.
- GrandCare: Bebas Neue nos Ads. O estilo do Instagram dela (amarelo, minúsculas) não aparece em nenhum projeto do Premiere — **feito no CapCut?**

## O que o Premiere deixa automatizar

- **Faixa de legenda.** Texto, tempo e faixa separada, como o preço de hoje, dá por código. O estilo da faixa continua manual (D-02) e a faixa não anima.
- **Palavra-chave em destaque (Instagram).** Mesma técnica do preço: as palavras-chave vão para uma segunda faixa com um estilo maior. Cor e negrito numa palavra *dentro* da legenda dependem de o Premiere aceitar `<b>` e `<font color>` no .srt — **a provar**.
- **Gancho.** Uma terceira faixa, com um estilo que tenha caixa de fundo, posicionada no topo.
- **Fora do alcance da faixa de legenda.** Animação (pop, light leak), emoji grande e figurinha de produto só entram por gráfico, .mogrt ou Premiere Composer.

## Plano

1. **Seletor de perfil no Editar**: empresa + tipo, lembrando a última escolha. Cada perfil guarda:
   - biblioteca de B-roll;
   - lado do B-roll no split (embaixo nos Ads, em cima no Instagram);
   - segmentação da legenda (Ads: maiúscula, 1 a 3 palavras, sem pontuação; Instagram: minúscula, com pontuação);
   - faixas e nomes dos estilos;
   - trilha e logo;
   - termos do ElevenLabs.
2. **Instagram**: faixa de destaque para as palavras-chave e faixa de gancho.
3. **Animações**: depois, por .mogrt; decisão do Leo.
