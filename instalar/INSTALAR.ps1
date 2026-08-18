# Instala o Pro Edition nesta maquina.
# Clique com o botao direito neste arquivo > "Executar com o PowerShell",
# OU abra o PowerShell COMO ADMINISTRADOR e rode:
#   powershell -ExecutionPolicy Bypass -File INSTALAR.ps1
#
# Feche o Premiere antes.

$ErrorActionPreference = 'Stop'
$origem = $PSScriptRoot

# 1. O plugin em si
$ext = 'C:\Program Files\Common Files\Adobe\UXP\Plugins\External'
$destino = Join-Path $ext 'com.leogi.proedition'

New-Item -ItemType Directory -Force $ext | Out-Null
if (Test-Path $destino) {
    Remove-Item -Recurse -Force $destino
    Write-Host "versao anterior removida"
}
Copy-Item (Join-Path $origem 'com.leogi.proedition') $destino -Recurse
Write-Host "plugin instalado em: $destino"

# 2. O aprendizado (opcional, mas e o que faz o B-roll acertar de cara).
# A pasta de dados depende da versao do Premiere instalada; copia pra todas
# que existirem nesta maquina.
$dados = Join-Path $origem 'PluginData'
if (Test-Path $dados) {
    $raiz = Join-Path $env:APPDATA 'Adobe\UXP\PluginsStorage\PPRO'
    $versoes = if (Test-Path $raiz) { Get-ChildItem $raiz -Directory } else { @() }
    if ($versoes.Count -eq 0) {
        Write-Host "AVISO: nenhuma pasta de dados do Premiere encontrada."
        Write-Host "Abra o Premiere uma vez, feche, e rode este script de novo"
        Write-Host "para levar o aprendizado."
    }
    foreach ($v in $versoes) {
        $alvo = Join-Path $v.FullName 'External\com.leogi.proedition\PluginData'
        New-Item -ItemType Directory -Force $alvo | Out-Null
        Copy-Item (Join-Path $dados '*') $alvo -Force
        Write-Host "aprendizado copiado para PPRO\$($v.Name)"
    }
}

Write-Host ""
Write-Host "PRONTO. Abra o Premiere e va em Window > Extensions > Pro Edition."
