import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

const tabIcons: Record<string, string> = {
  'quick-chat': '⌁',
  feed: '◫',
  clubs: '◉',
  messages: '✦',
  profile: '●',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{tabIcons[name]}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isLoading, onboardingComplete, user } = useSession();

  if (!isLoading && !user) return <Redirect href="/auth" />;
  if (!isLoading && user && !onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      initialRouteName="quick-chat"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} name={route.name} />,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tabs.Screen name="quick-chat" options={{ title: 'Quick Chat' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingBottom: 10, paddingTop: 8 },
  label: { fontSize: 10, fontWeight: '700' },
  iconWrap: { alignItems: 'center', borderRadius: 14, height: 28, justifyContent: 'center', width: 42 },
  iconWrapFocused: { backgroundColor: '#18392D' },
  icon: { color: colors.textMuted, fontSize: 19, fontWeight: '900' },
  iconFocused: { color: colors.primary },
});
