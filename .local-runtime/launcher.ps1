param(
    [switch]$NoBrowser,
    [switch]$Stop,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskServerPath = Join-Path $taskRoot 'backend\server.js'
$taskIndexPath = Join-Path $taskRoot 'dist\pages\index.html'
$taskUrl = 'http://127.0.0.1:8787/'
$taskNodePath = 'C:\Program Files\nodejs\node.exe'
$taskStatePath = Join-Path $PSScriptRoot 'server-state.json'
$taskOutputPath = Join-Path $PSScriptRoot 'server-output.log'
$taskErrorPath = Join-Path $PSScriptRoot 'server-error.log'
$taskMutex = [System.Threading.Mutex]::new($false, 'Local\ZZZCalculator_D_LocalLauncher')
$taskLocked = $false

function Get-CalculatorHealth {
    try {
        return Invoke-RestMethod -Uri ($taskUrl + 'api/health') -TimeoutSec 2
    } catch {
        return $null
    }
}

function Get-CalculatorListeners {
    return @(Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-OwnedCalculatorProcess([int]$taskProcessId) {
    $taskProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $taskProcessId) -ErrorAction SilentlyContinue
    if ($null -eq $taskProcess) { return $null }
    $taskCommandLine = [string]$taskProcess.CommandLine
    if ($taskProcess.Name -ieq 'node.exe' -and
        $taskCommandLine.IndexOf($taskServerPath, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $taskProcess
    }
    return $null
}

function Show-CalculatorMessage([string]$taskMessage, [bool]$taskIsError = $false) {
    Add-Type -AssemblyName System.Windows.Forms
    $taskIcon = if ($taskIsError) { [System.Windows.Forms.MessageBoxIcon]::Error } else { [System.Windows.Forms.MessageBoxIcon]::Information }
    [System.Windows.Forms.MessageBox]::Show($taskMessage, '绝区零计算器', [System.Windows.Forms.MessageBoxButtons]::OK, $taskIcon) | Out-Null
}

try {
    try {
        $taskLocked = $taskMutex.WaitOne(30000)
    } catch [System.Threading.AbandonedMutexException] {
        $taskLocked = $true
    }
    if (-not $taskLocked) { throw '另一个启动操作仍在进行，请稍后再次打开。' }

    $taskListeners = @(Get-CalculatorListeners)
    if ($Stop) {
        $taskStopped = 0
        foreach ($taskProcessId in $taskListeners) {
            $taskOwned = Get-OwnedCalculatorProcess $taskProcessId
            if ($null -ne $taskOwned) {
                Stop-Process -Id $taskProcessId -Force -ErrorAction Stop
                $taskStopped += 1
            }
        }
        if (Test-Path -LiteralPath $taskStatePath) {
            Remove-Item -LiteralPath $taskStatePath -Force
        }
        if (-not $Quiet) {
            $taskMessage = if ($taskStopped -gt 0) { '本地计算器服务已关闭。' } else { '本地计算器服务当前没有运行。' }
            Show-CalculatorMessage $taskMessage
        }
        Write-Output 'STOPPED'
        exit 0
    }

    foreach ($taskProcessId in $taskListeners) {
        if ($null -eq (Get-OwnedCalculatorProcess $taskProcessId)) {
            throw '本地端口 8787 已被其他程序占用。请关闭占用该端口的程序，再打开计算器。'
        }
    }

    $taskHealth = Get-CalculatorHealth
    if ($null -eq $taskHealth -or $taskHealth.ok -ne $true -or $taskHealth.service -ne 'zzz_calculator') {
        if ($taskListeners.Count -gt 0) {
            throw '计算器服务已启动但未就绪。可先运行文件夹内的“关闭计算器”，再重新打开。'
        }
        if (-not (Test-Path -LiteralPath $taskIndexPath)) {
            throw '找不到已构建的页面。请在计算器文件夹执行 npm run build:webapp。'
        }
        if (-not (Test-Path -LiteralPath $taskNodePath)) {
            $taskNodePath = (Get-Command node.exe -ErrorAction Stop).Source
        }
        $env:PORT = '8787'
        $env:HOST = '127.0.0.1'
        $env:NODE_ENV = 'development'
        $taskStarted = Start-Process -FilePath $taskNodePath -ArgumentList ('"' + $taskServerPath + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput $taskOutputPath -RedirectStandardError $taskErrorPath -PassThru
        [ordered]@{
            processId = $taskStarted.Id
            serverPath = $taskServerPath
            url = $taskUrl
            startedAt = [DateTimeOffset]::Now.ToString('o')
        } | ConvertTo-Json | Set-Content -LiteralPath $taskStatePath -Encoding UTF8

        $taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
        do {
            $taskHealth = Get-CalculatorHealth
            if ($null -ne $taskHealth -and $taskHealth.ok -eq $true -and $taskHealth.service -eq 'zzz_calculator') { break }
            $taskStarted.Refresh()
            if ($taskStarted.HasExited) {
                $taskDetails = if (Test-Path -LiteralPath $taskErrorPath) { (Get-Content -LiteralPath $taskErrorPath -Tail 12) -join [Environment]::NewLine } else { '' }
                throw ('计算器启动失败。' + [Environment]::NewLine + $taskDetails)
            }
            Start-Sleep -Milliseconds 300
        } while ([DateTime]::UtcNow -lt $taskDeadline)
        if ($null -eq $taskHealth -or $taskHealth.ok -ne $true -or $taskHealth.service -ne 'zzz_calculator') {
            throw '计算器启动超时。日志保存在 .local-runtime 文件夹。'
        }
    }

    if (-not $NoBrowser) { Start-Process -FilePath $taskUrl }
    Write-Output ('READY ' + $taskUrl)
} catch {
    $_ | Out-String | Add-Content -LiteralPath (Join-Path $PSScriptRoot 'launcher-error.log') -Encoding UTF8
    if ($NoBrowser -or $Quiet) {
        Write-Error $_ -ErrorAction Continue
    } else {
        Show-CalculatorMessage ([string]$_.Exception.Message) $true
    }
    exit 1
} finally {
    if ($taskLocked) { $taskMutex.ReleaseMutex() }
    $taskMutex.Dispose()
}
