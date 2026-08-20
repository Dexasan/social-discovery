import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Muted } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import {
  blockProfile,
  loadConversationMessages,
  reportProfile,
  sendConversationMessage,
  subscribeToConversationMessages,
  type Message,
} from '@/features/quick-chat/api';
import { colors, radius, spacing } from '@/theme/tokens';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function DirectConversationScreen() {
  const params = useLocalSearchParams<{ conversationId: string; partnerId: string; partnerName: string }>();
  const conversationId = first(params.conversationId);
  const partnerId = first(params.partnerId);
  const partnerName = first(params.partnerName) ?? 'Connection';
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const addMessage = (message: Message) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
  };

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    void loadConversationMessages(conversationId)
      .then((data) => { if (active) setMessages(data); })
      .catch((nextError: unknown) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Could not load messages.'); });
    const unsubscribe = subscribeToConversationMessages(conversationId, addMessage);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!conversationId || !user || !body || sending) return;
    setSending(true);
    setDraft('');
    setError('');
    try {
      addMessage(await sendConversationMessage(conversationId, user.id, body));
    } catch (nextError) {
      setDraft(body);
      setError(nextError instanceof Error ? nextError.message : 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const confirmBlock = () => {
    if (!user || !partnerId) return;
    Alert.alert('Block this person?', 'They will disappear from your inbox and cannot contact you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => void blockProfile(user.id, partnerId)
          .then(() => router.replace('/(tabs)/messages'))
          .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : 'Could not block this account.')),
      },
    ]);
  };

  const confirmReport = () => {
    if (!user || !partnerId) return;
    Alert.alert('Report this account?', 'A moderation report will be created for review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => void reportProfile(user.id, partnerId, `Reported from direct conversation ${conversationId ?? 'unknown'}`)
          .then(() => router.replace('/(tabs)/messages'))
          .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : 'Could not submit this report.')),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to messages" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Avatar label={partnerName} size={42} />
        <View style={styles.identity}>
          <Text style={styles.name}>{partnerName}</Text>
          <Muted>Direct message</Muted>
        </View>
        <Pressable onPress={confirmReport} style={styles.action}><Text style={styles.report}>Report</Text></Pressable>
        <Pressable onPress={confirmBlock} style={styles.action}><Text style={styles.block}>Block</Text></Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.messages}
        data={messages}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>This is the beginning of your conversation.</Text>}
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
        <Pressable disabled={!draft.trim() || sending} onPress={() => void send()} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}>
          <Text style={styles.sendLabel}>↑</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 30 },
  backText: { color: colors.text, fontSize: 36, fontWeight: '300' },
  identity: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  action: { paddingHorizontal: 5, paddingVertical: spacing.sm },
  report: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  block: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  messages: { flexGrow: 1, gap: spacing.sm, justifyContent: 'flex-end', padding: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xl, textAlign: 'center' },
  bubble: { borderRadius: radius.md, maxWidth: '82%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  ownBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  ownMessageText: { color: colors.primaryInk },
  error: { color: colors.danger, fontSize: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textAlign: 'center' },
  composer: { alignItems: 'flex-end', backgroundColor: colors.surfaceSoft, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  input: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: 23, borderWidth: 1, color: colors.text, flex: 1, fontSize: 15, maxHeight: 120, minHeight: 46, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 23, height: 46, justifyContent: 'center', width: 46 },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { color: colors.primaryInk, fontSize: 24, fontWeight: '900' },
});
