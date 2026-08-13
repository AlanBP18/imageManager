import { useState, useEffect } from 'react'
import DropZonePage from './pages/DropZonePage'
import BatchPage from './pages/BatchPage'
import GalleryPage from './pages/GalleryPage'
import GooeyBackground from './components/GooeyBackground'

export default function App() {
  const [currentPage, setCurrentPage] = useState('dropzone')
  const [images, setImages] = useState(() => {
    const saved = localStorage.getItem('imageManager_images')
    return saved ? JSON.parse(saved) : []
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    localStorage.setItem('imageManager_images', JSON.stringify(images))
  }, [images])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleAddImage = (newImage) => {
    if (images.length >= 5) {
      showToast('La galería ha alcanzado el límite máximo de 5 imágenes. Elimina alguna para guardar.', 'error')
      return false
    }
    setImages((prev) => [newImage, ...prev])
    setCurrentPage('gallery')
    showToast('Imagen guardada en la galería con éxito', 'success')
    return true
  }

  const handleAddMultipleImages = (newImages) => {
    setImages((prev) => [...newImages, ...prev])
    setCurrentPage('gallery')
    showToast(`¡${newImages.length} imágenes guardadas en la galería!`, 'success')
  }


  const handleDeleteImage = (indexToDelete) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToDelete))
    showToast('Imagen eliminada de la galería', 'info')
  }

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col overflow-hidden relative selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Fondo dinámico estilo lámpara de lava (burbujas gooey) */}
      <GooeyBackground />

      <header className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentPage('dropzone')}>
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-transform hover:scale-105" />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-200 via-purple-200 to-slate-100 bg-clip-text text-transparent">
              ImageManager
            </span>
          </div>

          <nav className="flex space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setCurrentPage('dropzone')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                currentPage === 'dropzone'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cargar
            </button>
            <button
              onClick={() => setCurrentPage('batch')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                currentPage === 'batch'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Procesar Lote
            </button>
            <button
              onClick={() => setCurrentPage('gallery')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 relative cursor-pointer ${
                currentPage === 'gallery'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Galería
              {images.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 border border-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center text-white scale-90">
                  {images.length}
                </span>
              )}
            </button>
          </nav>

        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        <div className={currentPage === 'dropzone' ? 'flex-1 flex flex-col' : 'hidden'}>
          <DropZonePage onAddImage={handleAddImage} showToast={showToast} />
        </div>
        <div className={currentPage === 'batch' ? 'flex-1 flex flex-col' : 'hidden'}>
          <BatchPage showToast={showToast} />
        </div>
        <div className={currentPage === 'gallery' ? 'flex-1 flex flex-col' : 'hidden'}>
          <GalleryPage images={images} onDeleteImage={handleDeleteImage} showToast={showToast} />
        </div>
      </main>


      {/* Notificaciones flotantes (toast) tipo alerta en la esquina inferior derecha */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-950/70 border-rose-800/50 text-rose-200'
              : toast.type === 'info'
              ? 'bg-slate-900/90 border-slate-800 text-slate-200'
              : 'bg-emerald-950/70 border-emerald-800/50 text-emerald-200'
          }`}>
            {toast.type === 'error' ? (
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            ) : toast.type === 'info' ? (
              <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-200 pl-2 focus:outline-none cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
