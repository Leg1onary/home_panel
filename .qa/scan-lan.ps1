$targets = @('192.168.8.204:2020','192.168.8.204:80','192.168.8.204:554','192.168.8.182:8123','192.168.8.182:8090')
foreach($t in $targets){
  $parts = $t -split ':'
  $c = New-Object System.Net.Sockets.TcpClient
  try { $ok = $c.ConnectAsync($parts[0],[int]$parts[1]).Wait(2500); "$t -> $ok" } catch { "$t -> err" } finally { $c.Close() }
}
