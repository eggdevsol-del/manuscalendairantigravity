Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("c:\Users\Piripi\manuscalendairversion\client\public\app-logo.png")

# 192x192 PWA Icon
$bmp192 = New-Object System.Drawing.Bitmap 192, 192
$g192 = [System.Drawing.Graphics]::FromImage($bmp192)        
$g192.DrawImage($img, 0, 0, 192, 192)
$bmp192.Save("c:\Users\Piripi\manuscalendairversion\client\public\icon-192.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 512x512 PWA Icon
$bmp512 = New-Object System.Drawing.Bitmap 512, 512
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.DrawImage($img, 0, 0, 512, 512)
$bmp512.Save("c:\Users\Piripi\manuscalendairversion\client\public\icon-512.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 180x180 Apple Touch Icon
$bmp180 = New-Object System.Drawing.Bitmap 180, 180
$g180 = [System.Drawing.Graphics]::FromImage($bmp180)
$g180.DrawImage($img, 0, 0, 180, 180)
$bmp180.Save("c:\Users\Piripi\manuscalendairversion\client\public\apple-touch-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 192x192 Favicon (Using the 192x192 bitmap to save as ICO is hard in native PS, so just save as PNG and let Vite handle it, or we just copy)
$bmp192.Save("c:\Users\Piripi\manuscalendairversion\client\public\favicon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)

$g180.Dispose()
$bmp180.Dispose()
$g192.Dispose()
$bmp192.Dispose()
$g512.Dispose()
$bmp512.Dispose()
$img.Dispose()
Write-Host "Icons generated successfully"
