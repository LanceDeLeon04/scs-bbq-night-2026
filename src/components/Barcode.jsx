import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/**
 * Renders a scannable Code128 barcode for the given value.
 * Uses an <svg> ref + JsBarcode so it stays crisp at any size and
 * can be screenshotted along with the rest of the ticket.
 */
export default function Barcode({
  value,
  height = 60,
  width = 2,
  fontSize = 14,
  background = 'transparent',
  lineColor = '#1a1a1a',
  className = '',
}) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!value || !svgRef.current) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        margin: 8,
        background,
        lineColor,
        displayValue: true,
        font: 'monospace',
      })
    } catch (err) {
      console.error('Barcode render failed:', err)
    }
  }, [value, height, width, fontSize, background, lineColor])

  if (!value) return null

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode for ${value}`} />
}
