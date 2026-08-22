import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const maximumAvatarBytes = 5 * 1024 * 1024;
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export function avatarPublicUrl(path: string | null | undefined) {
  if (!path || !supabase) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function chooseAndUploadAvatar(userId: string, previousPath: string | null) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to choose your profile picture.');

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.82,
    selectionLimit: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
  if (!supportedTypes.has(mimeType)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (asset.fileSize && asset.fileSize > maximumAvatarBytes) throw new Error('Choose an image smaller than 5 MB.');

  const fileResponse = await fetch(asset.uri);
  if (!fileResponse.ok) throw new Error('The selected photo could not be read.');
  const file = await fileResponse.arrayBuffer();
  if (file.byteLength > maximumAvatarBytes) throw new Error('Choose an image smaller than 5 MB.');

  const nextPath = `${userId}/avatar-${Date.now()}.${extensionFor(mimeType)}`;
  const { error: uploadError } = await client().storage.from('avatars').upload(nextPath, file, {
    cacheControl: '31536000',
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: profileError } = await client().from('profiles').update({ avatar_path: nextPath }).eq('id', userId);
  if (profileError) {
    await client().storage.from('avatars').remove([nextPath]).catch(() => undefined);
    throw profileError;
  }
  if (previousPath && previousPath !== nextPath) {
    await client().storage.from('avatars').remove([previousPath]).catch(() => undefined);
  }
  return nextPath;
}

export async function removeAvatar(userId: string, path: string) {
  const { error: profileError } = await client().from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (profileError) throw profileError;
  await client().storage.from('avatars').remove([path]).catch(() => undefined);
}
