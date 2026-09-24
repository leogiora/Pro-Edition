# Cria o atalho "Pro Edition" na area de trabalho (roda uma vez).
# Enquanto nao ha instalador, o atalho abre o programa direto da pasta do repositorio.
$app = Split-Path -Parent $PSScriptRoot
& npm --prefix $app run build | Out-Null
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Pro Edition.lnk'))
$lnk.TargetPath = Join-Path $app 'node_modules\electron\dist\electron.exe'
$lnk.Arguments = "`"$app`""
$lnk.WorkingDirectory = $app
$lnk.IconLocation = Join-Path $app 'scripts\icone.ico'
$lnk.Description = 'Pro Edition'
$lnk.Save()
Write-Output "atalho criado: $($lnk.FullName)"
