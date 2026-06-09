import { supabase } from './supabase';

/**
 * Compresses an image file on the client side using an HTML5 Canvas.
 * This reduces image file sizes from several megabytes down to 100-200kb
 * while preserving high visual quality, enabling instant uploads and faster page loads.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file; // If not an image, return untouched
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              // Return compressed file if it's actually smaller, otherwise fallback to original
              resolve(compressedFile.size < file.size ? compressedFile : file);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file to Supabase storage with bucket fallback logic and local storage caching.
 * Caching the working bucket eliminates sequential latency/timeouts on subsequent uploads.
 */
export async function uploadFileWithFallback(
  file: File,
  folder: string,
  customFileName?: string
): Promise<string> {
  const compressedFile = await compressImage(file);
  const fileExt = compressedFile.name.split('.').pop() || 'jpg';
  const fileName = customFileName || `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const candidates = ['product-images', 'product images', 'custom-orders'];
  
  // Retrieve cached bucket if one was successfully used in past
  let workingBucket = localStorage.getItem('sb_working_bucket') || 'product-images';
  let success = false;
  let lastError = null;

  // Try the primary/cached bucket first
  try {
    const { error } = await supabase.storage.from(workingBucket).upload(filePath, compressedFile);
    if (!error) {
      success = true;
      localStorage.setItem('sb_working_bucket', workingBucket);
    } else {
      lastError = error;
    }
  } catch (err) {
    lastError = err;
  }

  // If cached bucket fails, rotate through other prospective candidates
  if (!success) {
    for (const bucket of candidates) {
      if (bucket === workingBucket) continue; // Already tried
      try {
        const { error } = await supabase.storage.from(bucket).upload(filePath, compressedFile);
        if (!error) {
          workingBucket = bucket;
          localStorage.setItem('sb_working_bucket', bucket);
          success = true;
          break;
        } else {
          lastError = error;
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (!success) {
    throw lastError || new Error('All cloud storage target buckets failed to initialize upload access.');
  }

  const { data: { publicUrl } } = supabase.storage
    .from(workingBucket)
    .getPublicUrl(filePath);

  return publicUrl;
}
