export type ClubRoomAudioState = {
  error: string;
  isConfigured: boolean;
  isConnected: boolean;
  isMuted: boolean;
  status: 'unavailable' | 'connecting' | 'connected' | 'error';
  toggleMute: () => Promise<void>;
};

export async function disconnectRoomAudio() {}

export async function revokeRoomAudioPublisher() {}

export async function closeRoomAudio() {}

export function useClubRoomAudio(): ClubRoomAudioState {
  return {
    error: '',
    isConfigured: false,
    isConnected: false,
    isMuted: true,
    status: 'unavailable',
    toggleMute: async () => undefined,
  };
}
