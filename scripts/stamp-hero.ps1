# Stamps the "Platform capabilities ... not by this Pack" subtext bar
# onto the bottom of both hero PNGs. Idempotent — run from any cwd.
#
# Usage:
#   pwsh scripts/stamp-hero.ps1
#
# Re-running over an already-stamped image will pile a second bar on top.
# To re-stamp, first restore the originals from git:
#   git checkout HEAD -- docs/images/code2n8n-hero-en.png docs/images/code2n8n-hero-zh.png

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot

function Stamp-Hero {
  param([string]$InputPath, [string]$OutputPath, [string]$Text)
  $img = [System.Drawing.Image]::FromFile($InputPath)
  $w = [int]$img.Width; $h = [int]$img.Height
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, 0, 0, $w, $h)
  $img.Dispose()
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $barHeight = [int]([Math]::Max(40, $h * 0.055))
  $barTop = $h - $barHeight
  $barRect = New-Object System.Drawing.Rectangle 0, $barTop, $w, $barHeight
  $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 8, 12, 24))
  $g.FillRectangle($bgBrush, $barRect)

  $fontSize = [single]([Math]::Max(13, $w / 90))
  $font = New-Object System.Drawing.Font 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 225, 235, 250))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $rectF = New-Object System.Drawing.RectangleF -ArgumentList @([single]0, [single]$barTop, [single]$w, [single]$barHeight)
  $g.DrawString($Text, $font, $textBrush, $rectF, $sf)

  $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host ("Stamped: {0} ({1}x{2}, bar={3}px, font={4}px)" -f $OutputPath, $w, $h, $barHeight, $fontSize)
}

$enPath = Join-Path $repoRoot 'docs\images\code2n8n-hero-en.png'
$zhPath = Join-Path $repoRoot 'docs\images\code2n8n-hero-zh.png'

Stamp-Hero $enPath $enPath "Platform capabilities (SSO / IAM / Audit Log / HA / Metrics / Source Control) provided by n8n & n8n Enterprise — not by this Pack."
Stamp-Hero $zhPath $zhPath "平台能力（SSO / IAM / 稽核日誌 / HA / Metrics / Source Control）由 n8n 與 n8n Enterprise 提供，不由本 Pack 實作。"
