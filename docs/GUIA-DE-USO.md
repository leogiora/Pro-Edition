# Guia de uso — Auto B-roll

Documento para apresentação e treinamento. Fala do ponto de vista de quem usa
o painel dentro do Premiere, não de quem programa. Para detalhes técnicos, ver
os documentos em `docs/` (`API_PROOFS.md`, `DECISIONS.md`, `UXP_ARMADILHAS.md`).

> **Mantido em dia automaticamente**: toda vez que o comportamento do plugin
> muda, este guia é atualizado na mesma sessão (regra em `CLAUDE.md`, seção 5).

---

## O que o plugin faz

Você edita a sequência normalmente na V1. Um clique em **Analisar e inserir**:

1. Lê a transcrição de cada mídia usada na V1 (a que o Premiere já gera).
2. Descobre o que sobrou depois do corte — a maior parte da fala gravada não
   sobrevive, e é só isso que importa.
3. Compara o que foi dito com os nomes dos arquivos de B-roll da sua pasta
   (`Viagra.mp4`, `Falhou na cama.mp4`, etc.) e com um dicionário de sinônimos.
4. Escolhe onde encaixar cada B-roll, prefere take inédito (só repete um já
   usado depois de 60 segundos, e só quando não sobrou nenhum novo), evita
   sobrepor o que já está na timeline.
5. Insere em V2, corta no tamanho certo, escala pra preencher a tela e tira o
   áudio — tudo isso sem você revisar antes.

Três `Ctrl+Z` desfazem a inserção inteira.

**100% local.** Não manda vídeo nem transcrição pra nenhum servidor. Não há
IA generativa nem visão computacional — o casamento é o nome do arquivo (e um
dicionário de sinônimos) contra o texto da fala.

---

## Os controles do painel

| Controle | O que faz |
|---|---|
| **Pasta de B-rolls** | Onde ficam os arquivos `.mp4` que ele pode inserir. Fica salvo depois da primeira vez. |
| **Preencher a tela** | Escala o B-roll pra cobrir o quadro inteiro, mesmo que a proporção não bata exatamente. |
| **Densidade máxima** | Afrouxa as regras de *espaçamento* entre B-rolls (não a qualidade do match) pra caber mais na timeline. Ligue quando achar que ficou "espaçado demais". |
| **Remover o áudio** | Tira o som original do clipe de B-roll ao inserir (a trilha/voz principal nunca é tocada, isso é só o áudio que vem junto do arquivo de vídeo). |
| **Analisar e inserir** | O botão principal: faz tudo — lê, casa, planeja e insere. |
| **Aprender** | Só ensina, não insere nada. Use depois de editar a timeline na mão (apagar o que não serviu, adicionar B-roll seu) sem rodar uma análise nova. |

---

## O sistema de aprendizado

O plugin **não tem modelo, não tem IA** — ele só conta o que sobreviveu.

- B-roll que ele inseriu e você **manteve** → acerto, aquele conceito/arquivo
  ganha prioridade da próxima vez.
- B-roll que ele inseriu e você **apagou** → erro, ele evita repetir a mesma
  escolha.
- B-roll que **você mesmo colocou**, sem ser sugestão dele → ele credita como
  ensinamento seu, e pode até aprender um sinônimo novo se isso acontecer
  algumas vezes seguidas. Vale mesmo quando a fala não tem nada a ver com o
  nome do arquivo: se você colocou, fez sentido — o take ganha crédito e o
  painel diz "o take ganhou crédito e contei as palavras cobertas".

Ou seja: **editar a timeline normalmente já ensina o plugin.** Não precisa de
botão de "nota" nem configuração.

### Uma exceção importante

Se você desfizer **o lote inteiro de uma vez** (`Ctrl+Z` várias vezes seguidas
logo depois de inserir), o plugin reconhece que foi um desfazer, não uma
rejeição de verdade — e não penaliza nada. A penalização só acontece quando
**parte** do que ele inseriu sobrevive e parte não: aí sim é sinal real de
curadoria.

---

## Como ler o log

Cada análise grava um log completo em (mais confiável que print de tela):

```
%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versão>\External\com.leogi.autobroll\PluginData\ultimo-log.json
```

Mensagens mais comuns e o que significam:

| Mensagem | Significado |
|---|---|
| `nenhuma sugestao passou (melhor: 50%)` | Achou algo parecido, mas não o bastante (limite é 60%). Não é erro — é o filtro de qualidade funcionando. |
| `já há B-roll aí, deixei como está` | Tem alguma coisa em cima daquele instante em **qualquer** faixa de vídeo acima da V1 (não só a que ele usa). Nunca insere por cima. |
| `muito perto do B-roll anterior` / `conceito repetido há menos de 8s` | Regra de espaçamento — ative "Densidade máxima" se quiser afrouxar isso. |
| `todas as variações apareceram há menos de 60s` | Todos os arquivos daquele conceito já estão na timeline, perto demais para repetir. Depois de 60 segundos o mesmo take pode voltar. |
| `take repetido, não sobrou inédito` | Não é descarte — o B-roll entrou, repetindo um take que já apareceu há mais de 60 segundos, porque o conceito não tinha arquivo novo. |
| `Trecho incerto (confiança X)` | Aviso da própria transcrição do Premiere, não do plugin — a fala reconhecida ali tem baixa confiança. |

---

## Limitações que valem saber antes de apresentar

- **O casamento é texto contra texto**, não entendimento do vídeo. Um B-roll
  cujo conteúdo visual bate perfeitamente com a fala pode não ser escolhido se
  o nome do arquivo (e os sinônimos cadastrados) não tiverem nada a ver com as
  palavras ditas.
- **Precisão da transcrição depende do motor de fala do próprio Premiere** —
  varia entre versões do Premiere, não é algo que o plugin controla.
- Roda em **Premiere 25 e 26** (manifest sem versão máxima), mas algumas APIs
  mudam de nome entre versões — o plugin já trata isso com fallback, mas se
  aparecer um erro de "não é uma função" no log, é sinal de mais uma dessas
  diferenças.

---

## Onde estão os arquivos, se for demonstrar em outra máquina

- Repositório: `auto-broll-premiere` (GitHub, `leogiora/auto-broll-premiere`).
- Requer instalar como plugin UXP (não é só copiar arquivo) — ver `README.md`
  na raiz do repositório, seção "Instalação".
