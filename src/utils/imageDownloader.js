import { rasterizeImageToSvg, loadImage } from './svgConverter'
import { blobToWebP } from 'webp-converter-browser'

/**
 * Dispara la descarga inmediata de un Blob o URL en el navegador del usuario.
 * @param {Blob|string} blobOrUrl 
 * @param {string} filename 
 */
export function triggerFileDownload(blobOrUrl, filename) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Si creamos una object URL, la liberamos tras la descarga
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 2000)
  }
}

/**
 * Descarga una imagen de manera rápida convirtiéndola al formato deseado (svg, png, webp).
 * Soportando transparencias completas en todos los formatos.
 * 
 * @param {string} imageSrc - URL o Data URL de la imagen
 * @param {Object} options
 * @param {string} [options.filename='imagen'] - Nombre de archivo base
 * @param {('svg'|'png'|'webp')} [options.format='svg'] - Formato de descarga
 * @param {number} [options.quality=0.8] - Calidad si se elige WebP
 * @returns {Promise<{ filename: string, format: string, sizeBytes: number }>}
 */
export async function downloadImageQuick(imageSrc, options = {}) {
  const {
    filename = 'imagen',
    format = 'svg',
    quality = 0.8
  } = options

  // Normalizar nombre sin extensión previa
  const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'imagen'

  if (format === 'svg') {
    // Si ya es un SVG data URL directo, lo usamos; si no, rasterizamos a SVG preservando alfa
    if (imageSrc.startsWith('data:image/svg+xml')) {
      const svgBlob = new Blob([decodeURIComponent(imageSrc.split(',')[1])], { type: 'image/svg+xml;charset=utf-8' })
      const outName = `${baseName}.svg`
      triggerFileDownload(svgBlob, outName)
      return { filename: outName, format: 'svg', sizeBytes: svgBlob.size }
    }

    const { svgBlob } = await rasterizeImageToSvg(imageSrc, { title: baseName })
    const outName = `${baseName}.svg`
    triggerFileDownload(svgBlob, outName)
    return { filename: outName, format: 'svg', sizeBytes: svgBlob.size }
  }

  if (format === 'png') {
    // Si ya es data:image/png, podemos descargarlo directo
    if (imageSrc.startsWith('data:image/png;base64,')) {
      const response = await fetch(imageSrc)
      const pngBlob = await response.blob()
      const outName = `${baseName}.png`
      triggerFileDownload(pngBlob, outName)
      return { filename: outName, format: 'png', sizeBytes: pngBlob.size }
    }

    // Dibujamos en canvas para asegurar soporte alfa transparente en PNG
    const img = await loadImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const pngBlob = await new Promise((res, rej) => {
      canvas.toBlob((b) => b ? res(b) : rej(new Error('Fallo al generar PNG')), 'image/png')
    })
    const outName = `${baseName}.png`
    triggerFileDownload(pngBlob, outName)
    return { filename: outName, format: 'png', sizeBytes: pngBlob.size }
  }

  if (format === 'webp') {
    const res = await fetch(imageSrc)
    const originalBlob = await res.blob()
    const webpBlob = await blobToWebP(originalBlob, { quality })
    const outName = `${baseName}.webp`
    triggerFileDownload(webpBlob, outName)
    return { filename: outName, format: 'webp', sizeBytes: webpBlob.size }
  }

  // Por defecto, descargar el recurso tal cual
  const res = await fetch(imageSrc)
  const defaultBlob = await res.blob()
  const outName = `${baseName}.png`
  triggerFileDownload(defaultBlob, outName)
  return { filename: outName, format: 'png', sizeBytes: defaultBlob.size }
}

/**
 * Detecta el formato y peso de una imagen en string (data url, blob, etc.)
 * @param {string} srcString 
 * @returns {{ format: string, sizeLabel: string, bytes: number }}
 */
export function getImageFormatAndSize(srcString) {
  if (!srcString) {
    return { format: 'NONE', sizeLabel: '0 KB', bytes: 0 }
  }

  let format = 'IMG'
  if (srcString.startsWith('data:image/svg+xml')) format = 'SVG'
  else if (srcString.startsWith('data:image/png')) format = 'PNG'
  else if (srcString.startsWith('data:image/webp')) format = 'WEBP'
  else if (srcString.startsWith('data:image/jpeg') || srcString.startsWith('data:image/jpg')) format = 'JPG'
  else if (srcString.startsWith('blob:')) format = 'BLOB'

  if (srcString.startsWith('blob:')) {
    return { format, sizeLabel: 'En Memoria', bytes: 0 }
  }

  let bytes = 0
  if (srcString.startsWith('data:image/svg+xml;charset=utf-8,')) {
    const encoded = srcString.split(',')[1] || ''
    bytes = new Blob([decodeURIComponent(encoded)]).size
  } else {
    const base64Data = srcString.split(',')[1]
    if (base64Data) {
      bytes = Math.round((base64Data.length * 3) / 4)
    }
  }

  let sizeLabel = '0 KB'
  if (bytes > 1024 * 1024) {
    sizeLabel = `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } else if (bytes > 0) {
    sizeLabel = `${Math.round(bytes / 1024)} KB`
  }

  return { format, sizeLabel, bytes }
}
