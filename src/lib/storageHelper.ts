import { supabase } from './supabaseClient';

const BUCKET_NAME = 'book-covers';
const STORAGE_OBJECT_SEGMENT = '/storage/v1/object/';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export interface UploadImageResult {
  url: string | null;
  path: string | null;
  error: string | null;
}

type StoragePathInfo = {
  bucket: string;
  path: string;
};

const normalizePath = (path: string): string => path.replace(/^\/+/, '');

const extractStoragePath = (input: string | null | undefined): StoragePathInfo | null => {
  if (!input) return null;

  if (input.startsWith('blob:') || input.startsWith('data:')) {
    return null;
  }

  if (!input.startsWith('http')) {
    return {
      bucket: BUCKET_NAME,
      path: normalizePath(input),
    };
  }

  try {
    const url = new URL(input);
    const [, rest] = url.pathname.split(STORAGE_OBJECT_SEGMENT);
    if (!rest) return null;

    const segments = rest.split('/');
    const mode = segments.shift();
    if (!mode) return null;

    const bucket = segments.shift();
    if (!bucket) return null;

    const path = segments.join('/');
    if (!path) return null;

    return {
      bucket,
      path: normalizePath(path),
    };
  } catch (err) {
    console.warn('Failed to parse storage path from url:', err);
    return null;
  }
};

const createSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      console.warn('Failed to create signed URL:', error);
      return null;
    }

    return data?.signedUrl ?? null;
  } catch (err) {
    console.error('Unexpected error while creating signed URL:', err);
    return null;
  }
};

const getPublicUrl = (bucket: string, path: string): string | null => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

export const resolveCoverImageUrl = async (source?: string | null): Promise<string | null> => {
  if (!source) return null;

  if (source.startsWith('blob:') || source.startsWith('data:')) {
    return source;
  }

  if (source.includes('/storage/v1/object/sign/') && source.includes('?token=')) {
    return source;
  }

  const storagePath = extractStoragePath(source);

  if (!storagePath) {
    return source;
  }

  const signedUrl = await createSignedUrl(storagePath.bucket, storagePath.path);
  if (signedUrl) {
    return signedUrl;
  }

  const publicUrl = getPublicUrl(storagePath.bucket, storagePath.path);
  if (publicUrl) {
    return publicUrl;
  }

  return source;
};

export const uploadBookCover = async (file: File): Promise<UploadImageResult> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      const errorMsg = uploadError.message || '上传失败';

      if (/bucket/i.test(errorMsg) && /not\sfound|does\snot\sexist/i.test(errorMsg)) {
        return {
          url: null,
          path: null,
          error:
            '存储桶未找到。请先在 Supabase Dashboard 中创建名为 "book-covers" 的存储桶，并设置为 public。详情请参考 STORAGE_SETUP.md',
        };
      }

      return { url: null, path: null, error: errorMsg };
    }

    if (!uploadData?.path) {
      console.error('Upload succeeded but no path returned');
      return { url: null, path: null, error: '上传失败：未返回文件路径' };
    }

    const normalizedPath = normalizePath(uploadData.path);

    const signedUrl = await createSignedUrl(BUCKET_NAME, normalizedPath);
    const publicUrl = getPublicUrl(BUCKET_NAME, normalizedPath);

    return {
      url: signedUrl ?? publicUrl,
      path: normalizedPath,
      error: null,
    };
  } catch (err) {
    console.error('Unexpected error during upload:', err);
    return {
      url: null,
      path: null,
      error: err instanceof Error ? err.message : '上传过程中发生未知错误',
    };
  }
};

export const deleteBookCover = async (imageIdentifier: string | null): Promise<boolean> => {
  if (!imageIdentifier) return true;

  const storagePath = extractStoragePath(imageIdentifier);
  if (!storagePath) {
    console.warn('Unable to resolve storage path for cover image, skipping deletion');
    return true;
  }

  try {
    const { error } = await supabase.storage.from(storagePath.bucket).remove([storagePath.path]);

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
