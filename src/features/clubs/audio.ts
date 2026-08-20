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

type RoomRole = 'host' | 'speaker' | 'listener';
type SessionKind = 'publisher' | 'subscriber';
type SessionDescription = { sdp: string; type: 'offer' | 'answer' };

type GatewayResponse = {
  closed?: boolean;
  mediaSessionId?: string;
  provider?: {
    requiresImmediateRenegotiation?: boolean;
    sessionDescription?: SessionDescription;
    tracks?: Array<{ mid?: string; trackName?: string }>;
  } | null;
  trackCount?: number;
};

type AudioSessionRecord = {
  published_track_name?: unknown;
  session_kind?: unknown;
  status?: unknown;
};

export type ClubRoomAudioState = {
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

async function createMediaSession(roomId: string, sessionKind: SessionKind) {
  const data = await gateway({ action: 'create_session', room_id: roomId, session_kind: sessionKind });
  if (!data?.mediaSessionId) throw new Error('The audio gateway did not create a session.');
  return data.mediaSessionId;
}

async function closeMediaSession(mediaSessionId: string) {
  await gateway({ action: 'close_session', media_session_id: mediaSessionId });
}

export async function disconnectRoomAudio(roomId: string) {
  if (!isCloudflareConfigured) return;
  await gateway({ action: 'disconnect', room_id: roomId });
}

export async function revokeRoomAudioPublisher(roomId: string, targetUserId: string) {
  if (!isCloudflareConfigured) return;
  await gateway({ action: 'revoke_publisher', room_id: roomId, target_user_id: targetUserId });
}

export async function closeRoomAudio(roomId: string) {
  if (!isCloudflareConfigured) return;
  await gateway({ action: 'close_room', room_id: roomId });
}

async function requestMicrophonePermission() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone access',
    message: 'Speakers need microphone access to talk in live Club rooms.',
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

export function useClubRoomAudio(roomId: string | undefined, role: RoomRole | undefined): ClubRoomAudioState {
  const localTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<MediaStream[]>([]);
  const [publisherReady, setPublisherReady] = useState(false);
  const [subscriberReady, setSubscriberReady] = useState(false);
  const [audioRevision, setAudioRevision] = useState(0);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const canPublish = role === 'host' || role === 'speaker';

  useEffect(() => {
    if (!roomId || !role || !isCloudflareConfigured || !supabase) return;
    const client = supabase;
    let revisionTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = client
      .channel(`room:${roomId}:audio-tracks`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_audio_sessions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (!affectsPublishedTracks(payload.new as AudioSessionRecord)) return;
          if (revisionTimer) clearTimeout(revisionTimer);
          revisionTimer = setTimeout(() => setAudioRevision((revision) => revision + 1), 400);
        },
      )
      .subscribe();
    return () => {
      if (revisionTimer) clearTimeout(revisionTimer);
      void client.removeChannel(channel);
    };
  }, [role, roomId]);

  useEffect(() => {
    setPublisherReady(!canPublish);
    setIsMuted(true);
    localTrackRef.current = null;
    localStreamRef.current = null;

    if (!roomId || !role || !isCloudflareConfigured || !canPublish) return;
    let active = true;
    let peer: RTCPeerConnection | null = null;
    let mediaSessionId: string | null = null;

    const publish = async () => {
      if (!(await requestMicrophonePermission())) throw new Error('Microphone permission is required to join the stage.');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone audio track is available.');
      track.enabled = false;
      localStreamRef.current = stream;
      localTrackRef.current = track;

      mediaSessionId = await createMediaSession(roomId, 'publisher');
      if (!active) return;
      peer = new RTCPeerConnection(peerConfiguration);
      peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      const offer = await createLocalOffer(peer);
      const result = await gateway({
        action: 'publish',
        media_session_id: mediaSessionId,
        session_description: offer,
      });
      const answer = description(result?.provider?.sessionDescription ?? null);
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      if (active) setPublisherReady(true);
    };

    void publish().catch((nextError: unknown) => {
      if (active) setError(nextError instanceof Error ? nextError.message : 'Could not publish live audio.');
    });

    return () => {
      active = false;
      peer?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      localTrackRef.current = null;
      if (mediaSessionId) void closeMediaSession(mediaSessionId).catch(() => undefined);
    };
  }, [canPublish, role, roomId]);

  useEffect(() => {
    setSubscriberReady(false);
    remoteStreamsRef.current = [];
    if (!roomId || !role || !isCloudflareConfigured) return;
    let active = true;
    let peer: RTCPeerConnection | null = null;
    let mediaSessionId: string | null = null;

    const subscribe = async () => {
      mediaSessionId = await createMediaSession(roomId, 'subscriber');
      if (!active) return;
      peer = new RTCPeerConnection(peerConfiguration);
      const eventPeer = peer as unknown as {
        addEventListener: (
          type: string,
          listener: (event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => void,
        ) => void;
      };
      eventPeer.addEventListener('track', (event) => {
        const remoteTrack = event.track;
        if (remoteTrack) {
          remoteTrack.enabled = true;
        }
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
      await gateway({
        action: 'renegotiate',
        media_session_id: mediaSessionId,
        session_description: answer,
      });
      if (active) setSubscriberReady(true);
    };

    void subscribe().catch((nextError: unknown) => {
      if (active) setError(nextError instanceof Error ? nextError.message : 'Could not receive live audio.');
    });

    return () => {
      active = false;
      remoteStreamsRef.current.forEach((stream) => stream.release(false));
      peer?.close();
      remoteStreamsRef.current = [];
      if (mediaSessionId) void closeMediaSession(mediaSessionId).catch(() => undefined);
    };
  }, [audioRevision, role, roomId]);

  useEffect(() => {
    setError('');
    setPublisherReady(!canPublish);
    setSubscriberReady(false);
  }, [canPublish, role, roomId]);

  const toggleMute = async () => {
    if (!canPublish || !localTrackRef.current) return;
    const nextMuted = !isMuted;
    localTrackRef.current.enabled = !nextMuted;
    setIsMuted(nextMuted);
  };

  const isConnected = Boolean(role && publisherReady && subscriberReady);
  const status: ClubRoomAudioState['status'] = !isCloudflareConfigured
    ? 'unavailable'
    : error
      ? 'error'
      : isConnected
        ? 'connected'
        : 'connecting';

  return {
    error,
    isConfigured: isCloudflareConfigured,
    isConnected,
    isMuted,
    status,
    toggleMute,
  };
}
