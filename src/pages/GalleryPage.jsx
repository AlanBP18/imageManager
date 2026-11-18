import { useState } from 'react'
import { copyImageToClipboard } from '../utils/clipboard'
import { downloadImageQuick, getImageFormatAndSize, triggerFileDownload } from '../utils/imageDownloader'
import { rasterizeImageToSvg } from '../utils/svgConverter'
import JSZip from 'jszip'

export default function GalleryPage({ images, onDeleteImage, showToast }) {
  const [isExportingAll, setIsExportingAll] = useState(false)
  const [batchFormat, setBatchFormat] = useState('svg')

  const handleCopy = async (imgSrc, index) => {
    showToast(`Copiando imagen #${index + 1}...`, 'info')
    const success = await copyImageToClipboard(imgSrc)
    if (success) {
      showToast(`¡Imagen #${index + 1} copiada al portapapeles!`, 'success')
    } else {
      showToast('No se pudo copiar la imagen al portapapeles', 'error')
    }
  }

  const handleDownloadSingle = async (imgSrc, index, format = 'svg') => {
    try {
      showToast(`Descargando imagen #${index + 1} como ${format.toUpperCase()}...`, 'info')
      const res = await downloadImageQuick(imgSrc, {
        filename: `galeria_imagen_${index + 1}`,
        format,
        quality: 0.85
      })
      showToast(`¡Descarga lista: ${res.filename}!`, 'success')
    } catch (error) {
      console.error('Error al descargar:', error)
      showToast('Error al descargar la imagen.', 'error')
    }
  }

  const handleDownloadAllZip = async (format = batchFormat) => {
    if (images.length === 0 || isExportingAll) return

    setIsExportingAll(true)
    showToast(`Empaquetando ${images.length} imágenes en ZIP (${format.toUpperCase()})...`, 'info')

    try {
      const zip = new JSZip()
      const folder = zip.folder(`galeria_export_${format}`)

      for (let i = 0; i < images.length; i++) {
        const imgSrc = images[i]
        const name = `imagen_${i + 1}`

        if (format === 'svg') {
          if (imgSrc.startsWith('data:image/svg+xml')) {
            const svgContent = decodeURIComponent(imgSrc.split(',')[1] || '')
            folder.file(`${name}.svg`, svgContent)
          } else {
            const { svgString } = await rasterizeImageToSvg(imgSrc, { title: name })
            folder.file(`${name}.svg`, svgString)
          }
        } else if (format === 'png') {
          // Extraer base64 si es PNG o convertir
          if (imgSrc.startsWith('data:image/png;base64,')) {
            folder.file(`${name}.png`, imgSrc.split(',')[1], { base64: true })
          } else {
            const res = await fetch(imgSrc)
            const blob = await res.blob()
            folder.file(`${name}.png`, blob)
          }
        } else {
          // WebP u otros
          const res = await fetch(imgSrc)
          const blob = await res.blob()
          folder.file(`${name}.webp`, blob)
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      triggerFileDownload(zipBlob, `galeria_imagenes_${format}.zip`)
      showToast(`¡Archivo ZIP descargado con ${images.length} imágenes!`, 'success')
    } catch (error) {
      console.error('Error al generar ZIP de galería:', error)
      showToast('Error al empaquetar el ZIP de la galería.', 'error')
    } finally {
      setIsExportingAll(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 w-full max-w-6xl mx-auto z-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 text-left">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Galería de Imágenes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Colección guardada con descarga rápida en SVG rasterizado, PNG y WebP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {images.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl backdrop-blur-md">
              <div className="flex bg-slate-950/80 p-0.5 rounded-xl border border-slate-850">
                <button
                  onClick={() => setBatchFormat('svg')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    batchFormat === 'svg'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="SVG con soporte de transparencias"
                >
                  SVG
                </button>
                <button
                  onClick={() => setBatchFormat('png')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    batchFormat === 'png'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="PNG transparente"
                >
                  PNG
                </button>
                <button
                  onClick={() => setBatchFormat('webp')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    batchFormat === 'webp'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="WebP optimizado"
                >
                  WebP
                </button>
              </div>

              <button
                onClick={() => handleDownloadAllZip(batchFormat)}
                disabled={isExportingAll}
                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isExportingAll ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                <span>Descargar Todo (ZIP)</span>
              </button>
            </div>
          )}

          <div className="flex flex-col sm:items-end space-y-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacidad</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    images.length >= 5
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{ width: `${Math.min((images.length / 5) * 100, 100)}%` }}
                ></div>
              </div>
              <span className={`text-xs font-mono font-bold ${images.length >= 5 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`}>
                {images.length}/5
              </span>
            </div>
          </div>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="apple-glass rounded-3xl p-12 min-h-[320px] flex-1 flex flex-col items-center justify-center border-dashed border-slate-700/60">
          <div className="apple-glass-backdrop"></div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-slate-800/20 rounded-2xl blur-xl"></div>
              <div className="relative w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium">La galería está vacía</p>
            <p className="text-slate-500 text-xs mt-1 max-w-xs text-center">
              Carga o procesa imágenes con fondo transparente y guárdalas aquí para gestionarlas y descargarlas.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {images.map((img, index) => {
            const info = getImageFormatAndSize(img)
            return (
              <div
                key={index}
                className="apple-glass rounded-2xl flex flex-col hover:border-indigo-500/30 hover:shadow-[0_10px_30px_-15px_rgba(99,102,241,0.2)] transition-all duration-300 group"
              >
                <div className="apple-glass-backdrop"></div>
                <div className="relative z-10 flex flex-col h-full w-full">
                  {/* Vista previa */}
                  <div className="aspect-video w-full overflow-hidden bg-checkerboard flex items-center justify-center relative p-3 border-b border-slate-950">
                    <img
                      className="object-contain w-full h-full max-h-[140px] group-hover:scale-102 transition-transform duration-500"
                      src={img}
                      alt={`Imagen ${index + 1}`}
                    />

                    {/* Insignia de formato arriba a la izquierda */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold tracking-wider backdrop-blur-md shadow-md ${
                        info.format === 'SVG'
                          ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                          : info.format === 'PNG'
                          ? 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300'
                      }`}>
                        {info.format}
                      </span>
                    </div>

                    {/* Acciones flotantes al pasar el mouse */}
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDownloadSingle(img, index, 'svg')}
                        className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer font-bold text-xs flex items-center gap-1"
                        title="Descarga rápida como SVG (con transparencia)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>SVG</span>
                      </button>

                      <button
                        onClick={() => handleDownloadSingle(img, index, 'png')}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer font-bold text-xs flex items-center gap-1"
                        title="Descarga rápida como PNG (transparente)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>PNG</span>
                      </button>

                      <button
                        onClick={() => handleCopy(img, index)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                        title="Copiar al portapapeles"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>

                      <button
                        onClick={() => onDeleteImage(index)}
                        className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                        title="Eliminar de la galería"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Pie de la tarjeta */}
                  <div className="p-3 flex justify-between items-center bg-slate-900/60 backdrop-blur-md">
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] text-indigo-300 font-bold tracking-wider uppercase">
                        Imagen #{index + 1}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {info.sizeLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownloadSingle(img, index, 'svg')}
                        className="px-2 py-1 text-[10px] font-bold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/40 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1"
                        title="Descargar SVG con transparencia"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        SVG
                      </button>
                      <button
                        onClick={() => handleDownloadSingle(img, index, 'png')}
                        className="px-2 py-1 text-[10px] font-bold bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/40 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1"
                        title="Descargar PNG con transparencia"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PNG
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
