import { useState, useRef, useEffect } from 'react'
import { blobToWebP } from 'webp-converter-browser'
import { removeBackground } from '@imgly/background-removal'
import JSZip from 'jszip'

export default function BatchPage({ showToast }) {
  const [step, setStep] = useState('select') // 'select' | 'processing' | 'completed'
  const [files, setFiles] = useState([])
  const [folderName, setFolderName] = useState('')
  const [options, setOptions] = useState({
    convertToWebp: true,
    quality: 0.75,
    removeBackground: false,
  })

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentActionText, setCurrentActionText] = useState('')
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({
    originalSize: 0,
    processedSize: 0,
    count: 0,
  })
  const [processedImages, setProcessedImages] = useState([])

  const fileInputRef = useRef(null)
  const logsEndRef = useRef(null)
  const cancelRef = useRef(false)

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${time}] ${message}`])
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 KB'
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${Math.round(bytes / 1024)} KB`
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

  const handleFolderSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      showToast('No se encontraron imágenes válidas en la carpeta seleccionada.', 'error')
      return
    }

    // Extract folder name from the first relative path
    if (imageFiles[0].webkitRelativePath) {
      const parts = imageFiles[0].webkitRelativePath.split('/')
      if (parts.length > 1) {
        setFolderName(parts[0])
      }
    } else {
      setFolderName('Carpeta seleccionada')
    }

    setFiles(imageFiles)
    showToast(`Se cargaron ${imageFiles.length} imágenes de la carpeta`, 'success')
  }

  const handleStartProcessing = async () => {
    if (files.length === 0) return

    setStep('processing')
    setIsProcessing(true)
    setCurrentIndex(0)
    setProcessedImages([])
    setLogs([])
    cancelRef.current = false

    let totalOriginalSize = 0
    let totalProcessedSize = 0
    const processedList = []

    addLog(`Iniciando procesamiento de carpeta "${folderName}" (${files.length} imágenes)...`)

    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) {
        addLog('⚠️ Procesamiento cancelado por el usuario.')
        showToast('Procesamiento cancelado.', 'info')
        break
      }

      const file = files[i]
      setCurrentIndex(i)
      setCurrentActionText(`Procesando: ${file.name}`)
      addLog(`[${i + 1}/${files.length}] Leyendo: ${file.name} (${formatSize(file.size)})`)
      totalOriginalSize += file.size

      try {
        // Step 1: Read original image as Data URL
        let currentSrc = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Step 2: Remove background if selected
        if (options.removeBackground) {
          addLog(`   └─ Quitando fondo mediante IA... (esto puede tardar unos segundos)`)
          const bgBlob = await removeBackground(currentSrc)
          currentSrc = await blobToDataURL(bgBlob)
          addLog(`   └─ Fondo eliminado con éxito`)
        }

        // Step 3: Convert to WebP if selected
        if (options.convertToWebp) {
          addLog(`   └─ Convirtiendo a WebP (Calidad: ${Math.round(options.quality * 100)}%)...`)
          const originalBlob = await getBlobFromSrc(currentSrc)
          const webpBlob = await blobToWebP(originalBlob, { quality: options.quality })
          currentSrc = await blobToDataURL(webpBlob)
          
          // Calculate processed size from base64 length
          const base64Data = currentSrc.split(',')[1]
          const processedBytes = Math.round((base64Data.length * 3) / 4)
          totalProcessedSize += processedBytes
          
          const reduction = ((file.size - processedBytes) / file.size * 100).toFixed(0)
          addLog(`   └─ Guardado en WebP (${formatSize(processedBytes)}) | Reducción: -${reduction}%`)
        } else {
          // Calculate size from final state if WebP not selected but bg removed
          const base64Data = currentSrc.split(',')[1]
          const processedBytes = base64Data ? Math.round((base64Data.length * 3) / 4) : file.size
          totalProcessedSize += processedBytes
        }

        processedList.push({
          src: currentSrc,
          name: file.name,
        })
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        addLog(`   ❌ Error al procesar: ${error.message || error}`)
      }
    }

    setProcessedImages(processedList)
    setStats({
      originalSize: totalOriginalSize,
      processedSize: totalProcessedSize,
      count: processedList.length,
    })
    setIsProcessing(false)
    setStep('completed')
    showToast('Procesamiento en lote completado.', 'success')
  }

  const handleCancel = () => {
    cancelRef.current = true
    setIsProcessing(false)
  }

  const handleSaveToDevice = async () => {
    if (processedImages.length === 0) return

    showToast('Generando archivo ZIP...', 'info')
    const zip = new JSZip()
    const folder = zip.folder(folderName || 'imagenes_optimizadas')

    processedImages.forEach((img) => {
      const originalName = img.name
      const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
      const extension = options.convertToWebp ? 'webp' : (originalName.split('.').pop() || 'png')
      const newName = `${nameWithoutExt}_optimizado.${extension}`

      // Extract base64 content from the Data URL
      const base64Content = img.src.split(',')[1]
      folder.file(newName, base64Content, { base64: true })
    })

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)

      const link = document.createElement('a')
      link.href = zipUrl
      link.download = `${folderName || 'imagenes'}_optimizado.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(zipUrl)
      showToast(`¡Se ha descargado el archivo ZIP con ${processedImages.length} imágenes!`, 'success')
      handleReset()
    } catch (error) {
      console.error('Error generating ZIP:', error)
      showToast('Error al generar el archivo ZIP. Inténtalo de nuevo.', 'error')
    }
  }

  const handleReset = () => {
    setStep('select')
    setFiles([])
    setFolderName('')
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-2xl z-10">
        
        {/* STEP 1: SELECT FOLDER AND CONFIG OPTIONS */}
        {step === 'select' && (
          <div className="space-y-6">
            <div className="mb-4 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Procesamiento en Lote
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Automatiza la conversión a WebP y eliminación de fondo de una carpeta completa.
              </p>
            </div>

            {/* Folder Select DropZone (Clickable only if files.length === 0) */}
            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current.click()}
                className="relative group border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-900/20 hover:bg-slate-900/40 rounded-3xl p-8 text-center transition-all duration-300 ease-out cursor-pointer flex flex-col items-center justify-center min-h-[220px] hover:shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)]"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-lg group-hover:bg-indigo-500/20 transition-all duration-300"></div>
                    <div className="relative w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center group-hover:border-indigo-500/50 group-hover:scale-105 transition-all duration-300">
                      <svg className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-200">Cargar Carpeta de Imágenes</h3>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto">
                      Presiona aquí para seleccionar una carpeta completa de imágenes.
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFolderSelect}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                  accept="image/*"
                />
              </div>
            ) : (
              /* Non-clickable Active Folder Card when folder is in progress */
              <div className="relative border border-indigo-500/30 bg-slate-900/40 backdrop-blur-xl rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4 text-left">
                  <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5M5 19v-4a2 2 0 00-2-2m14 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-3.5a1 1 0 01-.8-.4l-.9-1.2A1 1 0 0013.5 3h-3a1 1 0 00-.8.4l-.9 1.2a1 1 0 01-.8.4H5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 truncate max-w-[280px]">
                      Carpeta: <span className="text-indigo-400">"{folderName}"</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {files.length} imágenes encontradas listas para procesar
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-rose-950/30 hover:bg-rose-950/50 text-rose-450 hover:text-rose-350 border border-rose-900/30 hover:border-rose-900/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                  title="Descartar carpeta"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar Carpeta
                </button>
              </div>
            )}

            {/* Automation Options Panel */}
            {files.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-5 backdrop-blur-xl">
                <h4 className="text-sm font-bold text-indigo-300 tracking-wider uppercase">
                  Opciones de Automatización
                </h4>

                <div className="space-y-4">
                  {/* Action 1: WebP Conversion */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.convertToWebp}
                        onChange={(e) => setOptions({ ...options, convertToWebp: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-200">Convertir y Comprimir a WebP</span>
                    </label>

                    {options.convertToWebp && (
                      <div className="pl-7 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Calidad de compresión</span>
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                            {Math.round(options.quality * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] text-slate-500">Más Compresión</span>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={options.quality}
                            onChange={(e) => setOptions({ ...options, quality: parseFloat(e.target.value) })}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500">Más Calidad</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action 2: Background Removal */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.removeBackground}
                        onChange={(e) => setOptions({ ...options, removeBackground: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-200">Quitar Fondo (IA Local)</span>
                    </label>

                    {options.removeBackground && (
                      <div className="pl-7">
                        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 text-[11px] text-amber-300/80 leading-relaxed flex gap-2">
                          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>
                            <strong>Nota importante:</strong> La eliminación de fondo corre un modelo de IA pesado en tu navegador. Para lotes de muchas imágenes, esto consumirá recursos del sistema y tomará un tiempo considerable por imagen.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    onClick={handleStartProcessing}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Iniciar Automatización de {files.length} Imágenes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* STEP 2: PROCESSING BATCH STATE */}
        {step === 'processing' && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-6 backdrop-blur-xl flex flex-col items-center">
              
              <div className="w-full flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-300">Progreso del Lote</span>
                <span className="text-indigo-400 font-bold">{currentIndex + 1} de {files.length}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-850 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / files.length) * 100}%` }}
                ></div>
              </div>

              {/* Current Action / Activity Indicator */}
              <div className="flex items-center space-x-3 w-full bg-slate-950/40 border border-slate-850 px-4 py-3 rounded-2xl">
                <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin shrink-0"></div>
                <div className="flex-1 text-left">
                  <span className="text-xs text-slate-400 block font-semibold">Acción actual:</span>
                  <span className="text-xs text-indigo-200 font-mono truncate block">{currentActionText}</span>
                </div>
              </div>

              {/* Terminal Logs Window */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-400 font-mono">Consola de Salida</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="w-full h-48 bg-slate-950 border border-slate-900 rounded-2xl p-4 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1 text-left shadow-inner">
                  {logs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="px-6 py-2.5 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 rounded-xl text-xs font-semibold border border-rose-900/40 hover:border-rose-800/40 transition-all duration-200 cursor-pointer"
              >
                Cancelar Operación
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: BATCH COMPLETE VIEW */}
        {step === 'completed' && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-8 space-y-6 backdrop-blur-xl flex flex-col items-center text-center">
              
              {/* Checkmark animation container */}
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse"></div>
                <div className="relative w-20 h-20 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-slate-100">¡Automatización Completada!</h2>
                <p className="text-slate-400 text-xs">
                  El procesamiento del lote finalizó con éxito.
                </p>
              </div>

              {/* Stat Grid Card */}
              <div className="grid grid-cols-3 gap-4 w-full bg-slate-950/50 border border-slate-900 rounded-2xl p-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Imágenes</span>
                  <span className="text-lg font-extrabold text-slate-200 mt-1">{stats.count}</span>
                </div>
                <div className="flex flex-col border-x border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Peso Original</span>
                  <span className="text-lg font-extrabold text-slate-200 mt-1">{formatSize(stats.originalSize)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Optimizado</span>
                  <span className="text-lg font-extrabold text-emerald-400 mt-1">{formatSize(stats.processedSize)}</span>
                </div>
              </div>

              {/* Highlight savings banner */}
              {stats.originalSize > 0 && stats.processedSize < stats.originalSize && (
                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  ¡Ahorraste {((stats.originalSize - stats.processedSize) / stats.originalSize * 100).toFixed(0)}% del espacio en el almacenamiento local!
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex gap-3 w-full">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 border border-rose-900/30 hover:border-rose-900/50 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Descartar Lote
                </button>
                <button
                  onClick={handleSaveToDevice}
                  disabled={stats.count === 0}
                  className="flex-[1.5] py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Guardar en Dispositivo
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
