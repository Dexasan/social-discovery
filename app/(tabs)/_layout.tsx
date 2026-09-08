import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabArtwork } from '@/components/TabArtwork';
import { colors, fonts } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isLoading, onboardingComplete, user } = useSession();
  if (!isLoading && !user) return <Redirect href="/auth" />;
  if (!isLoading && user && !onboardingComplete) return <Redirect href="/onboarding" />;
  return <Tabs initialRouteName="quick-chat" screenOptions={({ route }) => ({
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarIcon: ({ focused }) => <TabArtwork focused={focused} name={route.name} />,
    tabBarIconStyle: styles.icon,
    tabBarItemStyle: styles.tabItem,
    tabBarLabelStyle: styles.label,
    tabBarStyle: [styles.tabBar, { height: 82 + Math.max(insets.bottom, 8), paddingBottom: Math.max(insets.bottom, 8) }],
  })}>
    <Tabs.Screen name="quick-chat" options={{ title: 'Yap' }} />
    <Tabs.Screen name="feed" options={{ title: 'Discover' }} />
    <Tabs.Screen name="clubs" options={{ title: 'Clubs' }} />
    <Tabs.Screen name="messages" options={{ title: 'Inbox' }} />
    <Tabs.Screen name="profile" options={{ title: 'Me' }} />
  </Tabs>;
}
const styles = StyleSheet.create({
  tabBar: { backgroundColor: colors.background, borderTopColor: colors.borderStrong, borderTopWidth: 1, bottom: 0, paddingHorizontal: 8, paddingTop: 8, position: 'absolute', elevation: 0 },
  tabItem: { paddingTop: 0 },
  icon: { width: 60, height: 50 },
  label: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, marginTop: 1, textTransform: 'uppercase' },
});
