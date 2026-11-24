"""Masaustu ve Baslat Menusu MEIRCHAT.lnk kisayollarini Turkce/bosluklu yollarla %100 uyumlu olusturur."""
import os
import sys
import base64
import shutil
import subprocess


def create_windows_shortcuts(app_dir: str):
    app_dir = os.path.abspath(app_dir)
    pyw_exe = os.path.join(app_dir, "venv", "Scripts", "pythonw.exe")
    if not os.path.isfile(pyw_exe):
        pyw_exe = shutil.which("pythonw") or os.path.join(app_dir, "venv", "Scripts", "python.exe")
    app_script = os.path.join(app_dir, "meirchat_app.pyw")
    icon_path = os.path.join(app_dir, "static", "meirchat.ico")

    ps_lines = [
        "$ws = New-Object -ComObject WScript.Shell",
        "$desk = [Environment]::GetFolderPath('Desktop')",
        "$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'",
        "$targets = @($desk, $start) | Where-Object { $_ -and (Test-Path $_) }",
        "foreach ($dir in $targets) {",
        "    $lnkPath = Join-Path $dir 'MEIRCHAT.lnk'",
        "    $lnk = $ws.CreateShortcut($lnkPath)",
        "    $lnk.TargetPath = $env:MEIR_PYW",
        "    $lnk.Arguments = '"' + $env:MEIR_SCRIPT + '"'",
        "    $lnk.WorkingDirectory = $env:MEIR_DIR",
        "    if (Test-Path $env:MEIR_ICON) { $lnk.IconLocation = $env:MEIR_ICON }",
        "    $lnk.Description = 'MEIRCHAT - Yerel Rol Yapma Uygulamasi'",
        "    $lnk.Save()",
        "    Write-Output ('OK: ' + $lnkPath)",
        "}",
    ]
    ps_script = "\r\n".join(ps_lines)
    enc = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")
    env = os.environ.copy()
    env["MEIR_PYW"] = pyw_exe
    env["MEIR_SCRIPT"] = app_script
    env["MEIR_DIR"] = app_dir
    env["MEIR_ICON"] = icon_path

    res = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", enc],
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    if res.stdout:
        print(res.stdout.strip())
    if res.returncode != 0:
        print("Kisayol olusturma hatasi:", res.stderr)
        sys.exit(res.returncode)


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    create_windows_shortcuts(base)
