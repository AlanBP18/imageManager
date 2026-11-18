import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'
import { blobToWebP } from 'webp-converter-browser'
import { copyImageToClipboard } from '../utils/clipboard'
import { rasterizeImageToSvg } from '../utils/svgConverter'
import { downloadImageQuick, getImageFormatAndSize } from '../utils/imageDownloader'

export default function DropZonePage({ onAddImage, showToast }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [fileName, setFileName] = useState('imagen')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [quality, setQuality] = useState(0.75)
  const [quickDownloadFormat, setQuickDownloadFormat] = useState('svg')
  const fileInputRef = useRef(null)

  // Estados para manejar los parámetros de Chroma Key (pantalla verde/azul/etc.)
  const [isChromaMode, setIsChromaMode] = useState(false)
  const [chromaColor, setChromaColor] = useState('#00ff00')
  const [chromaSimilarity, setChromaSimilarity] = useState(30)
  const [chromaSmoothness, setChromaSmoothness] = useState(10)
  const [chromaSpill, setChromaSpill] = useState(true)
  const canvasRef = useRef(null)
  const originalImgRef = useRef(null)

  const initChromaCanvas = () => {
    const canvas = canvasRef.current
    const img = originalImgRef.current
    if (!canvas || !img) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    updateChromaPreview()
  }

  const updateChromaPreview = useCallback(() => {
    const canvas = canvasRef.current
    const img = originalImgRef.current
    if (!canvas || !img) return
    
    const ctx = canvas.getContext('2d')
    const w = img.naturalWidth
    const h = img.naturalHeight
    
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    
    const rHex = parseInt(chromaColor.slice(1, 3), 16)
    const gHex = parseInt(chromaColor.slice(3, 5), 16)
    const bHex = parseInt(chromaColor.slice(5, 7), 16)
    
    const sim = (chromaSimilarity / 100) * 255
    const smooth = (chromaSmoothness / 100) * 255
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i+1]
      const b = data[i+2]
      const a = data[i+3]
      
      if (a === 0) continue
      
      const dist = Math.sqrt((r - rHex)**2 + (g - gHex)**2 + (b - bHex)**2)
      
      let alpha = 255
      if (dist < sim) {
        alpha = 0
      } else if (dist < sim + smooth) {
        alpha = Math.round(((dist - sim) / (smooth || 1)) * 255)
      }
      
      data[i+3] = Math.min(a, alpha)
      
      // Algoritmo para mitigar el derrame de color verde/azul en los bordes de la imagen
      if (chromaSpill && alpha < 255) {
        if (gHex > rHex && gHex > bHex) {
          const avg = (r + b) / 2
          if (g > avg) {
            const blend = 1 - (alpha / 255)
            data[i+1] = Math.round(g * (1 - blend) + avg * blend)
          }
        } else if (bHex > rHex && bHex > gHex) {
          const avg = (r + g) / 2
          if (b > avg) {
            const blend = 1 - (alpha / 255)
            data[i+2] = Math.round(b * (1 - blend) + avg * blend)
          }
        } else if (rHex > gHex && rHex > bHex) {
          const avg = (g + b) / 2
          if (r > avg) {
            const blend = 1 - (alpha / 255)
            data[i] = Math.round(r * (1 - blend) + avg * blend)
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [chromaColor, chromaSimilarity, chromaSmoothness, chromaSpill])

  useEffect(() => {
    if (isChromaMode) {
      updateChromaPreview()
    }
  }, [isChromaMode, updateChromaPreview])

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const img = originalImgRef.current
    if (!canvas || !img) return
    
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height)
    
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = 1
    tempCanvas.height = 1
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1)
    const pixel = tempCtx.getImageData(0, 0, 1, 1).data
    
    const hex = '#' + Array.from(pixel.slice(0, 3)).map(val => val.toString(16).padStart(2, '0')).join('')
    setChromaColor(hex)
    showToast(`Color seleccionado: ${hex.toUpperCase()}`, 'success')
  }

  const handleApplyChroma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    setImageSrc(dataUrl)
    setIsChromaMode(false)
    showToast('¡Fondo eliminado con Chroma Key! (Transparencia aplicada)', 'success')
  }

  const blobToDataURL = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const getBlobFromSrc = async (src) => {
    const response = await fetch(src)
    return await response.blob()
  }

  const handleFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecciona un archivo de imagen válido.', 'error')
      return
    }

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
    setFileName(baseName)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target.result)
      setIsChromaMode(false)
      showToast('Imagen cargada correctamente', 'success')
    }
    reader.readAsDataURL(file)
  }, [showToast])

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        setFileName('imagen_pegada')
        handleFile(blob)
        break
      }
    }
  }, [handleFile])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  const handleSave = () => {
    if (imageSrc) {
      const success = onAddImage(imageSrc)
      if (success) {
        setImageSrc(null)
      }
    }
  }

  const handleCopy = async () => {
    if (!imageSrc) return
    showToast('Copiando imagen al portapapeles...', 'info')
    const success = await copyImageToClipboard(imageSrc)
    if (success) {
      showToast('¡Imagen copiada al portapapeles!', 'success')
    } else {
      showToast('No se pudo copiar la imagen al portapapeles', 'error')
    }
  }

  const handleRemoveBackground = async () => {
    if (!imageSrc || isProcessing) return
    setIsProcessing(true)
    try {
      showToast('Removiendo fondo mediante IA (conservando transparencias)...', 'info')
      const blob = await removeBackground(imageSrc)
      const dataUrl = await blobToDataURL(blob)
      setImageSrc(dataUrl)
      showToast('¡Fondo eliminado con éxito! Canal alfa activo.', 'success')
    } catch (error) {
      console.error('Error removing background:', error)
      showToast('Error al quitar el fondo. Inténtalo de nuevo.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConvertToWebp = async () => {
    if (!imageSrc || isProcessing) return
    setIsProcessing(true)
    try {
      showToast('Comprimiendo y convirtiendo a WebP...', 'info')
      const originalBlob = await getBlobFromSrc(imageSrc)
      const webpBlob = await blobToWebP(originalBlob, { quality })
      const dataUrl = await blobToDataURL(webpBlob)
      setImageSrc(dataUrl)
      showToast('¡Imagen convertida a WebP con éxito!', 'success')
    } catch (error) {
      console.error('Error converting to WebP:', error)
      showToast('Error al convertir la imagen a WebP.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConvertToSvg = async () => {
    if (!imageSrc || isProcessing) return
    setIsProcessing(true)
    try {
      showToast('Rasterizando imagen a SVG con transparencia...', 'info')
      const { svgDataUrl } = await rasterizeImageToSvg(imageSrc, { title: fileName })
      setImageSrc(svgDataUrl)
      setQuickDownloadFormat('svg')
      showToast('¡Imagen rasterizada en SVG con soporte de transparencias!', 'success')
    } catch (error) {
      console.error('Error rasterizing to SVG:', error)
      showToast('Error al rasterizar a SVG. Inténtalo de nuevo.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQuickDownload = async (format = quickDownloadFormat) => {
    if (!imageSrc || isProcessing) return
    try {
      showToast(`Descargando resultado en formato .${format.toUpperCase()}...`, 'info')
      const result = await downloadImageQuick(imageSrc, {
        filename: `${fileName}_resultado`,
        format,
        quality
      })
      showToast(`¡Descargado rápido: ${result.filename}!`, 'success')
    } catch (error) {
      console.error('Error en descarga rápida:', error)
      showToast('Error al descargar la imagen. Inténtalo de nuevo.', 'error')
    }
  }

  const imageInfo = getImageFormatAndSize(imageSrc)

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-xl z-10">
        <div
          onClick={() => !imageSrc && fileInputRef.current.click()}
          onDragEnter={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            if (e.dataTransfer.files.length > 0) {
              handleFile(e.dataTransfer.files[0])
            }
          }}
          className={`apple-glass group transition-all duration-500 ease-out cursor-pointer flex flex-col items-center justify-center min-h-[360px] rounded-3xl p-8 sm:p-10 text-center ${
            imageSrc
              ? 'border-indigo-500/20'
              : isDragOver
              ? 'apple-glass-active scale-[1.01]'
              : 'apple-glass-hover border-dashed border-slate-700/60 hover:border-solid hover:border-indigo-500/30'
          }`}
        >
          <div className="apple-glass-backdrop"></div>
          {!imageSrc ? (
            <div className="relative z-10 flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/15 rounded-3xl blur-2xl group-hover:bg-indigo-500/25 transition-all duration-500"></div>
                <div className="relative w-20 h-20 apple-glass rounded-3xl flex items-center justify-center border-white/5 group-hover:border-indigo-500/40 group-hover:scale-105 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.4),0_0_30px_rgba(99,102,241,0.15)] transition-all duration-500">
                  <svg className="w-10 h-10 text-slate-400 group-hover:text-indigo-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-slate-200 bg-clip-text text-transparent">
                  Cargar Imagen
                </h2>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  Arrastra tu archivo aquí o presiona{' '}
                  <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded text-xs text-slate-300 font-mono shadow-sm">
                    Ctrl + V
                  </kbd>{' '}
                  para pegar
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-slate-500 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-800/80 font-mono">PNG (Transparente)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-800/80 font-mono">SVG</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-800/80 font-mono">WebP / JPG</span>
                </div>
              </div>
            </div>
          ) : isChromaMode ? (
            <div className="relative z-10 w-full flex flex-col items-center space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-slate-200 bg-clip-text text-transparent">
                  Editor de Chroma Key
                </h2>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  Haz clic en cualquier parte de la imagen para seleccionar el color de fondo a transparentar
                </p>
              </div>

              <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-checkerboard flex items-center justify-center p-4">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="max-w-full max-h-[260px] object-contain rounded-lg cursor-crosshair hover:ring-2 hover:ring-indigo-500/50 transition-all duration-200"
                />
                
                <img
                  ref={originalImgRef}
                  src={imageSrc}
                  className="hidden"
                  alt="Original"
                  onLoad={initChromaCanvas}
                />
              </div>

              <div className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-semibold text-slate-300">Color seleccionado:</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={chromaColor}
                        onChange={(e) => setChromaColor(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer p-0"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                        {chromaColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {['#00ff00', '#0000ff', '#ff0000', '#ffffff', '#000000'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setChromaColor(color)}
                        className={`w-6 h-6 rounded-full border transition-all duration-200 cursor-pointer ${
                          chromaColor === color ? 'border-indigo-400 scale-110 ring-2 ring-indigo-500/30' : 'border-slate-800 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Tolerancia (Similitud)</span>
                    <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">{chromaSimilarity}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={chromaSimilarity}
                    onChange={(e) => setChromaSimilarity(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors duration-200"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Suavizado (Smoothness)</span>
                    <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">{chromaSmoothness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={chromaSmoothness}
                    onChange={(e) => setChromaSmoothness(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors duration-200"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Reducción de Spill (Derrame)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chromaSpill}
                      onChange={(e) => setChromaSpill(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsChromaMode(false)}
                  className="flex-1 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-medium border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar
                </button>
                <button
                  onClick={handleApplyChroma}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Aplicar Cambios
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 w-full flex flex-col items-center space-y-5">
              {/* Contenedor de la Vista Previa */}
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-checkerboard flex items-center justify-center p-4">
                <img
                  className={`max-w-full max-h-[260px] object-contain rounded-lg transition-all duration-300 ${
                    isProcessing ? 'blur-xs brightness-75 scale-[0.98]' : 'hover:scale-[1.01]'
                  }`}
                  src={imageSrc}
                  alt="Vista previa"
                />
                
                {/* Insignia con el formato actual y tamaño */}
                {!isProcessing && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider backdrop-blur-md shadow-lg ${
                      imageInfo.format === 'SVG'
                        ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                        : imageInfo.format === 'PNG'
                        ? 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}>
                      {imageInfo.format}
                    </span>
                    <span className="bg-slate-950/80 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono font-semibold text-slate-300 shadow-lg">
                      {imageInfo.sizeLabel}
                    </span>
                  </div>
                )}

                {/* Efecto visual de rayo láser escaneando la imagen */}
                {isProcessing && (
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_12px_#818cf8] animate-scan pointer-events-none"></div>
                )}

                {/* Capa de carga mientras procesa */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
                    <span className="text-indigo-200 text-xs font-semibold tracking-wider uppercase bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800 shadow-lg">
                      Procesando...
                    </span>
                  </div>
                )}
              </div>

              {/* PANEL DESTACADO: DESCARGA RÁPIDA DE RESULTADOS */}
              <div className="w-full bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center space-x-3 w-full sm:w-auto text-left">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">Descarga Rápida</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-semibold">
                        Transparencia OK
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Exporta en un clic sin pasos extra</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Selector rápido de formato: SVG, PNG, WebP */}
                  <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setQuickDownloadFormat('svg')
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quickDownloadFormat === 'svg'
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="SVG rasterizado con transparencia nativa"
                    >
                      SVG
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setQuickDownloadFormat('png')
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quickDownloadFormat === 'png'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="PNG con canal alfa transparente"
                    >
                      PNG
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setQuickDownloadFormat('webp')
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quickDownloadFormat === 'webp'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="WebP optimizado"
                    >
                      WebP
                    </button>
                  </div>

                  {/* Botón de acción de descarga rápida */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleQuickDownload(quickDownloadFormat)
                    }}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:scale-102 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Descargar .{quickDownloadFormat.toUpperCase()}</span>
                  </button>
                </div>
              </div>

              {/* Controles deslizantes para ajustar la calidad de WebP */}
              <div className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Calidad de Compresión WebP</span>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] text-slate-500 font-medium">Más Compresión</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 focus:outline-none transition-colors duration-200"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">Más Calidad</span>
                </div>
              </div>

              {/* Barra de herramientas y transformaciones */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageSrc(null)
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Quitar
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy()
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-xl text-xs font-medium border border-indigo-950/40 hover:border-indigo-900/60 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copiar
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsChromaMode(true)
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 hover:text-violet-200 rounded-xl text-xs font-medium border border-violet-900/40 hover:border-violet-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Chroma Key
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveBackground()
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-medium border border-indigo-900/40 hover:border-indigo-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quitar Fondo (IA)
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleConvertToSvg()
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 hover:text-cyan-200 rounded-xl text-xs font-medium border border-cyan-800/40 hover:border-cyan-700/60 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-950/50"
                  title="Rasterizar a SVG preservando 100% las transparencias"
                >
                  <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Rasterizar a SVG
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleConvertToWebp()
                  }}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-medium border border-emerald-900/40 hover:border-emerald-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  A WebP
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSave()
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-medium transition-all duration-200 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar en Galería
                </button>
              </div>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files.length > 0 && handleFile(e.target.files[0])}
            className="hidden"
            accept="image/*"
          />
        </div>
      </div>
    </div>
  )
}
