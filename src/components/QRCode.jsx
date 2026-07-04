import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Renders a scannable QR code for the given value, styled to match the
 * app's dark theme: light/white modules on a dark background instead of
 * the usual black-on-white. QR codes tolerate this fine since scanners key
 * off contrast, not which color is "ink".
 */
export default function QRCodeDisplay({
  value,
  size = 176,
  darkBg = '#131110', // char-900 — matches the app's glass card background
  lightFg = '#ffffff', // the "highlighted" modules
  className = '',
}) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    if (!value) return
    let cancelled = false
    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: {
        dark: lightFg, // "dark" = foreground modules in the qrcode API
        light: darkBg, // "light" = background
      },
    })
      .then((str) => {
        if (!cancelled) setSvg(str)
      })
      .catch((err) => console.error('QR code render failed:', err))
    return () => {
      cancelled = true
    }
  }, [value, size, darkBg, lightFg])

  if (!value || !svg) return null

  return (
    <div
      className={className}
      role="img"
      aria-label={`QR code for ${value}`}
      style={{ width: size, height: size }}
      // qrcode's toString('svg') output is fully self-generated (no user input
      // is interpolated into markup), so this is safe to inject directly.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
