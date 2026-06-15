# Stamps a "What this Pack is vs. what n8n provides" white-panel annotation
# onto the bottom of both hero PNGs. The panel reads as part of the graphic
# (white background, thin top separator, centered dark prose), not as a
# subtitle overlay sitting on top of the design.
#
# Usage:
#   pwsh scripts/stamp-hero.ps1
#
# Re-running over an already-stamped image will stack panels. To re-stamp,
# first restore the originals from a known-clean commit, e.g.:
#   git show d5682fa:docs/images/code2n8n-hero-en.png > docs/images/code2n8n-hero-en.png
#   git show d5682fa:docs/images/code2n8n-hero-zh.png > docs/images/code2n8n-hero-zh.png

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot

function Stamp-Hero {
  param([string]$InputPath, [string]$OutputPath, [string]$Text, [string]$FontFamily)
  $img = [System.Drawing.Image]::FromFile($InputPath)
  $w = [int]$img.Width; $h = [int]$img.Height
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, 0, 0, $w, $h)
  $img.Dispose()
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  # Panel: bottom 8.5% of image, pure white with dark hairline separator on top.
  $panelHeight = [int]([Math]::Max(72, $h * 0.085))
  $panelTop    = $h - $panelHeight
  $sideMargin  = [int]($w * 0.04)
  $textWidth   = $w - 2 * $sideMargin

  $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $panelRect = New-Object System.Drawing.Rectangle 0, $panelTop, $w, $panelHeight
  $g.FillRectangle($whiteBrush, $panelRect)

  # Top separator line (subtle slate)
  $separatorPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 200, 208, 220)), 2
  $g.DrawLine($separatorPen, 0, $panelTop, $w, $panelTop)

  # Body text
  $fontSize = [single]([Math]::Max(15, $w / 105))
  $font = New-Object System.Drawing.Font $FontFamily, $fontSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 32, 40, 56))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sf.Trimming = [System.Drawing.StringTrimming]::Word
  $sf.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit

  $textRect = New-Object System.Drawing.RectangleF -ArgumentList @([single]$sideMargin, [single]($panelTop + 8), [single]$textWidth, [single]($panelHeight - 16))
  $g.DrawString($Text, $font, $textBrush, $textRect, $sf)

  $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host ("Stamped: {0} ({1}x{2}, panel={3}px, font={4}px)" -f $OutputPath, $w, $h, $panelHeight, $fontSize)
}

$enPath = Join-Path $repoRoot 'docs\images\code2n8n-hero-en.png'
$zhPath = Join-Path $repoRoot 'docs\images\code2n8n-hero-zh.png'

$enText = "Platform capabilities such as SSO / IAM, Audit Log, HA, Metrics, and Source Control are provided by n8n editions and enterprise IT deployment. This Pack provides the migration, review, validation, and governance method."
$zhText = "SSO / IAM、稽核日誌、HA、Metrics、Source Control 等平台能力由 n8n 版本與企業 IT 部署提供；本 Pack 提供移植、審查、驗證與治理方法。"

Stamp-Hero $enPath $enPath $enText 'Segoe UI'
Stamp-Hero $zhPath $zhPath $zhText 'Microsoft JhengHei'
