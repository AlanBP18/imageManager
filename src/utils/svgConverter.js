/**
 * Utilidades para rasterizar imágenes a formato SVG manteniendo 100% el soporte
 * de canal alfa y transparencias nativas.
 */

/**
 * Carga un recurso de imagen (Data URL, Blob URL, etc.) en un elemento HTMLImageElement.
 * @param {string} src 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para su procesamiento.'))
    img.src = src
  })
}

/**
 * Rasteriza cualquier imagen (PNG, WebP, JPG, Blob) dentro de un documento SVG.
 * Utiliza un lienzo canvas transparente para extraer el mapa de bits en formato PNG
 * con canal alfa de 32 bits y lo incrusta como elemento <image> dentro del SVG con sus
 * dimensiones exactas y preserveAspectRatio.
 *
 * @param {string} imageSrc - URL o data URL de la imagen
 * @param {Object} [options]
 * @param {string} [options.title] - Título para los metadatos SVG
 * @returns {Promise<{
 *   svgString: string,
 *   svgBlob: Blob,
 *   svgDataUrl: string,
 *   width: number,
 *   height: number,
 *   sizeBytes: number
 * }>}
 */
export async function rasterizeImageToSvg(imageSrc, options = {}) {
  const img = await loadImage(imageSrc)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height

  if (!width || !height) {
    throw new Error('Las dimensiones de la imagen no son válidas.')
  }

  // Creamos un canvas con fondo transparente
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas.')
  }

  // Limpiamos el canvas explícitamente para asegurar transparencia total
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  // Extraemos la imagen como PNG (formato estándar con soporte completo de canal alfa)
  const pngDataUrl = canvas.toDataURL('image/png')

  const title = options.title || 'Imagen Rasterizada en SVG'

  // Construcción del documento SVG limpio y optimizado
  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${escapeXml(title)}</title>
  <desc>Rasterizado SVG con soporte completo de transparencias generado por ImageManager</desc>
  <image width="${width}" height="${height}" preserveAspectRatio="none" href="${pngDataUrl}" xlink:href="${pngDataUrl}" />
</svg>`

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

  return {
    svgString,
    svgBlob,
    svgDataUrl,
    width,
    height,
    sizeBytes: svgBlob.size
  }
}

/**
 * Escapa caracteres especiales para XML/SVG
 * @param {string} str 
 * @returns {string}
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
