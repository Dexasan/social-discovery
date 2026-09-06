import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? colors.primary : colors.textSubtle;
  const shape = name === 'quick-chat' ? (
    <View style={styles.chatIcon}>
      <View style={[styles.chatBubble, { borderColor: color }]} />
      <View style={[styles.chatBubbleSmall, { borderColor: color }]} />
    </View>
  ) : name === 'feed' ? (
    <View style={styles.feedIcon}>
      <View style={[styles.feedLine, styles.feedLineLong, { backgroundColor: color }]} />
      <View style={[styles.feedLine, { backgroundColor: color }]} />
      <View style={[styles.feedLine, styles.feedLineShort, { backgroundColor: color }]} />
    </View>
  ) : name === 'clubs' ? (
    <View style={styles.clubIcon}>
      <View style={[styles.clubPerson, { backgroundColor: color }]} />
      <View style={[styles.clubPersonLeft, { backgroundColor: color }]} />
      <View style={[styles.clubPersonRight, { backgroundColor: color }]} />
      <View style={[styles.clubBase, { borderColor: color }]} />
    </View>
  ) : name === 'messages' ? (
    <View style={[styles.messageIcon, { borderColor: color }]}>
      <View style={[styles.messageLine, { backgroundColor: color }]} />
      <View style={[styles.messageLine, styles.messageLineShort, { backgroundColor: color }]} />
    </View>
  ) : (
    <View style={styles.profileIcon}>
      <View style={[styles.profileHead, { backgroundColor: color }]} />
      <View style={[styles.profileBody, { borderColor: color }]} />
    </View>
  );

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
      {shape}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isLoading, onboardingComplete, user } = useSession();

  if (!isLoading && !user) return <Redirect href="/auth" />;
  if (!isLoading && user && !onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      initialRouteName="quick-chat"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} name={route.name} />,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, { bottom: Math.max(insets.bottom, 12) }],
      })}
    >
      <Tabs.Screen name="quick-chat" options={{ title: 'Yap' }} />
      <Tabs.Screen name="feed" options={{ title: 'Discover' }} />
      <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
      <Tabs.Screen name="messages" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="profile" options={{ title: 'Me' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { ...shadows.floating, backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: 26, borderTopColor: colors.border, borderTopWidth: 1, borderWidth: 1, bottom: 0, height: 76, marginHorizontal: 14, paddingBottom: 10, paddingHorizontal: 6, paddingTop: 8, position: 'absolute' },
  tabItem: { borderRadius: 18 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  iconWrap: { alignItems: 'center', borderRadius: 14, height: 32, justifyContent: 'center', width: 48 },
  iconWrapFocused: { backgroundColor: colors.accent },
  chatIcon: { height: 20, position: 'relative', width: 22 },
  chatBubble: { borderRadius: 7, borderWidth: 1.8, height: 13, left: 0, position: 'absolute', top: 1, width: 16 },
  chatBubbleSmall: { borderRadius: 6, borderWidth: 1.8, bottom: 0, height: 11, position: 'absolute', right: 0, width: 14 },
  feedIcon: { gap: 3.5, width: 21 },
  feedLine: { borderRadius: 2, height: 2, width: 16 },
  feedLineLong: { width: 21 },
  feedLineShort: { width: 12 },
  clubIcon: { height: 21, position: 'relative', width: 24 },
  clubPerson: { borderRadius: 4, height: 8, left: 8, position: 'absolute', top: 0, width: 8 },
  clubPersonLeft: { borderRadius: 3, height: 6, left: 1, position: 'absolute', top: 4, width: 6 },
  clubPersonRight: { borderRadius: 3, height: 6, position: 'absolute', right: 1, top: 4, width: 6 },
  clubBase: { borderRadius: 10, borderTopWidth: 2, bottom: 0, height: 9, left: 1, position: 'absolute', width: 22 },
  messageIcon: { borderRadius: 7, borderWidth: 1.8, gap: 3, height: 17, justifyContent: 'center', paddingHorizontal: 4, width: 21 },
  messageLine: { borderRadius: 1, height: 1.5, width: 11 },
  messageLineShort: { width: 7 },
  profileIcon: { alignItems: 'center', height: 21, width: 21 },
  profileHead: { borderRadius: 5, height: 9, width: 9 },
  profileBody: { borderRadius: 9, borderWidth: 1.8, bottom: 0, height: 10, position: 'absolute', width: 18 },
});
