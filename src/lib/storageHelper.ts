import { supabase } from './supabaseClient';

const BUCKET_NAME = 'book-covers';

export interface UploadImageResult {
  url: string | null;
  error: string | null;
}

export const uploadBookCover = async (file: File): Promise<UploadImageResult> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { url: null, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch (err) {
    console.error('Unexpected error during upload:', err);
    return { 
      url: null, 
      error: err instanceof Error ? err.message : '上传过程中发生未知错误' 
    };
  }
};

export const deleteBookCover = async (imageUrl: string | null): Promise<boolean> => {
  if (!imageUrl) return true;

  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    
    if (pathParts.length < 2) {
      console.warn('Invalid image URL format, skipping deletion');
      return true;
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting image:', err);
    return false;
  }
};

export const validateImageFile = (file: File): string | null => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024;

  if (!validTypes.includes(file.type)) {
    return '请上传有效的图片文件（JPEG、PNG、GIF 或 WebP）';
  }

  if (file.size > maxSize) {
    return '图片大小不能超过 5MB';
  }

  return null;
};
