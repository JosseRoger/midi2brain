# Downloads the Salamander Grand Piano velocity layers used by the sampled piano (js/audio.js) into samples/piano/,
# cut to at most -seconds (at an MP3 frame boundary, so no re-encoding; the app fades the cut out).
# Source: the full-length MP3s from Tone.js's Piano (https://github.com/tambien/Piano), Salamander V3 by Alexander Holm, CC-BY 3.0.
# -release: instead, the key-release noises (the damper landing), rel1..rel88 = A0..C8, saved as rel<midi>.mp3 (~0.9 MB).
param([int[]]$layers = @(4, 8, 12, 16), [double]$seconds = 10, [string]$outDir = "$PSScriptRoot\..\samples\piano", [switch]$release)

if ($release) {
  New-Item -ItemType Directory -Force $outDir | Out-Null
  for ($k = 1; $k -le 88; $k++) {
    Invoke-WebRequest "https://tambien.github.io/Piano/audio/rel$k.mp3" -UseBasicParsing -OutFile "$outDir\rel$($k + 20).mp3"
  }
  return
}

$names = 'C', 'Ds', 'Fs', 'A'
$rates = 0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320
$srs = 44100, 48000, 32000
New-Item -ItemType Directory -Force $outDir | Out-Null
$total = 0
for ($midi = 21; $midi -le 108; $midi += 3) {
  $note = $names[($midi % 12) / 3] + ([math]::Floor($midi / 12) - 1)
  foreach ($v in $layers) {
    $file = "$note" + "v$v.mp3"
    $d = (Invoke-WebRequest "https://tambien.github.io/Piano/audio/$file" -UseBasicParsing).Content
    $i = 0
    if ([Text.Encoding]::ASCII.GetString($d, 0, 3) -eq 'ID3') { $i = 10 + (($d[6] -shl 21) -bor ($d[7] -shl 14) -bor ($d[8] -shl 7) -bor $d[9]) }
    while (-not ($d[$i] -eq 0xFF -and ($d[$i + 1] -band 0xE0) -eq 0xE0)) { $i++ }
    $t = 0.0
    while ($i + 4 -le $d.Length -and $t -lt $seconds) { # walk MPEG-1 Layer III frames
      if (-not ($d[$i] -eq 0xFF -and ($d[$i + 1] -band 0xE0) -eq 0xE0)) { break }
      $sr = $srs[($d[$i + 2] -shr 2) -band 3]
      $len = [math]::Floor(144000 * $rates[$d[$i + 2] -shr 4] / $sr) + (($d[$i + 2] -shr 1) -band 1)
      $i += $len; $t += 1152 / $sr
    }
    $end = [math]::Min($i, $d.Length)
    [IO.File]::WriteAllBytes("$outDir\$file", $d[0..($end - 1)])
    $total += $end
  }
}
"{0:N1} MB in $outDir" -f ($total / 1MB)
