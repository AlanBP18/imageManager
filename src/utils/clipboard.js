/**
 * Copies an image (from a data URL or blob URL) to the system clipboard.
 * Converts non-PNG images to PNG since navigator.clipboard.write only reliably supports PNG.
 * 
 * @param {string} imageSrc - The source of the image (base64 data URL or Blob object URL).
 * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
 */
export async function copyImageToClipboard(imageSrc) {
  try {
    // 1. Fetch the image to get it as a Blob
    const response = await fetch(imageSrc);
    let blob = await response.blob();

    // 2. Convert to PNG if it's not already a PNG
    if (blob.type !== 'image/png') {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => reject(new Error('Failed to load image for PNG conversion'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D context from canvas');
      }

      ctx.drawImage(img, 0, 0);
      
      const pngBlob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      
      if (!pngBlob) {
        throw new Error('Failed to convert image to PNG Blob');
      }
      blob = pngBlob;
    }

    // 3. Write blob to the clipboard
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return true;
  } catch (error) {
    console.error('Error copying image to clipboard:', error);
    return false;
  }
}
