# Step 1 of turning a sheet music PDF into a song: dump every vector shape (noteheads, staff lines, ties, dots)
# with its bounding box in page coordinates (y down) to shapes.txt. Works on PDFs exported from notation software
# (MuseScore etc.), where the music is drawn as paths. Usage: .\pdf-shapes.ps1 -pdf song.pdf -outDir <folder>
param([string]$pdf, [string]$outDir)
$enc = [Text.Encoding]::GetEncoding(28591)
$bytes = [IO.File]::ReadAllBytes($pdf)
$s = $enc.GetString($bytes)

# --- objects: number -> @{dict; data}
$objs = @{}
foreach ($m in [regex]::Matches($s, '(?m)^(\d+) 0 obj')) {
  $num = [int]$m.Groups[1].Value
  $start = $m.Index + $m.Length
  $endobj = $s.IndexOf('endobj', $start)
  $body = $s.Substring($start, $endobj - $start)
  $si = $body.IndexOf('stream')
  $o = @{ dict = $body; text = $null }
  if ($si -ge 0 -and $body.Substring(0, $si) -match 'FlateDecode') {
    $ds0 = $start + $si + 6
    if ($s[$ds0] -eq "`r") { $ds0++ }
    if ($s[$ds0] -eq "`n") { $ds0++ }
    $de = $s.IndexOf('endstream', $ds0)
    $data = New-Object byte[] ($de - $ds0 - 2)
    [Array]::Copy($bytes, $ds0 + 2, $data, 0, $data.Length)
    try {
      $ms = New-Object IO.MemoryStream(,$data)
      $z = New-Object IO.Compression.DeflateStream($ms, [IO.Compression.CompressionMode]::Decompress)
      $o.text = (New-Object IO.StreamReader($z, $enc)).ReadToEnd()
    } catch { }
    $o.dict = $body.Substring(0, $si)
  }
  $objs[$num] = $o
}

function Mul($a, $b) { # a then b  (row-vector convention: p * a * b)
  @(
    ($a[0]*$b[0] + $a[1]*$b[2]), ($a[0]*$b[1] + $a[1]*$b[3]),
    ($a[2]*$b[0] + $a[3]*$b[2]), ($a[2]*$b[1] + $a[3]*$b[3]),
    ($a[4]*$b[0] + $a[5]*$b[2] + $b[4]), ($a[4]*$b[1] + $a[5]*$b[3] + $b[5])
  )
}

$script:out = New-Object System.Collections.Generic.List[string]

function Run([string]$content, $ctm, $xobjMap, [int]$page) {
  $stack = New-Object System.Collections.Stack
  $nums = New-Object System.Collections.Generic.List[double]
  $pts = New-Object System.Collections.Generic.List[double[]]
  $lw = 1
  foreach ($tok in [regex]::Matches($content, '/[^\s/\[\]<>()]+|<[0-9a-fA-F]*>|[-+]?\d*\.?\d+|[A-Za-z\*''"]+')) {
    $t = $tok.Value
    if ($t -match '^[-+]?\d*\.?\d+$') { $nums.Add([double]$t); continue }
    if ($t.StartsWith('/')) { $script:lastName = $t; continue }
    if ($t.StartsWith('<')) { continue }
    switch -CaseSensitive ($t) {
      'q' { $stack.Push(@($ctm, $lw)) }
      'Q' { $p = $stack.Pop(); $ctm = $p[0]; $lw = $p[1] }
      'cm' { $ctm = Mul @($nums[0],$nums[1],$nums[2],$nums[3],$nums[4],$nums[5]) $ctm }
      'w' { $lw = $nums[0] }
      { $_ -in 'm','l' } { $x=$nums[0];$y=$nums[1]; $pts.Add(@(($x*$ctm[0]+$y*$ctm[2]+$ctm[4]), ($x*$ctm[1]+$y*$ctm[3]+$ctm[5]))) }
      'c' { for ($k=0;$k -lt 6;$k+=2){ $x=$nums[$k];$y=$nums[$k+1]; $pts.Add(@(($x*$ctm[0]+$y*$ctm[2]+$ctm[4]), ($x*$ctm[1]+$y*$ctm[3]+$ctm[5]))) } }
      're' { $x=$nums[0];$y=$nums[1];$w=$nums[2];$h=$nums[3]
             foreach ($c in @(@($x,$y),@(($x+$w),($y+$h)))) { $pts.Add(@(($c[0]*$ctm[0]+$c[1]*$ctm[2]+$ctm[4]), ($c[0]*$ctm[1]+$c[1]*$ctm[3]+$ctm[5]))) } }
      { $_ -in 'f','f*','S','B','B*','b','n','s' } {
        if ($pts.Count -gt 0 -and $t -ne 'n') {
          $xs = $pts | ForEach-Object { $_[0] }; $ys = $pts | ForEach-Object { $_[1] }
          $x0 = ($xs | Measure-Object -Minimum).Minimum; $x1 = ($xs | Measure-Object -Maximum).Maximum
          $y0 = ($ys | Measure-Object -Minimum).Minimum; $y1 = ($ys | Measure-Object -Maximum).Maximum
          $script:out.Add(("{0} {1} {2:F2} {3:F2} {4:F2} {5:F2} {6} lw={7}" -f $page, $t, $x0, (792-$y1), $x1, (792-$y0), $pts.Count, $lw))
        }
        $pts.Clear()
      }
      'Do' {
        $name = $script:lastName.Substring(1)
        if ($xobjMap.ContainsKey($name)) {
          $xo = $objs[$xobjMap[$name]]
          $mx = @(1,0,0,1,0,0)
          if ($xo.dict -match '/Matrix\s*\[\s*([-\d\.\s]+)\]') { $mx = ($Matches[1].Trim() -split '\s+') | ForEach-Object { [double]$_ } }
          Run $xo.text (Mul $mx $ctm) $xobjMap $page
        }
      }
    }
    $nums.Clear()
  }
}

$pageNum = 0
foreach ($k in ($objs.Keys | Sort-Object)) {
  $o = $objs[$k]
  if ($o.dict -match '/Type\s*/Page\b' -and $o.dict -match '/Contents\s+(\d+) 0 R') {
    $pageNum++
    $content = $objs[[int]$Matches[1]].text
    $o.dict -match '/Resources\s+(\d+) 0 R' | Out-Null
    $res = $objs[[int]$Matches[1]].dict
    $map = @{}
    foreach ($xm in [regex]::Matches($res, '/(G\d+)\s+(\d+) 0 R')) { $map[$xm.Groups[1].Value] = [int]$xm.Groups[2].Value }
    Write-Host "page $pageNum obj $k content len $($content.Length) xobjs $($map.Keys -join ',')"
    Run $content @(1,0,0,1,0,0) $map $pageNum
  }
}
[IO.File]::WriteAllLines("$outDir\shapes.txt", $script:out)
Write-Host "shapes: $($script:out.Count)"
