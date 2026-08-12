/**
 * Copia una imagen (desde una URL base64 o blob URL) al portapapeles del sistema.
 * Ojo: navigator.clipboard.write solo soporta PNG de forma fiable en la mayoría de navegadores.
 * Si es un JPG o WebP, lo convertimos al vuelo usando un canvas temporal.
 * 
 * @param {string} imageSrc - Ruta de la imagen (base64 data URL o un Blob object URL).
 * @returns {Promise<boolean>} Devuelve true si todo salió bien, o false si falló.
 */
export async function copyImageToClipboard(imageSrc) {
  try {
    // 1. Obtenemos los datos de la imagen y los pasamos a un objeto Blob
    const response = await fetch(imageSrc);
    let blob = await response.blob();

    // 2. Si no es un PNG, toca convertirlo a PNG sí o sí
    if (blob.type !== 'image/png') {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => reject(new Error('No se pudo cargar la imagen para convertirla a PNG'));
      });

      // Creamos un canvas temporal con el tamaño exacto de la imagen
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo obtener el contexto 2D del canvas');
      }

      ctx.drawImage(img, 0, 0);
      
      // Prometificamos la exportación del canvas a blob PNG
      const pngBlob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      
      if (!pngBlob) {
        throw new Error('La conversión de la imagen a PNG falló');
      }
      blob = pngBlob;
    }

    // 3. Escribimos el blob PNG resultante en el portapapeles
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return true;
  } catch (error) {
    console.error('Error al copiar la imagen al portapapeles:', error);
    return false;
  }
}
