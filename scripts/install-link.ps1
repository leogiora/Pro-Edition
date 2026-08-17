# Instala o plugin no Premiere por symlink de diretorio.
# Rodar UMA vez, como administrador (escreve em Program Files):
#   powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1
#
# Depois disso, editar o repositorio reflete direto no plugin.
# Reiniciar o Premiere recarrega. Nao ha hot reload.

$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$ext  = 'C:\Program Files\Common Files\Adobe\UXP\Plugins\External'
$link = Join-Path $ext 'com.leogi.proedition'

New-Item -ItemType Directory -Force $ext | Out-Null

if (Test-Path $link) {
    # Remove SOMENTE o link. Directory.Delete sem recursao falha numa pasta real
    # com conteudo — e essa falha e a protecao: nunca apaga o repositorio.
    [System.IO.Directory]::Delete($link, $false)
    Write-Host "link anterior removido"
}

New-Item -ItemType SymbolicLink -Path $link -Target $repo | Out-Null
Write-Host "instalado: $link -> $repo"
Write-Host "reinicie o Premiere Pro para carregar."
