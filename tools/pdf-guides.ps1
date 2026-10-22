# For PDFs whose notes are font glyphs (pdf-shapes.ps1 finds nothing): takes a page rendered to PNG (pdf.js in
# headless Chrome, scale 3) and writes, per system, 2x enlarged slices with every staff line and space labelled with
# its pitch. Usage: .\pdf-guides.ps1 -png page.png -prefix <scratch>\p1 -clefs "TB,TB,..." [-dark 170] [-frac 0.55]
# clefs: per system, upper + lower staff (T = treble, B = bass). -dark: raise for light grey staff lines.
# Check each slice: if the labelled lines do not sit on the drawn staff lines, read relative to the drawn lines.
param([string]$png, [string]$prefix, [string]$clefs, [double]$frac = 0.55, [int]$dark = 110)
Add-Type -AssemblyName System.Drawing
$img = New-Object System.Drawing.Bitmap($png)
$W = $img.Width; $H = $img.Height
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $img.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
$img.UnlockBits($data)
# dark pixel count per row
$rows = New-Object int[] $H
for ($y = 0; $y -lt $H; $y++) {
  $c = 0; $o = $y * $stride
  for ($x = 0; $x -lt $W; $x += 2) { if ($buf[$o + 3 * $x] -lt $dark) { $c++ } }
  $rows[$y] = $c
}
$thr = ($W / 2) * $frac
$lineYs = @()
for ($y = 0; $y -lt $H; $y++) {
  if ($rows[$y] -gt $thr) {
    $y0 = $y; while ($y -lt $H -and $rows[$y] -gt $thr) { $y++ }
    $lineYs += (($y0 + $y - 1) / 2)
  }
}
# group into staves of 5
$staves = @(); $cur = @()
foreach ($y in $lineYs) {
  if ($cur.Count -and ($y - $cur[-1]) -gt 40) { $staves += ,@($cur); $cur = @() }
  $cur += $y
}
if ($cur.Count) { $staves += ,@($cur) }
# drop stray lines (hairpins, long beams) that are not part of a five-line staff
$keep = @()
foreach ($st in $staves) {
  if ($st.Count -eq 5) { $keep += ,@($st); continue }
  # more lines than a staff (beams or ledger-like strokes nearby): take each run of 5 evenly spaced lines
  for ($i = 0; $i + 4 -lt $st.Count; $i++) {
    $g = @(1..4 | ForEach-Object { $st[$i + $_] - $st[$i + $_ - 1] })
    $mn = ($g | Measure-Object -Minimum).Minimum; $mx = ($g | Measure-Object -Maximum).Maximum
    if ($mn -ge 10 -and $mx - $mn -le 3) { $keep += ,@($st[$i..($i + 4)]); $i += 4 }
  }
}
$staves = $keep
"staves: " + ($staves | ForEach-Object { '[' + (($_ | ForEach-Object { [math]::Round($_) }) -join ',') + ']' }) -join ' '
$names = 'C','D','E','F','G','A','B'
function StepName([int]$d) { $o = [math]::Floor($d / 7); $names[$d - 7 * $o] + $o }
$clefList = $clefs -split ','
$sysIdx = 0
for ($si = 0; $si + 1 -lt $staves.Count; $si += 2) {
  $up = $staves[$si]; $lo = $staves[$si + 1]
  if ($up.Count -ne 5 -or $lo.Count -ne 5) { "skip system at $($up[0])"; continue }
  $cl = $clefList[$sysIdx]; if (-not $cl) { $cl = 'TB' }
  $top = [int]($up[0] - 90); $bot = [int]($lo[4] + 90)
  if ($top -lt 0) { $top = 0 }; if ($bot -gt $H) { $bot = $H }
  $sysIdx++
  $sliceW = 440; $Z = 2; $M = 56
  $piece = 0
  for ($x0 = 150; $x0 -lt $W - 60; $x0 += $sliceW - 30) {
    $piece++
    $cw = [math]::Min($sliceW, $W - $x0)
    $hh = $bot - $top
    $out = New-Object System.Drawing.Bitmap(($cw * $Z + $M), ($hh * $Z))
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle($M, 0, ($cw * $Z), ($hh * $Z))), (New-Object System.Drawing.Rectangle($x0, $top, $cw, $hh)), [System.Drawing.GraphicsUnit]::Pixel)
    $font = New-Object System.Drawing.Font('Arial', 8, [System.Drawing.FontStyle]::Bold)
    foreach ($k in 0, 1) {
      $st = @($up, $lo)[$k]; $clef = $cl[$k]
      $bottomStep = if ($clef -eq 'T') { 4 * 7 + 2 } else { 2 * 7 + 4 }
      $sp = ($st[4] - $st[0]) / 8
      for ($s = -7; $s -le 15; $s++) {
        $yy = ($st[4] - $s * $sp - $top) * $Z
        $isLine = ($s % 2 -eq 0)
        $col = if ($isLine) { [System.Drawing.Color]::FromArgb(60, 255, 0, 0) } else { [System.Drawing.Color]::FromArgb(40, 0, 90, 255) }
        $g.DrawLine((New-Object System.Drawing.Pen($col, 1)), $M, [float]$yy, ($cw * $Z + $M), [float]$yy)
        $brush = if ($isLine) { [System.Drawing.Brushes]::Red } else { [System.Drawing.Brushes]::Blue }
        $g.DrawString((StepName($bottomStep + $s)), $font, $brush, [float]$(if ($s % 2 -ne 0) { 28 } else { 2 }), [float]($yy - 7))
      }
    }
    $out.Save("$prefix-s$sysIdx-$piece.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $out.Dispose()
  }
}
$img.Dispose()
