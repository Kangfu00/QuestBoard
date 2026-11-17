[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [string]$NodePath,
    [ValidateRange(5, 120)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$boardDirectory = [System.IO.Path]::GetFullPath($PSScriptRoot)
$serverPath = Join-Path $boardDirectory 'server.mjs'
$logDirectory = Join-Path $boardDirectory '.local\logs'
$launcherLog = Join-Path $logDirectory 'launcher.log'
$boardUrl = 'http://127.0.0.1:4173'
$launcherMutex = $null
$ownsMutex = $false

function Write-LauncherLog {
    param([string]$Message)
    Add-Content -LiteralPath $launcherLog -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) -Encoding UTF8
}

function Test-QuestboardHealth {
    try {
        $health = Invoke-RestMethod -Uri ($boardUrl + '/api/health') -Method Get -TimeoutSec 2 -UseBasicParsing
        return ($health.app -eq 'questboard' -and $health.backupApi -eq 1)
    }
    catch {
        return $false
    }
}

try {
    [System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null
    # Serialize simultaneous login/manual launches within this Windows session.
    $launcherMutex = New-Object System.Threading.Mutex($false, 'Local\Questboard-4173-Launcher')
    try {
        $ownsMutex = $launcherMutex.WaitOne([TimeSpan]::FromSeconds($TimeoutSeconds + 5))
    }
    catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }
    if (-not $ownsMutex) {
        throw 'Another Questboard launcher is still starting the board. Try again shortly.'
    }

    if (Test-QuestboardHealth) {
        Write-LauncherLog 'Reusing the healthy Questboard server on port 4173.'
    }
    else {
        $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
        if (@($listeners | Where-Object { $_.Port -eq 4173 }).Count -gt 0) {
            throw 'Port 4173 is occupied by an older Questboard server or another application. Stop that known server manually, then run Start-Questboard.cmd again. No process was stopped.'
        }
        if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
            throw ('Questboard server is missing: {0}' -f $serverPath)
        }
        if (-not $NodePath) {
            $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $nodeCommand) {
                throw 'Node.js 20 or newer is required. Install Node.js, then run Start-Questboard.cmd again.'
            }
            $NodePath = $nodeCommand.Source
        }
        $NodePath = [System.IO.Path]::GetFullPath($NodePath)
        if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
            throw ('Node.js executable is missing: {0}. Run Install-Questboard-Autostart.ps1 again after installing Node.js.' -f $NodePath)
        }
        $nodeVersion = & $NodePath --version
        if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
            throw ('Node.js 20 or newer is required; found {0}.' -f $nodeVersion)
        }

        $stdoutPath = Join-Path $logDirectory 'server.stdout.log'
        $stderrPath = Join-Path $logDirectory 'server.stderr.log'
        $serverProcess = Start-Process -FilePath $NodePath -ArgumentList ('"{0}"' -f $serverPath) -WorkingDirectory $boardDirectory -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        Write-LauncherLog ('Started Node.js process {0}; waiting for Questboard health.' -f $serverProcess.Id)

        $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
        $healthy = $false
        do {
            if (Test-QuestboardHealth) {
                $healthy = $true
                break
            }
            $serverProcess.Refresh()
            if ($serverProcess.HasExited) {
                throw ('Questboard exited with code {0}. See {1}.' -f $serverProcess.ExitCode, $stderrPath)
            }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $deadline)
        if (-not $healthy) {
            throw ('Questboard did not become ready within {0} seconds. See {1}.' -f $TimeoutSeconds, $stderrPath)
        }
        Write-LauncherLog 'Questboard is ready.'
    }

    if (-not $NoBrowser) {
        Start-Process -FilePath $boardUrl | Out-Null
        Write-LauncherLog 'Opened the board in the default browser.'
    }
    Write-Output ('Questboard is ready at {0}' -f $boardUrl)
}
catch {
    $failureMessage = $_.Exception.Message
    try { Write-LauncherLog ('ERROR: {0}' -f $failureMessage) } catch { }
    Write-Error $failureMessage -ErrorAction Continue
    exit 1
}
finally {
    if ($ownsMutex) { $launcherMutex.ReleaseMutex() }
    if ($null -ne $launcherMutex) { $launcherMutex.Dispose() }
}
