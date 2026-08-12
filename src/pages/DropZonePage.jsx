import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'
import { blobToWebP } from 'webp-converter-browser'
import { copyImageToClipboard } from '../utils/clipboard'

export default function DropZonePage({ onAddImage, showToast }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [quality, setQuality] = useState(0.75)
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
    
    // Usamos un lienzo diminuto de 1x1 píxeles para leer el color exacto que el usuario seleccionó
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
    showToast('¡Fondo eliminado con Chroma Key!', 'success')
  }


  const getFileSize = (srcString) => {
    if (!srcString) return '0 KB'
    if (srcString.startsWith('blob:')) {
      return 'Calculando...'
    }
    const base64Data = srcString.split(',')[1]
    if (!base64Data) return 'Desconocido'
    const sizeInBytes = Math.round((base64Data.length * 3) / 4)
    if (sizeInBytes > 1024 * 1024) {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${Math.round(sizeInBytes / 1024)} KB`
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


  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecciona un archivo de imagen válido.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target.result)
      setIsChromaMode(false) // Reseteamos el modo chroma para evitar mezclar configuraciones de imágenes anteriores
      showToast('Imagen cargada correctamente', 'success')
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        handleFile(blob)
        break
      }
    }
  }

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [])

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
      showToast('Removiendo fondo de la imagen...', 'info')
      const blob = await removeBackground(imageSrc)
      const dataUrl = await blobToDataURL(blob)
      setImageSrc(dataUrl)
      showToast('¡Fondo eliminado con éxito!', 'success')
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
      showToast('Error al convertir la imagen a WebP. Inténtalo de nuevo.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }


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
          className={`apple-glass group transition-all duration-500 ease-out cursor-pointer flex flex-col items-center justify-center min-h-[360px] rounded-3xl p-10 text-center ${
            imageSrc
              ? 'border-indigo-500/20'
              : isDragOver
              ? 'apple-glass-active scale-[1.01]'
              : 'apple-glass-hover border-dashed border-slate-700/60 hover:border-solid hover:border-indigo-500/30'
          }`}
        >
          {/* Capa de fondo con efecto de desenfoque de vidrio templado (estilo Apple Glass) */}
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
                <p className="text-slate-500 text-xs mt-1">Soporta PNG, JPG, WebP</p>
              </div>
            </div>
          ) : isChromaMode ? (
            <div className="relative z-10 w-full flex flex-col items-center space-y-6">
              {/* Instrucciones de ayuda para el recorte de Chroma Key */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-slate-200 bg-clip-text text-transparent">
                  Editor de Chroma Key
                </h2>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  Haz clic en cualquier parte de la imagen para seleccionar el color de fondo
                </p>
              </div>

              {/* Contenedor del lienzo interactivo */}
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

              {/* Ajustes avanzados de Chroma Key */}
              <div className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4">
                {/* Selector de color de fondo */}
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
                  
                  {/* Colores preestablecidos más comunes */}
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

                {/* Control de Tolerancia (Similitud del color) */}
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

                {/* Control de Suavizado (Desvanecimiento de bordes) */}
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

                {/* Control de reducción de derrame cromático */}
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

              {/* Botones de acción inferiores */}
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
            <div className="relative z-10 w-full flex flex-col items-center space-y-6">
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-checkerboard flex items-center justify-center p-4">
                <img
                  className={`max-w-full max-h-[260px] object-contain rounded-lg transition-all duration-300 ${
                    isProcessing ? 'blur-xs brightness-75 scale-[0.98]' : 'hover:scale-[1.01]'
                  }`}
                  src={imageSrc}
                  alt="Vista previa"
                />
                
                {/* Indicador del tamaño actual del archivo cargado */}
                {!isProcessing && (
                  <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-800/80 text-[11px] font-semibold text-slate-300 font-mono shadow-lg">
                    {getFileSize(imageSrc)}
                  </div>
                )}

                {/* Efecto visual de rayo láser escaneando la imagen */}
                {isProcessing && (
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_12px_#818cf8] animate-scan pointer-events-none"></div>
                )}

                {/* Capa de carga mientras la IA local procesa el recorte */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
                    <span className="text-indigo-200 text-xs font-semibold tracking-wider uppercase bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800 shadow-lg">
                      Procesando...
                    </span>
                  </div>
                )}
              </div>

              {/* Controles deslizantes para ajustar la calidad final de compresión de WebP */}
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
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>~ peso mínimo (~80% reducción)</span>
                  <span>balanceado</span>
                  <span>~ sin pérdidas</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageSrc(null)
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-medium border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                  className="px-4 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-xl text-sm font-medium border border-indigo-950/40 hover:border-indigo-900/60 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                  className="px-4 py-2.5 bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 hover:text-violet-200 rounded-xl text-sm font-medium border border-violet-900/40 hover:border-violet-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                  className="px-4 py-2.5 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 hover:text-indigo-200 rounded-xl text-sm font-medium border border-indigo-900/40 hover:border-indigo-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quitar Fondo
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleConvertToWebp()
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 rounded-xl text-sm font-medium border border-emerald-900/40 hover:border-emerald-850/65 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Convertir a WebP
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSave()
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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

