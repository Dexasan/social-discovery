import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const maximumImageBytes = 5 * 1024 * 1024;
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export function clubAvatarPublicUrl(path: string | null | undefined) {
  if (!path || !supabase) return null;
  return supabase.storage.from('club-avatars').getPublicUrl(path).data.publicUrl;
}

export async function chooseClubAvatar() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to choose a Club picture.');
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
  if (asset.fileSize && asset.fileSize > maximumImageBytes) throw new Error('Choose an image smaller than 5 MB.');
  return asset;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadClubAvatar(clubId: string, asset: ImagePicker.ImagePickerAsset, previousPath: string | null) {
  const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('The selected Club picture could not be read.');
  const file = await response.arrayBuffer();
  if (file.byteLength > maximumImageBytes) throw new Error('Choose an image smaller than 5 MB.');
  const nextPath = `${clubId}/avatar-${Date.now()}.${extensionFor(mimeType)}`;
  const { error: uploadError } = await client().storage.from('club-avatars').upload(nextPath, file, {
    cacheControl: '31536000',
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: profileError } = await client().rpc('set_club_avatar', {
    target_avatar_path: nextPath,
    target_club_id: clubId,
  });
  if (profileError) {
    await client().storage.from('club-avatars').remove([nextPath]).catch(() => undefined);
    throw profileError;
  }
  if (previousPath && previousPath !== nextPath) {
    await client().storage.from('club-avatars').remove([previousPath]).catch(() => undefined);
  }
  return nextPath;
}
