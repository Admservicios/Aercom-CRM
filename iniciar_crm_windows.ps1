# Servidor de archivos local. Compatible con Windows PowerShell 5.1; sin Python.
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion -lt [version]'5.1') {
    Write-Host 'Se necesita Windows PowerShell 5.1 o posterior.'
    exit 1
}
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$port = 8000

function Send-CRMResponse {
    param($Stream, [int]$Status, [string]$Reason, [byte[]]$Body,
          [string]$ContentType = 'text/plain; charset=utf-8', [bool]$HeadOnly = $false)
    if ([string]::IsNullOrEmpty($ContentType)) { $ContentType = 'text/plain; charset=utf-8' }
    $headers = "HTTP/1.1 $Status $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nAllow: GET, HEAD`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($bytes, 0, $bytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}

function Serve-CRMRequest {
    param($Stream)
    $reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    try {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { return }
        $request = $line.Split([char]' ')
        if ($request.Length -ne 3 -or $line.Length -gt 8192) {
            Send-CRMResponse $Stream 400 'Bad Request' ([byte[]]@())
            return
        }
        $headerSize = 0
        while ($true) {
            $header = $reader.ReadLine()
            if ($null -eq $header) { return }
            if ($header.Length -eq 0) { break }
            $headerSize += $header.Length
            if ($headerSize -gt 16384) {
                Send-CRMResponse $Stream 431 'Request Header Fields Too Large' ([byte[]]@())
                return
            }
        }
        $head = $request[0] -eq 'HEAD'
        if ($request[0] -notin @('GET', 'HEAD')) {
            Send-CRMResponse $Stream 405 'Method Not Allowed' ([byte[]]@())
            return
        }
        $target = $request[1].Split([char]'?')[0]
        if (-not $target.StartsWith('/') -or $target.StartsWith('//')) {
            Send-CRMResponse $Stream 400 'Bad Request' ([byte[]]@()) '' $head
            return
        }
        $decoded = [System.Uri]::UnescapeDataString($target)
        $relative = $decoded.TrimStart([char]'/')
        if ($relative.Length -eq 0) { $relative = 'index.html' }
        $segments = $relative.Split([char]'/')
        $hidden = @($segments | Where-Object { $_.StartsWith('.') })
        if ($decoded.Contains('\') -or $decoded.Contains([string][char]0) -or $relative.Contains(':') -or
            $hidden.Length -gt 0 -or $segments[0] -notin @('index.html', 'js', 'css', 'img')) {
            Send-CRMResponse $Stream 403 'Forbidden' ([byte[]]@()) '' $head
            return
        }
        $path = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))
        if (-not $path.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-CRMResponse $Stream 403 'Forbidden' ([byte[]]@()) '' $head
            return
        }
        # No seguir enlaces o junctions que puedan salir de los recursos del paquete.
        $cursor = $root
        foreach ($segment in $segments) {
            $cursor = [System.IO.Path]::Combine($cursor, $segment)
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
            if ($null -eq $item) {
                Send-CRMResponse $Stream 404 'Not Found' ([byte[]]@()) '' $head
                return
            }
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                Send-CRMResponse $Stream 403 'Forbidden' ([byte[]]@()) '' $head
                return
            }
        }
        if (-not [System.IO.File]::Exists($path)) {
            Send-CRMResponse $Stream 404 'Not Found' ([byte[]]@()) '' $head
            return
        }
        $mime = switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
            '.html' { 'text/html; charset=utf-8' }
            '.js'   { 'text/javascript; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.png'  { 'image/png' }
            '.jpg'  { 'image/jpeg' }
            '.jpeg' { 'image/jpeg' }
            '.svg'  { 'image/svg+xml' }
            '.ico'  { 'image/x-icon' }
            '.gif'  { 'image/gif' }
            '.woff' { 'font/woff' }
            '.woff2'{ 'font/woff2' }
            default { 'application/octet-stream' }
        }
        $body = [System.IO.File]::ReadAllBytes($path)
        Send-CRMResponse $Stream 200 'OK' $body $mime $head
    } finally {
        $reader.Dispose()
    }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
    $listener.Start()
} catch {
    Write-Host 'No se pudo abrir 127.0.0.1:8000. Puede haber otra instancia abierta.'
    Write-Host 'Cerra la otra ventana del servidor y reintenta. No se cambia el puerto para conservar el origen de tus datos.'
    exit 1
}
Write-Host 'Aercom CRM: http://127.0.0.1:8000/'
Write-Host 'Deja esta ventana abierta mientras trabajas. Cerrarla detiene el servidor, sin borrar datos.'
Write-Host 'Usa siempre el mismo navegador y perfil. Conserva respaldos JSON fuera del navegador.'
if (-not $NoBrowser) {
    try { Start-Process 'http://127.0.0.1:8000/' } catch { Write-Host 'Abri esa direccion manualmente en Chrome o Edge.' }
}
try {
    while ($true) {
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 40; continue }
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 5000
            $stream.WriteTimeout = 5000
            try { Serve-CRMRequest $stream } catch {
                # Una conexion cortada no debe detener el servidor ni mostrar rutas privadas.
                try { Send-CRMResponse $stream 400 'Bad Request' ([byte[]]@()) } catch {}
            }
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
