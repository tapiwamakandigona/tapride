import { supabase } from './supabase';

const BUCKET = 'driver-documents';

export async function uploadFile(
  file: File,
  userId: string,
  folder: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(url: string): Promise<void> {
  // Extract path from public URL
  const match = url.match(/\/storage\/v1\/object\/public\/driver-documents\/(.+)$/);
  if (!match) return;

  await supabase.storage.from(BUCKET).remove([match[1]]);
}
