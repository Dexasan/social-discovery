import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
  type MediaStreamTrack,
} from '@cloudflare/react-native-webrtc';

import { supabase } from '@/lib/supabase';

type SessionDescription = { sdp: string; type: 'offer' | 'answer' };
type SessionKind = 'publisher' | 'subscriber';
type GatewayResponse = {
  mediaSessionId?: string;
  provider?: { sessionDescription?: SessionDescription } | null;
  trackCount?: number;
};
type AudioSessionRecord = { published_track_name?: unknown; session_kind?: unknown; status?: unknown };

export type DirectCallAudioState = {
  error: string;
  isConfigured: boolean;
  isConnected: boolean;
  isMuted: boolean;
  status: 'unavailable' | 'connecting' | 'connected' | 'error';
  toggleMute: () => Promise<void>;
};

const isCloudflareConfigured = process.env.EXPO_PUBLIC_CLOUDFLARE_REALTIME_ENABLED === 'true';
const peerConfiguration = {
  bundlePolicy: 'max-bundle' as const,
  iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
};

async function gateway(body: Record<string, unknown>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke<GatewayResponse>('cloudflare-room-audio', { body });
  if (error) throw error;
  return data;
}

async function createMediaSession(callId: string, sessionKind: SessionKind) {
  const data = await gateway({ action: 'create_session', call_id: callId, session_kind: sessionKind });
  if (!data?.mediaSessionId) throw new Error('The audio gateway did not create a session.');
  return data.mediaSessionId;
}

async function closeMediaSession(mediaSessionId: string) {
  await gateway({ action: 'close_session', media_session_id: mediaSessionId });
}

export async function disconnectDirectCallAudio(callId: string) {
  if (!isCloudflareConfigured) return;
  await gateway({ action: 'disconnect', call_id: callId });
}

export async function ensureDirectCallMicrophonePermission() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone access',
    message: 'YAPPIE needs microphone access for your private audio call.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function description(value: { sdp?: string; type?: string | null } | null) {
  if (!value?.sdp || (value.type !== 'offer' && value.type !== 'answer')) {
    throw new Error('Cloudflare returned an invalid WebRTC description.');
  }
  return { sdp: value.sdp, type: value.type } as SessionDescription;
}

async function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const eventPeer = peer as unknown as {
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      eventPeer.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (peer.iceGatheringState === 'complete' || peer.signalingState === 'closed') finish();
    };
    const timeout = setTimeout(finish, 3_000);
    eventPeer.addEventListener('icegatheringstatechange', onStateChange);
  });
}

async function createLocalOffer(peer: RTCPeerConnection) {
  const offer = description(await peer.createOffer({}));
  await peer.setLocalDescription(offer);
  await waitForIceGathering(peer);
  return description(peer.localDescription);
}

async function createLocalAnswer(peer: RTCPeerConnection) {
  const answer = description(await peer.createAnswer());
  await peer.setLocalDescription(answer);
  await waitForIceGathering(peer);
  return description(peer.localDescription);
}

function affectsPublishedTracks(value: AudioSessionRecord | null) {
  return value?.session_kind === 'publisher'
    && (value.status !== 'active' || typeof value.published_track_name === 'string');
}

