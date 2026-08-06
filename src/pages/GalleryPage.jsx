import { copyImageToClipboard } from '../utils/clipboard'

export default function GalleryPage({ images, onDeleteImage, showToast }) {
  
  const handleCopy = async (imgSrc, index) => {
    showToast(`Copiando imagen #${index + 1}...`, 'info')
    const success = await copyImageToClipboard(imgSrc)
    if (success) {
      showToast(`¡Imagen #${index + 1} copiada al portapapeles!`, 'success')
    } else {
      showToast('No se pudo copiar la imagen al portapapeles', 'error')
    }
  }

  const getFileSize = (srcString) => {
    if (!srcString) return '0 KB'
    // If it is a blob URL (starts with blob:) we can't easily get the length from base64, 
    // so we return a placeholder or calculate based on fetch length if we were async, 
    // but a default/placeholder is safe.
    if (srcString.startsWith('blob:')) {
      return 'Generada por IA'
    }
    const base64Data = srcString.split(',')[1]
    if (!base64Data) return 'Desconocido'
    const sizeInBytes = Math.round((base64Data.length * 3) / 4)
    if (sizeInBytes > 1024 * 1024) {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${Math.round(sizeInBytes / 1024)} KB`
  }

  return (
    <div className="flex-1 flex flex-col p-6 w-full max-w-6xl mx-auto z-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 text-left">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Galería de Imágenes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Colección de imágenes capturadas y guardadas en tu navegador.
          </p>
        </div>

        <div className="flex flex-col sm:items-end space-y-1.5 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacidad de la Galería</span>
          <div className="flex items-center space-x-2">
            <div className="w-28 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
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

      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl p-12 bg-slate-900/20 backdrop-blur-xl min-h-[320px] transition-all duration-300">
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
            Carga o pega una imagen en la pestaña de carga para empezar a gestionarlas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {images.map((img, index) => (
            <div
              key={index}
              className="group relative bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden hover:border-indigo-500/30 hover:shadow-[0_10px_30px_-15px_rgba(99,102,241,0.2)] transition-all duration-300 flex flex-col"
            >
              {/* Image Preview Container */}
              <div className="aspect-video w-full overflow-hidden bg-checkerboard flex items-center justify-center relative p-3 border-b border-slate-950">
                <img
                  className="object-contain w-full h-full max-h-[140px] group-hover:scale-102 transition-transform duration-500"
                  src={img}
                  alt={`Imagen ${index + 1}`}
                />

                {/* Hover Overlay with actions */}
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleCopy(img, index)}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                    title="Copiar al portapapeles"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>

                  <button
                    onClick={() => onDeleteImage(index)}
                    className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                    title="Eliminar imagen"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Card Footer Details */}
              <div className="p-3 flex justify-between items-center bg-slate-900/60 backdrop-blur-md">
                <div className="flex flex-col text-left">
                  <span className="text-[11px] text-indigo-400 font-bold tracking-wider uppercase">
                    Imagen #{index + 1}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {getFileSize(img)}
                  </span>
                </div>

                <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => handleCopy(img, index)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/60 rounded-lg transition-all duration-200 cursor-pointer"
                    title="Copiar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteImage(index)}
                    className="p-1.5 text-slate-400 hover:text-rose-450 hover:bg-slate-800/60 rounded-lg transition-all duration-200 cursor-pointer"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

