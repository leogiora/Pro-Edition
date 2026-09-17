# Retomar o Auto B-roll

## Cole isto no Claude Code

```
Continuar o Auto B-roll: C:\Users\leogi\Desktop\auto-broll-premiere
Leia docs/UXP_ARMADILHAS.md e docs/BUILD_STATUS.md antes de mexer em qualquer coisa.
```

---

## Onde está tudo

| | |
|---|---|
| Código | `C:\Users\leogi\Desktop\auto-broll-premiere` |
| GitHub (privado) | https://github.com/leogiora/auto-broll-premiere |
| Biblioteca de B-rolls | `C:\Users\leogi\Downloads\Brolls - 2026` |
| Painel no Premiere | `Janela > UXP Plugins > Auto B-roll` |

---

## O que já funciona

Um clique em **Analisar e inserir** lê a pasta de B-rolls, reconstrói a
transcrição do corte final, casa com os conceitos da biblioteca e insere em V2 —
aparando a duração, escalando para preencher a tela e removendo o áudio.

**Marcando in/out na timeline** (teclas `I`/`O`), o Analisar insere só dentro
do trecho — dá pra tratar um reel de cada vez numa sequência com vários.

**Aprendizado por sobrevivência** já rodou ao vivo: o plugin guarda o que
inseriu, e na próxima análise vê o que você manteve (acerto) e o que apagou
(erro). B-roll que **você mesmo coloca** também ensina — mesmo quando o
dicionário não explica a escolha, o take ganha crédito na hora (é o pedido do
usuário: "se coloquei o B-roll ali, tem sentido").

Três `Ctrl+Z` desfazem tudo. É 100% local: o plugin não tem permissão de rede.

---

## Sessão de 2026-08-12 — o que foi corrigido

Uso real intenso na sequência "AS 20 SELECIONADAS" (20 reels, 500+ clipes em
V1) revelou uma família inteira de bugs com a mesma causa: **comparar por
nome em vez de posição**. Nomes de arquivo se repetem (mesmo take usado em
rodadas diferentes, ou colocado à mão); posição não. Corrigido em cadeia:

| | |
|---|---|
| D-029 | Repetir take vira fallback (nunca proibição total) com janela de 60s |
| D-030 | Colocação manual sem termo no dicionário credita o take mesmo assim |
| D-031 | In/out marcado na timeline recorta onde o Analisar insere |
| D-032 | Trava anti-Ctrl+Z passou a conferir posição — undo em lote furava por nome e puniu 67 pares errado (reparado no `aprendizado.json` do Premiere 25) |
| D-033 | Colocação manual não se confunde mais com trabalho do plugin (mesmo defeito do D-032, achado de novo) |
| D-034 | Colocação manual credita a frase que ela COBRE, não onde começa |

Todos com teste (218 no total) e documentados em `docs/DECISIONS.md`.
**Confirmado ao vivo no Premiere 25** nesta sessão: in/out (D-031), crédito
sem ligação (D-030), trava por posição parou de acusar Ctrl+Z como rejeição.
**Premiere 26 não foi reaberto** desde os fixes de compatibilidade da sessão
anterior — os fallbacks foram desenhados para não quebrar o 26, mas isso é
expectativa, não prova.

Achado também sem ser bug: a legenda queimada na timeline pode divergir da
transcrição que o plugin lê (duas passadas de reconhecimento de fala
diferentes do Premiere sobre o mesmo áudio) — documentado em
`docs/GUIA-DE-USO.md`.

---

## Próximo passo

**Não sobrescrever** (D-023) é o item mais importante ainda sem prova ao
vivo desde as mudanças de hoje: clicar em Analisar duas vezes seguidas sem
editar nada tem que dizer *"Tudo o que eu sugeriria já está na timeline"* e
não mexer em nada — é a trava que protege sua edição.

Depois disso, em ordem de valor: reabrir no Premiere 26 para confirmar que
nada quebrou; calibrar os números do aprendizado com mais uso (passo de
0,15, teto de 20, tolerância de intensidade 0,35); cenários difíceis de
remapeamento (nested, multicam, velocidade alterada, mídia offline).

---

## Se algo estiver quebrado

```bash
cd C:\Users\leogi\Desktop\auto-broll-premiere
npm run verify
```

Passou → o problema é o Premiere, não o código. Não passou → é o código.

**Não há hot reload:** qualquer alteração exige reiniciar o Premiere.

O log da última análise (e do último Aprender) fica em, por versão do
Premiere:

```
%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<25 ou 26>\External\com.leogi.autobroll\PluginData\ultimo-log.json
%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<25 ou 26>\External\com.leogi.autobroll\PluginData\ultimo-aprendizado.json
```

Ler esse arquivo é mais confiável que olhar o painel — ele é curto e o log
fica abaixo da área visível.

---

## Pendências conhecidas

1. Undo são três, não um só (esbarra em dependência real entre as etapas).
2. `createSetEndAction` (apara a duração) nunca foi provada isoladamente.
3. Os números do aprendizado ainda não foram calibrados com uso extenso.
4. Cenários nested, multicam, velocidade alterada e mídia offline não foram
   vistos — é onde eu esperaria os próximos problemas.
5. Premiere 26 pendente de reteste desde os fixes de compatibilidade com o 25.

---

## Se mudar de máquina

O plugin é instalado por symlink, não por instalador:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1
```

Como administrador, uma vez. Os pré-requisitos estão no `README.md`.

---

_Sessão de 2026-08-12. O histórico completo — decisões, medições e os erros
que custaram caro — está em `docs/DECISIONS.md` e `docs/UXP_ARMADILHAS.md`._
