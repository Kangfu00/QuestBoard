[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'Questboard.lnk'

if (Test-Path -LiteralPath $shortcutPath -PathType Leaf) {
    if ($PSCmdlet.ShouldProcess($shortcutPath, 'Disable Questboard at Windows login')) {
        Remove-Item -LiteralPath $shortcutPath
        Write-Output 'Questboard autostart is disabled. Any running board remains available until you stop it or sign out.'
    }
}
else {
    Write-Output 'Questboard autostart is already disabled.'
}
