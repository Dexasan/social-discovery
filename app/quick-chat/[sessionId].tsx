import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GiftPicker } from '@/components/GiftPicker';
import { Avatar, Muted } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import {
  blockProfile,
  leaveQuickChat,
  loadConversationMessages,
  loadPublicProfile,
  reportProfile,
  sendConversationMessage,
  subscribeToConversationMessages,
  type Message,
  type PublicProfile,
} from '@/features/quick-chat/api';
import { colors, radius, spacing } from '@/theme/tokens';
import { followProfile, getOrCreateDirectConversation } from '@/features/social/api';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function QuickChatConversationScreen() {
  const params = useLocalSearchParams<{ sessionId: string; conversationId: string; partnerId: string }>();
  const sessionId = first(params.sessionId);
  const conversationId = first(params.conversationId);
  const partnerId = first(params.partnerId);
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<PublicProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [giftPickerVisible, setGiftPickerVisible] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const addMessage = (message: Message) => {
    setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
  };

  useEffect(() => {
    if (!conversationId || !partnerId) return;
    let active = true;

    void Promise.all([loadConversationMessages(conversationId), loadPublicProfile(partnerId)])
      .then(([nextMessages, nextPartner]) => {
        if (!active) return;
        setMessages(nextMessages);
        setPartner(nextPartner);
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Could not open this conversation.');
      });

    const unsubscribe = subscribeToConversationMessages(conversationId, addMessage);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId, partnerId]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !conversationId || !user || sending) return;
    setSending(true);
    setError('');
    setDraft('');

    try {
      const message = await sendConversationMessage(conversationId, user.id, body);
      addMessage(message);
    } catch (nextError) {
      setDraft(body);
      setError(nextError instanceof Error ? nextError.message : 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const endChat = async (reason: 'left' | 'blocked' | 'reported') => {
    if (sessionId) await leaveQuickChat(sessionId, reason);
    router.replace('/(tabs)/quick-chat');
  };

  const keepInTouch = async () => {
    if (!user || !partnerId || keeping || kept) return;
    setKeeping(true);
    setError('');
    try {
      await Promise.all([
        followProfile(user.id, partnerId),
        getOrCreateDirectConversation(partnerId),
      ]);
      setKept(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save this connection.');
    } finally {
      setKeeping(false);
    }
  };

  const confirmBlock = () => {
    if (!user || !partnerId) return;
    Alert.alert('Block this person?', 'You will not be matched or messaged by this account again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => void blockProfile(user.id, partnerId).then(() => endChat('blocked')).catch((nextError: unknown) => {
          setError(nextError instanceof Error ? nextError.message : 'Could not block this account.');
        }),
      },
    ]);
  };

  const confirmReport = () => {
    if (!user || !partnerId) return;
    Alert.alert('Report this conversation?', 'The moderation queue will receive the account and conversation context.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => void reportProfile(user.id, partnerId, `Reported from Quick Chat session ${sessionId ?? 'unknown'}`)
          .then(() => endChat('reported'))
          .catch((nextError: unknown) => {
            setError(nextError instanceof Error ? nextError.message : 'Could not submit the report.');
          }),
      },
    ]);
  };

  const partnerName = partner?.display_name || (partner?.handle ? `@${partner.handle}` : 'Quick Chat');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Leave conversation" onPress={() => void endChat('left')} style={styles.headerAction}>
            <Text style={styles.headerActionText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Open ${partnerName}'s profile`}
            accessibilityRole="button"
            disabled={!partnerId}
            onPress={() => partnerId && router.push({ pathname: '/people/[userId]', params: { userId: partnerId } })}
            style={styles.profileLink}
          >
            <Avatar label={partnerName} path={partner?.avatar_path} size={42} />
            <View style={styles.headerIdentity}>
              <Text style={styles.partnerName}>{partnerName}</Text>
              <Muted>Connected now · View profile</Muted>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={confirmReport} style={styles.textAction}>
            <Text style={styles.textActionLabel}>Report</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={confirmBlock} style={styles.textAction}>
            <Text style={styles.blockLabel}>Block</Text>
          </Pressable>
        </View>

        <View style={styles.keepRow}>
          <Text style={styles.keepCopy}>Want to talk again later?</Text>
          <Pressable accessibilityRole="button" disabled={keeping || kept} onPress={() => void keepInTouch()} style={[styles.keepButton, kept && styles.keepButtonDone]}>
            <Text style={styles.keepButtonText}>{kept ? 'Saved ✓' : keeping ? 'Saving…' : 'Follow + keep chat'}</Text>
          </Pressable>
        </View>

        <FlatList
          contentContainerStyle={styles.messages}
          data={messages}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Say hello. Keep it kind.</Text>}
          ref={listRef}
          renderItem={({ item }) => {
            const own = item.sender_id === user?.id;
            return (
              <View style={[styles.bubble, own ? styles.ownBubble : styles.theirBubble]}>
                <Text style={[styles.messageText, own && styles.ownMessageText]}>{item.body}</Text>
              </View>
            );
          }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <Pressable accessibilityLabel="Send a virtual gift" accessibilityRole="button" onPress={() => setGiftPickerVisible(true)} style={styles.giftButton}>
            <Text style={styles.giftGlyph}>✦</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Message"
            maxLength={2000}
            multiline
            onChangeText={setDraft}
            placeholder="Write a message…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!draft.trim() || sending}
            onPress={() => void send()}
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendPressed, (!draft.trim() || sending) && styles.sendDisabled]}
          >
            <Text style={styles.sendLabel}>↑</Text>
          </Pressable>
        </View>
        {sessionId && partnerId ? (
          <GiftPicker
            contextId={sessionId}
            contextKind="quick_chat"
            onClose={() => setGiftPickerVisible(false)}
            recipientId={partnerId}
            recipientName={partnerName}
            visible={giftPickerVisible}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  headerAction: { alignItems: 'center', height: 48, justifyContent: 'center', width: 40 },
  headerActionText: { color: colors.text, fontSize: 36, fontWeight: '300', lineHeight: 38 },
  headerIdentity: { flex: 1 },
  profileLink: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm },
  partnerName: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  textAction: { paddingHorizontal: 5, paddingVertical: spacing.sm },
  textActionLabel: { color: colors.warning, fontSize: 14, fontWeight: '800' },
  blockLabel: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  keepRow: { alignItems: 'center', backgroundColor: colors.signalSoft, borderBottomColor: '#3B5421', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  keepCopy: { color: colors.textMuted, fontSize: 12 },
  keepButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  keepButtonDone: { backgroundColor: colors.successSoft },
  keepButtonText: { color: colors.primaryInk, fontSize: 14, fontWeight: '800' },
  messages: { flexGrow: 1, gap: spacing.sm, justifyContent: 'flex-end', padding: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xl, textAlign: 'center' },
  bubble: { borderRadius: radius.md, maxWidth: '82%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  ownBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  ownMessageText: { color: colors.primaryInk },
  error: { color: colors.danger, fontSize: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textAlign: 'center' },
  composer: { alignItems: 'flex-end', backgroundColor: colors.surfaceSoft, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  giftButton: { alignItems: 'center', backgroundColor: colors.warningSoft, borderColor: '#6D5520', borderRadius: 27, borderWidth: 1, height: 54, justifyContent: 'center', width: 54 },
  giftGlyph: { color: colors.warning, fontSize: 20, fontWeight: '900' },
  input: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: 27, borderWidth: 1, color: colors.text, flex: 1, fontSize: 17, maxHeight: 132, minHeight: 54, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 27, height: 54, justifyContent: 'center', width: 54 },
  sendPressed: { backgroundColor: colors.primaryPressed },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { color: colors.primaryInk, fontSize: 24, fontWeight: '900' },
});
