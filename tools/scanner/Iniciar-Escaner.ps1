param(
    [string]$Origin = 'http://localhost:5173'
)

$ErrorActionPreference = 'Stop'
if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    throw 'Ejecuta este script con Windows PowerShell: powershell.exe -STA -File .\Iniciar-Escaner.ps1'
}
$originUri = $null
if (-not [Uri]::TryCreate($Origin, [UriKind]::Absolute, [ref]$originUri) -or
    $originUri.Scheme -notin @('http', 'https') -or $Origin -cne $originUri.GetLeftPart([UriPartial]::Authority)) {
    throw 'Origin debe contener solo el origen de la aplicacion, sin ruta ni barra final.'
}

Add-Type -AssemblyName System.Drawing
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$keyBytes = New-Object byte[] 32
$random.GetBytes($keyBytes)
$random.Dispose()
$key = [BitConverter]::ToString($keyBytes).Replace('-', '').ToLowerInvariant()

function Send-Json($Context, [int]$Status, $Value) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Compress))
    $Context.Response.StatusCode = $Status
    $Context.Response.ContentType = 'application/json; charset=utf-8'
    $Context.Response.Headers['Cache-Control'] = 'no-store'
    $Context.Response.Headers['X-Content-Type-Options'] = 'nosniff'
    $Context.Response.ContentLength64 = $bytes.Length
    try {
        $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
        $Context.Response.Close()
    }
}

function Get-Scan {
    $dialog = $null
    $image = $null
    $sourceStream = $null
    $source = $null
    $bitmap = $null
    $graphics = $null
    try {
        $dialog = New-Object -ComObject WIA.CommonDialog
        # WIA abre el selector/controlador del escaner y requiere confirmacion del usuario.
        $image = $dialog.ShowAcquireImage(1, 1, 131072, '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}', $true, $true, $false)
        if ($null -eq $image) { throw 'Escaneo cancelado en Windows.' }
        $bytes = [byte[]]$image.FileData.BinaryData
        $sourceStream = New-Object IO.MemoryStream(,$bytes)
        $source = [Drawing.Image]::FromStream($sourceStream)
        $scale = [Math]::Min(1, 1800.0 / [Math]::Max($source.Width, $source.Height))
        $bitmap = New-Object Drawing.Bitmap([int][Math]::Max(1, $source.Width * $scale), [int][Math]::Max(1, $source.Height * $scale))
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([Drawing.Color]::White)
        $graphics.DrawImage($source, 0, 0, $bitmap.Width, $bitmap.Height)
        $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        foreach ($quality in @(85, 70, 55, 40)) {
            $output = New-Object IO.MemoryStream
            $parameters = New-Object Drawing.Imaging.EncoderParameters(1)
            try {
                $parameters.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, [long]$quality)
                $bitmap.Save($output, $codec, $parameters)
                if ($output.Length -le 1MB) {
                    return [Convert]::ToBase64String($output.ToArray())
                }
            } finally {
                $parameters.Dispose()
                $output.Dispose()
            }
        }
        throw 'El documento supera 1 MB. Reduce la resolucion en el dialogo del escaner.'
    } finally {
        if ($graphics) { $graphics.Dispose() }
        if ($bitmap) { $bitmap.Dispose() }
        if ($source) { $source.Dispose() }
        if ($sourceStream) { $sourceStream.Dispose() }
        if ($image) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($image) }
        if ($dialog) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($dialog) }
    }
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add('http://localhost:17843/')
try {
    try {
        $listener.Start()
    } catch {
        throw "No se pudo abrir localhost:17843. Comprueba que otro conector no este activo. Si el acceso fue denegado, solicita una reserva URLACL para tu usuario (ver Configurar escaner en Cocjant). Detalle: $($_.Exception.Message)"
    }
    Write-Host "Conector WIA disponible en http://localhost:17843 para $Origin"
    Write-Host "Clave temporal (pegar en Cocjant): $key"
    Write-Host 'No compartas la clave. Cierra esta ventana cuando termines. Los documentos no se guardan en disco.'
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            if (-not [Net.IPAddress]::IsLoopback($request.RemoteEndPoint.Address) -or
                $request.Headers['Host'] -cne 'localhost:17843' -or $request.Headers['Origin'] -cne $Origin) {
                Send-Json $context 403 @{ error = 'Origen no autorizado para usar el escaner.' }
                continue
            }
            $context.Response.Headers['Access-Control-Allow-Origin'] = $Origin
            $context.Response.Headers['Vary'] = 'Origin'
            if ($request.HttpMethod -eq 'OPTIONS') {
                $context.Response.Headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
                $context.Response.Headers['Access-Control-Allow-Headers'] = 'X-Cocjant-Scanner-Key'
                $context.Response.Headers['Access-Control-Allow-Private-Network'] = 'true'
                Send-Json $context 200 @{ ok = $true }
                continue
            }
            if ($request.HttpMethod -ne 'POST' -or $request.Url.AbsolutePath -cne '/scan' -or $request.HasEntityBody) {
                Send-Json $context 400 @{ error = 'Solicitud de escaneo no valida.' }
                continue
            }
            if ($request.Headers['X-Cocjant-Scanner-Key'] -cne $key) {
                Send-Json $context 401 @{ error = 'Clave del conector incorrecta. Copia la clave de la ventana de Windows.' }
                continue
            }
            try {
                $content = Get-Scan
            } catch {
                Write-Warning ("No se pudo escanear: " + $_.Exception.Message)
                Send-Json $context 422 @{ error = 'No se pudo completar el escaneo. Comprueba la conexion USB, el controlador WIA y el dialogo de Windows (puede estar detras del navegador).' }
                continue
            }
            Send-Json $context 200 @{ contenido = $content }
        } catch {
            Write-Warning ("Solicitud interrumpida: " + $_.Exception.Message)
            $context.Response.Abort()
        }
    }
} finally {
    $listener.Close()
}
