# Step 2: read shapes.txt (from pdf-shapes.ps1) and print, per bar, every notehead as pitch + kind + x offset:
# '*' filled (quarter or shorter), 'o' hollow (half/whole), '.' dotted; @x = horizontal position inside the bar.
# Assumes a grand staff (treble over bass), no key signature. Ledger notes far between the staves can land in the
# wrong hand: check them. Rhythm, ties, beams and rests still come from reading the score.
# Usage: .\pdf-notes.ps1 -dir <folder with shapes.txt>
param([string]$dir)
$rows = Get-Content "$dir\shapes.txt" | ForEach-Object {
  $p = $_ -split ' '
  [pscustomobject]@{ pg=[int]$p[0]; n=[int]$p[6]; x0=[double]$p[2]; y0=[double]$p[3]; x1=[double]$p[4]; y1=[double]$p[5];
    w=[double]$p[4]-[double]$p[2]; h=[double]$p[5]-[double]$p[3] }
}
$names = 'C','D','E','F','G','A','B'
function StepName([int]$diat) { # diatonic index from C0
  $o = [math]::Floor($diat / 7); $names[$diat - 7*$o] + $o
}
$TREBLE_BOTTOM = 4*7 + 2   # E4
$BASS_BOTTOM = 2*7 + 4     # G2
$measure = 0
foreach ($pg in 1..4) {
  $R = $rows | Where-Object pg -eq $pg
  # staff line segments: thin (h~0.6) 4-point fills, wider than 40
  $lines = $R | Where-Object { $_.n -eq 4 -and $_.h -lt 0.7 -and $_.w -gt 40 }
  $ys = $lines | ForEach-Object { [math]::Round($_.y0, 1) } | Sort-Object -Unique
  # group into staves of 5 lines (spacing 6)
  $staves = @(); $cur = @()
  foreach ($y in $ys) { if ($cur.Count -and ($y - $cur[-1]) -gt 7) { $staves += ,@($cur); $cur = @() }; $cur += $y }
  if ($cur.Count) { $staves += ,@($cur) }
  $heads = $R | Where-Object { ($_.n -eq 25 -or $_.n -eq 51) -and $_.w -gt 7 -and $_.w -lt 9 -and $_.h -lt 7 }
  $dots = $R | Where-Object { $_.n -eq 13 -and $_.w -lt 2.5 }
  for ($si = 0; $si -lt $staves.Count; $si += 2) {
    $tr = $staves[$si]; $bs = $staves[$si+1]
    # measures from staff-line segments on the top line of the treble staff
    $segs = $lines | Where-Object { [math]::Abs($_.y0 - $tr[0]) -lt 0.3 -and $_.w -gt 60 } | Sort-Object x0
    # skip the first segment if it is the clef/key area (contains no heads)
    foreach ($sg in $segs) {
      $inM = $heads | Where-Object { $_.x0 -ge $sg.x0 -and $_.x1 -le $sg.x1 -and $_.y0 -gt $tr[0]-40 -and $_.y1 -lt $bs[4]+40 }
      $hasRest = $R | Where-Object { $_.x0 -ge $sg.x0 -and $_.x1 -le $sg.x1 -and (($_.n -eq 45) -or ($_.n -eq 5 -and $_.w -gt 7 -and $_.w -lt 8 -and $_.h -lt 3.5)) }
      if (-not $inM -and -not $hasRest) { continue }
      $measure++
      $mid = ($tr[4] + $bs[0]) / 2
      $out = @()
      foreach ($staff in 'RH','LH') {
        $items = $inM | Where-Object { if ($staff -eq 'RH') { ($_.y0+$_.y1)/2 -lt $mid } else { ($_.y0+$_.y1)/2 -ge $mid } } | Sort-Object x0
        $txt = foreach ($hd in $items) {
          $cy = ($hd.y0 + $hd.y1) / 2
          if ($staff -eq 'RH') { $steps = [math]::Round(($tr[4] + 0.3 - $cy) / 3); $nm = StepName ($TREBLE_BOTTOM + $steps) }
          else { $steps = [math]::Round(($bs[4] + 0.3 - $cy) / 3); $nm = StepName ($BASS_BOTTOM + $steps) }
          $dot = $dots | Where-Object { $_.x0 -gt $hd.x1 -and $_.x0 -lt $hd.x1 + 6 -and [math]::Abs(($_.y0+$_.y1)/2 - $cy) -lt 3.5 }
          $kind = if ($hd.n -eq 51) { 'o' } else { '*' }
          "{0}{1}{2}@{3:F0}" -f $nm, $kind, $(if ($dot) { '.' } else { '' }), ($hd.x0 - $sg.x0)
        }
        $out += "  ${staff}: " + ($txt -join ' ')
      }
      "m$measure (p$pg x=$([math]::Round($sg.x0))-$([math]::Round($sg.x1)) w=$([math]::Round($sg.w)))"
      $out
    }
  }
}