export function useDirectCallAudio(callId: string | undefined, enabled: boolean): DirectCallAudioState {
  const localTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<MediaStream[]>([]);
  const [publisherReady, setPublisherReady] = useState(false);
  const [subscriberReady, setSubscriberReady] = useState(false);
  const [audioRevision, setAudioRevision] = useState(0);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!callId || !enabled || !isCloudflareConfigured || !supabase) return;
    const client = supabase;
    let revisionTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = client
      .channel(`call:${callId}:audio-tracks`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_audio_sessions', filter: `call_id=eq.${callId}` },
        (payload) => {
          if (!affectsPublishedTracks(payload.new as AudioSessionRecord)) return;
          if (revisionTimer) clearTimeout(revisionTimer);
          revisionTimer = setTimeout(() => setAudioRevision((revision) => revision + 1), 350);
        },
      )
      .subscribe();
    return () => {
      if (revisionTimer) clearTimeout(revisionTimer);
      void client.removeChannel(channel);
    };
  }, [callId, enabled]);

  useEffect(() => {
    setPublisherReady(false);
    setIsMuted(false);
    localTrackRef.current = null;
    localStreamRef.current = null;
    if (!callId || !enabled || !isCloudflareConfigured) return;
    let active = true;
    let peer: RTCPeerConnection | null = null;
    let mediaSessionId: string | null = null;

    const publish = async () => {
      if (!(await ensureDirectCallMicrophonePermission())) throw new Error('Microphone permission is required for a call.');
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone audio track is available.');
      track.enabled = true;
      localStreamRef.current = stream;
      localTrackRef.current = track;
      mediaSessionId = await createMediaSession(callId, 'publisher');
      if (!active) return;
      peer = new RTCPeerConnection(peerConfiguration);
      peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      const offer = await createLocalOffer(peer);
      const result = await gateway({ action: 'publish', media_session_id: mediaSessionId, session_description: offer });
      const answer = description(result?.provider?.sessionDescription ?? null);
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      if (active) setPublisherReady(true);
    };

    void publish().catch((nextError: unknown) => {
      if (active) setError(nextError instanceof Error ? nextError.message : 'Could not send call audio.');
    });
    return () => {
      active = false;
      peer?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      localTrackRef.current = null;
      if (mediaSessionId) void closeMediaSession(mediaSessionId).catch(() => undefined);
    };
  }, [callId, enabled]);

  useEffect(() => {
    setSubscriberReady(false);
    remoteStreamsRef.current = [];
    if (!callId || !enabled || !isCloudflareConfigured) return;
    let active = true;
    let peer: RTCPeerConnection | null = null;
    let mediaSessionId: string | null = null;

    const subscribe = async () => {
      mediaSessionId = await createMediaSession(callId, 'subscriber');
      if (!active) return;
      peer = new RTCPeerConnection(peerConfiguration);
      const eventPeer = peer as unknown as {
        addEventListener: (type: string, listener: (event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => void) => void;
      };
      eventPeer.addEventListener('track', (event) => {
        if (event.track) event.track.enabled = true;
        for (const stream of event.streams) {
          if (!remoteStreamsRef.current.some((existing) => existing.id === stream.id)) {
            remoteStreamsRef.current = [...remoteStreamsRef.current, stream];
          }
        }
      });
      const result = await gateway({ action: 'pull', media_session_id: mediaSessionId });
      if (!result?.trackCount) {
        peer.close();
        peer = null;
        await closeMediaSession(mediaSessionId);
        mediaSessionId = null;
        if (active) setSubscriberReady(true);
        return;
      }
      const offer = description(result.provider?.sessionDescription ?? null);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await createLocalAnswer(peer);
      await gateway({ action: 'renegotiate', media_session_id: mediaSessionId, session_description: answer });
      if (active) setSubscriberReady(true);
    };

    void subscribe().catch((nextError: unknown) => {
      if (active) setError(nextError instanceof Error ? nextError.message : 'Could not receive call audio.');
    });
    return () => {
      active = false;
      remoteStreamsRef.current.forEach((stream) => stream.release(false));
      peer?.close();
      remoteStreamsRef.current = [];
      if (mediaSessionId) void closeMediaSession(mediaSessionId).catch(() => undefined);
    };
  }, [audioRevision, callId, enabled]);

  useEffect(() => {
    setError('');
    setPublisherReady(false);
    setSubscriberReady(false);
  }, [callId, enabled]);

  const toggleMute = async () => {
    if (!localTrackRef.current) return;
    const nextMuted = !isMuted;
    localTrackRef.current.enabled = !nextMuted;
    setIsMuted(nextMuted);
  };
  const isConnected = enabled && publisherReady && subscriberReady;
  const status: DirectCallAudioState['status'] = !isCloudflareConfigured
    ? 'unavailable'
    : error
      ? 'error'
      : isConnected
        ? 'connected'
        : 'connecting';

  return { error, isConfigured: isCloudflareConfigured, isConnected, isMuted, status, toggleMute };
}
