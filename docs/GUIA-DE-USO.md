# Pro Edition — guia de uso

## Antes do primeiro uso: copiar o aprendizado existente

O Pro Edition roda o código do Auto B-roll e do Pro Captions dentro do seu
próprio plugin (`com.leogi.proedition`). Por uma limitação do UXP, o
aprendizado e os dados salvos por cada plugin ficam numa pasta ligada à
identidade do plugin em execução — então, sem este passo, o Auto B-roll
dentro do Pro Edition começaria com aprendizado zerado, mesmo que o plugin
standalone já tenha semanas de uso.

Faça isto **uma vez**, antes de usar o Pro Edition pela primeira vez:

1. Feche o Premiere.
2. Abra o Explorer em:
   `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versão>\External\`
   (troque `<versão>` por `25` ou `26`, conforme a versão do Premiere que
   você usa — se usa as duas, repita o passo nas duas pastas de versão).
3. Copie o **conteúdo** da pasta `com.leogi.autobroll\PluginData\` para
   dentro de `com.leogi.proedition\PluginData\` (crie a pasta se não
   existir).
4. Se você também usa o Pro Captions e quer o mesmo aprendizado/backups
   dentro do Pro Edition, repita o passo 3 com
   `com.leogi.procaptions\PluginData\`.

Depois desta cópia, os dois pares (plugin standalone / Pro Edition) passam a
acumular aprendizado **separado** a partir daí — abrir pelo plugin original
ou pelo shell não mantém os dois sincronizados automaticamente depois do
passo inicial. Isso é esperado.

## Instalação

Antes do primeiro uso, dentro do repositório `Pro-Edition`:

```
npm install
npm run build
```

Depois, registre o plugin no Premiere (uma vez só, como administrador — o
UXP Developer Tool não conecta neste ambiente, então a instalação é sempre
por link de diretório):

```
powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1
```

Reinicie o Premiere para carregar. Editar o repositório depois disso reflete
direto no plugin — só é preciso rodar `npm run build` de novo quando o
código muda (ver nota abaixo).

**Sempre que o Auto B-roll ou o Pro Captions mudar a UI deles (`src/ui/*`),
rode `npm run build` de novo aqui dentro do `Pro-Edition`.** O shell inclui o
HTML/CSS/mount.ts dos dois plugins irmãos no seu próprio bundle em tempo de
build — não lê os arquivos deles ao vivo — então uma mudança na UI de um dos
dois só aparece no Pro Edition depois de reconstruir o shell.

## Uso

Abra `Window > Extensions > Pro Edition` no Premiere. A tela inicial mostra
dois cards — escolha a ferramenta. Um botão "← Voltar" no topo volta para a
tela de seleção a qualquer momento, sem perder nada (nenhuma das duas
ferramentas guarda estado não salvo em memória entre uma ação e outra).

Cada ferramenta funciona exatamente como no plugin standalone — mesmos
botões, mesmo comportamento. Consulte o guia de cada uma para o dia a dia:

- Auto B-roll: `auto-broll-premiere/docs/GUIA-DE-USO.md`
- Pro Captions: `Pro-Captions/RETOMAR-pro-captions.md`
