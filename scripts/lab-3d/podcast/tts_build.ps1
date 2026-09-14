param([string]$Script, [string]$OutDir)
# Synthesize every spoken line of a podcast script (JSON) with the Windows WinRT voices, one WAV per line.
# Lines are numbered in order of appearance: line_000.wav, line_001.wav ...
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$doc = [IO.File]::ReadAllText($Script, [Text.Encoding]::UTF8) | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$voices = @{}
foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) { $voices[$v.DisplayName] = $v }
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$i = 0
foreach ($item in $doc.items) {
  if (-not $item.s) { continue }
  $voiceName = $doc.voices.($item.s)
  if (-not $voices.ContainsKey($voiceName)) { throw "voice not found: $voiceName" }
  $synth.Voice = $voices[$voiceName]
  $rate = $doc.rate.($item.s)
  $text = if ($item.say) { $item.say } else { $item.t }
  $escaped = [System.Security.SecurityElement]::Escape($text)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$($doc.xmllang)'><prosody rate='$rate'>$escaped</prosody></speak>"
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$stream.Size
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  [void](Await ($reader.LoadAsync($size)) ([uint32]))
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes((Join-Path $OutDir ('line_{0:D3}.wav' -f $i)), $bytes)
  $reader.Dispose()
  $stream.Dispose()
  $i++
}
"wrote $i lines"
