[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$boardDirectory = [System.IO.Path]::GetFullPath($PSScriptRoot)
$launcherPath = Join-Path $boardDirectory 'Launch-Questboard.ps1'
$powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'Questboard.lnk'

if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw ('Questboard launcher is missing: {0}' -f $launcherPath)
}
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nodeCommand) { throw 'Node.js 20 or newer is required before installing Questboard autostart.' }
$nodePath = $nodeCommand.Source
$nodeVersion = & $nodePath --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
    throw ('Node.js 20 or newer is required; found {0}.' -f $nodeVersion)
}
$executionPolicy = & $powerShellPath -NoLogo -NoProfile -NonInteractive -Command 'Get-ExecutionPolicy'
if ($LASTEXITCODE -ne 0 -or $executionPolicy -in @('Restricted', 'AllSigned')) {
    throw ('Windows PowerShell policy ({0}) does not permit this unsigned local launcher. No startup entry or execution policy was changed.' -f $executionPolicy)
}

$shortcutArguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -NodePath "{1}"' -f $launcherPath, $nodePath
$registration = [PSCustomObject]@{
    Shortcut = $shortcutPath
    TargetPath = $powerShellPath
    Arguments = $shortcutArguments
    WorkingDirectory = $boardDirectory
    Opens = 'http://127.0.0.1:4173'
    ExecutionPolicy = [string]$executionPolicy
}

# WScript.Shell converts these fields through the system ANSI code page on
# some Windows installations. Use IShellLinkW explicitly to preserve Unicode.
if (-not ('Questboard.Windows.Shortcut' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

namespace Questboard.Windows {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    internal class ShellLink { }

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int capacity, IntPtr findData, uint flags);
        void GetIDList(out IntPtr itemList);
        void SetIDList(IntPtr itemList);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder description, int capacity);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string description);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder directory, int capacity);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder arguments, int capacity);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int command);
        void SetShowCmd(int command);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int capacity, out int iconIndex);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int iconIndex);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }

    public sealed class ShortcutInfo {
        public string TargetPath { get; set; }
        public string Arguments { get; set; }
        public string WorkingDirectory { get; set; }
    }

    public static class Shortcut {
        public static ShortcutInfo Read(string shortcutPath) {
            object instance = new ShellLink();
            try {
                ((IPersistFile)instance).Load(shortcutPath, 0);
                IShellLinkW link = (IShellLinkW)instance;
                StringBuilder target = new StringBuilder(32768);
                StringBuilder arguments = new StringBuilder(32768);
                StringBuilder directory = new StringBuilder(32768);
                link.GetPath(target, target.Capacity, IntPtr.Zero, 4);
                link.GetArguments(arguments, arguments.Capacity);
                link.GetWorkingDirectory(directory, directory.Capacity);
                return new ShortcutInfo {
                    TargetPath = target.ToString(),
                    Arguments = arguments.ToString(),
                    WorkingDirectory = directory.ToString()
                };
            }
            finally { Marshal.FinalReleaseComObject(instance); }
        }

        public static void SaveVerified(string shortcutPath, string target, string arguments, string directory) {
            object instance = new ShellLink();
            try {
                IShellLinkW link = (IShellLinkW)instance;
                link.SetPath(target);
                link.SetArguments(arguments);
                link.SetWorkingDirectory(directory);
                link.SetDescription("Start Questboard locally and open the board at Windows login.");
                link.SetShowCmd(7);
                ((IPersistFile)instance).Save(shortcutPath, true);
            }
            finally { Marshal.FinalReleaseComObject(instance); }

            ShortcutInfo saved = Read(shortcutPath);
            if (!String.Equals(saved.TargetPath, target, StringComparison.OrdinalIgnoreCase) ||
                !String.Equals(saved.Arguments, arguments, StringComparison.Ordinal) ||
                !String.Equals(saved.WorkingDirectory, directory, StringComparison.Ordinal)) {
                throw new InvalidOperationException("The saved Questboard shortcut did not preserve its paths and arguments.");
            }
        }
    }
}
'@
}

if ($PSCmdlet.ShouldProcess($shortcutPath, 'Install Questboard for this user at Windows login')) {
    [System.IO.Directory]::CreateDirectory($startupDirectory) | Out-Null
    [Questboard.Windows.Shortcut]::SaveVerified($shortcutPath, $powerShellPath, $shortcutArguments, $boardDirectory)
    Write-Output 'Questboard will start and open in your default browser the next time you sign in to Windows.'
}
$registration
