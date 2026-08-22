export type DirectCallAudioState = {
  error: string;
  isConfigured: boolean;
  isConnected: boolean;
  isMuted: boolean;
  status: 'unavailable' | 'connecting' | 'connected' | 'error';
  toggleMute: () => Promise<void>;
};

export async function disconnectDirectCallAudio() {}

export async function ensureDirectCallMicrophonePermission() { return false; }

export function useDirectCallAudio(): DirectCallAudioState {
  return {
    error: '',
    isConfigured: false,
    isConnected: false,
    isMuted: true,
    status: 'unavailable',
    toggleMute: async () => undefined,
  };
}
