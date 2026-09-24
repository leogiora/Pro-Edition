# Instala o ajudante "Pro Captions: Timeline" (formato antigo de plugin, CEP).
#
# Como rodar: FECHE o Premiere, clique com o botao direito neste arquivo >
# "Executar com o PowerShell". Nao precisa ser administrador.
#
# O que ele faz, e so isso:
#  1. copia esta pasta para %APPDATA%\Adobe\CEP\extensions\com.leogi.procaptions.timeline
#  2. liga o "PlayerDebugMode" do CEP no registro DO SEU USUARIO
#     (HKCU\Software\Adobe\CSXS.9 a CSXS.13). Sem isso o Premiere recusa
#     plugins CEP que nao foram assinados pela Adobe - como este.
#
# Para desfazer: apague a pasta do passo 1 e, se quiser, o valor
# PlayerDebugMode nas chaves do passo 2.

$ErrorActionPreference = 'Stop'
$origem = $PSScriptRoot
$destino = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.leogi.procaptions.timeline'

New-Item -ItemType Directory -Force (Split-Path $destino) | Out-Null
if (Test-Path $destino) {
    Remove-Item -Recurse -Force $destino
    Write-Host "versao anterior removida"
}
New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item (Join-Path $origem 'CSXS') $destino -Recurse
Copy-Item (Join-Path $origem 'index.html') $destino
Copy-Item (Join-Path $origem 'ponte.html') $destino
Copy-Item (Join-Path $origem 'host.jsx') $destino
Write-Host "ajudante instalado em: $destino"

foreach ($v in 9..13) {
    $chave = "HKCU:\Software\Adobe\CSXS.$v"
    New-Item -Path $chave -Force | Out-Null
    Set-ItemProperty -Path $chave -Name 'PlayerDebugMode' -Value '1' -Type String
}
Write-Host "PlayerDebugMode ligado (CSXS.9 a CSXS.13)"

Write-Host ""
Write-Host "PRONTO. Abra o Premiere e va em Window > Extensions > Pro Captions: Timeline."
Read-Host "Aperte Enter para fechar"
