import { useState, useRef, useEffect } from 'react'
import { removeBackground } from '@imgly/background-removal'
import { copyImageToClipboard } from '../utils/clipboard'

export default function DropZonePage({ onAddImage, showToast }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecciona un archivo de imagen válido.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target.result)
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
      onAddImage(imageSrc)
      setImageSrc(null)
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
      const url = URL.createObjectURL(blob)
      setImageSrc(url)
      showToast('¡Fondo eliminado con éxito!', 'success')
    } catch (error) {
      console.error('Error removing background:', error)
      showToast('Error al quitar el fondo. Inténtalo de nuevo.', 'error')
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
          className={`relative group border-2 rounded-3xl p-10 text-center transition-all duration-500 ease-out cursor-pointer flex flex-col items-center justify-center min-h-[360px] ${
            imageSrc
              ? 'border-indigo-500/30 bg-slate-900/40 backdrop-blur-xl'
              : isDragOver
              ? 'border-indigo-500 bg-indigo-950/20 shadow-[0_0_60px_-10px_rgba(99,102,241,0.4)] scale-[1.01]'
              : 'border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-900/20 hover:bg-slate-900/40 backdrop-blur-xl hover:shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)]'
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl blur-xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                <div className="relative w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center group-hover:border-indigo-500/50 group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] transition-all duration-500">
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
          ) : (
            <div className="w-full flex flex-col items-center space-y-8">
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-checkerboard flex items-center justify-center p-4">
                <img
                  className={`max-w-full max-h-[260px] object-contain rounded-lg transition-all duration-300 ${
                    isProcessing ? 'blur-xs brightness-75 scale-[0.98]' : 'hover:scale-[1.01]'
                  }`}
                  src={imageSrc}
                  alt="Vista previa"
                />
                
                {/* Scanner Laser effect */}
                {isProcessing && (
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_12px_#818cf8] animate-scan pointer-events-none"></div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
                    <span className="text-indigo-200 text-xs font-semibold tracking-wider uppercase bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800 shadow-lg">
                      Procesando IA...
                    </span>
                  </div>
                )}
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

