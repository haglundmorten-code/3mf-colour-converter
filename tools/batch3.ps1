# Exports INDX 8T projects from PrusaSlicer 3.0 with 8 candidate filaments per run (one per tool).
# A run that names a missing/incompatible profile drops that profile and retries.
$sp = "C:\Users\Morten\AppData\Local\Temp\claude\E--Bambu-fix\a09e335c-06b9-486b-9c7d-e4b8b813340b\scratchpad"
$exe = "C:\Users\Morten\Documents\PrusaSlicer-3.0.0-alpha11\PrusaSlicer.exe"
$dir = "$sp\ft\b3"; New-Item -ItemType Directory -Force $dir | Out-Null
$queue = [System.Collections.ArrayList]@((Get-Content "$sp\ft\cand3.json" -Raw -Encoding UTF8 | ConvertFrom-Json) | ForEach-Object { $_.cli })
$failed = @(); $n = 0
while ($queue.Count -gt 0) {
  $take = @($queue | Select-Object -First 8)
  $mats = $take + @($take[0]) * (8 - $take.Count)
  $out = "$dir\b$n.3mf"
  $pn = 'Prusa CORE One INDX 8T 0.4 HF, 0.4 HF, 0.4 HF, 0.4 HF, 0.4 HF, 0.4 HF, 0.4 HF, 0.4 HF'
  $a = @('--datadir', "`"$sp\dd3`"", '--no-single-instance', '--loglevel', '2', '--printer-profile', "`"$pn`"", '--print-profile', '0.20mm')
  $star = [char]0x2605  # the script file is read as ANSI, so no literal non-ASCII here
  foreach ($i in 1..8) { $a += @('--tool-print-profile', "`"0.20mm Balanced $star @COREONEINDX 0.4HF`"") }
  foreach ($m in $mats) { $a += @('--material-profile', "`"$m`"") }
  $a += @('--export-3mf', '-o', "`"$out`"", "`"$sp\t3\b0.3mf`"")
  Remove-Item $out -ErrorAction SilentlyContinue
  $p = Start-Process $exe -ArgumentList $a -PassThru -WindowStyle Hidden -RedirectStandardOutput "$dir\b$n.log" -RedirectStandardError "$dir\b$n.err"
  [void]$p.WaitForExit(180000)
  if (Test-Path $out) {
    $take | Set-Content -Encoding utf8 "$dir\b$n.txt"
    foreach ($t in $take) { $queue.Remove($t) }
    "ok b$n ($($take.Count)) left $($queue.Count)"
    $n++
  } else {
    $err = (Get-Content "$dir\b$n.err" -Raw)
    $bad = $take | Where-Object { $err -and $err.Contains("'$_'") } | Select-Object -First 1
    if (-not $bad) { "unknown failure in b$n, stopping"; break }
    "drop: $bad"
    $failed += $bad; $queue.Remove($bad)
  }
}
$failed | Set-Content -Encoding utf8 "$dir\failed.txt"
"done: $n batches, $($failed.Count) failed"
