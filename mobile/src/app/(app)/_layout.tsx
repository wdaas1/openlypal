import React, { useRef } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { Home, Compass, PlusCircle, MessageSquare, User } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import type { Conversation } from '@/lib/types';

type TabConfig = {
  route: string;
  icon: (color: string, size: number, isActive: boolean) => React.ReactNode;
  isCenter?: boolean;
};

function ChatIcon({ color, size, isActive }: { color: string; size: number; isActive: boolean }) {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/conversations'),
    refetchInterval: 10000,
  });
  const totalUnread = (conversations ?? []).reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <View style={{ position: 'relative' }}>
      <MessageSquare
        size={size}
        color={color}
        fill={isActive ? color : 'transparent'}
      />
      {totalUnread > 0 ? (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -6,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#FF4E6A',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 1.5,
          borderColor: '#001935',
        }}>
          <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '800' }}>
            {totalUnread > 9 ? '9+' : String(totalUnread)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const TABS: TabConfig[] = [
  {
    route: '/(app)/index',
    icon: (color, size) => <Home size={size} color={color} />,
  },
  {
    route: '/(app)/explore',
    icon: (color, size) => <Compass size={size} color={color} />,
  },
  {
    route: '/(app)/create',
    icon: (color, size) => <PlusCircle size={size} color={color} />,
    isCenter: true,
  },
  {
    route: '/(app)/messenger',
    icon: (color, size, isActive) => <ChatIcon color={color} size={size} isActive={isActive} />,
  },
  {
    route: '/(app)/profile',
    icon: (color, size) => <User size={size} color={color} />,
  },
];

function TabButton({
  config,
  isActive,
  onPress,
}: {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: '#00CF35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isActive ? 0.6 : 0,
    shadowRadius: isActive ? 8 : 0,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(1.15, { damping: 6, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    onPress();
  };

  if (config.isCenter) {
    return (
      <Pressable
        testID="tab-create"
        onPress={handlePress}
        style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}
      >
        <Animated.View
          style={[
            animStyle,
            {
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#00CF35',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 12,
              elevation: 8,
            },
          ]}
        >
          {config.icon('#001935', 24, false)}
        </Animated.View>
      </Pressable>
    );
  }

  const iconColor = isActive ? '#00CF35' : '#4a6fa5';

  return (
    <Pressable
      testID={`tab-${config.route.split('/').pop()}`}
      onPress={handlePress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          animStyle,
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isActive ? 'rgba(0,207,53,0.15)' : 'transparent',
          },
        ]}
      >
        {config.icon(iconColor, 22, isActive)}
      </Animated.View>
    </Pressable>
  );
}

function FloatingTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const getActiveIndex = () => {
    if (pathname === '/' || pathname === '/index' || pathname.endsWith('/(app)')) return 0;
    if (pathname.includes('/explore')) return 1;
    if (pathname.includes('/create')) return 2;
    if (pathname.includes('/messenger')) return 3;
    if (pathname.includes('/profile')) return 4;
    return -1;
  };

  const activeIndex = getActiveIndex();
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 16,
        right: 16,
        height: 64,
        borderRadius: 28,
        backgroundColor: 'rgba(13, 13, 13, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 20,
      }}
    >
      {TABS.map((tab, index) => (
        <TabButton
          key={tab.route}
          config={tab}
          isActive={activeIndex === index}
          onPress={() => {
            const routeMap: Record<string, string> = {
              '/(app)/index': '/',
              '/(app)/explore': '/(app)/explore',
              '/(app)/create': '/(app)/create',
              '/(app)/messenger': '/(app)/messenger',
              '/(app)/profile': '/(app)/profile',
            };
            router.push(routeMap[tab.route] as any);
          }}
        />
      ))}
    </View>
  );
}

function FloatingChatButton() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900 }),
        withTiming(1, { duration: 900 })
      ),
      -1,
      false
    );
  }, [pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (pathname.includes('/messenger')) return null;

  const bottomOffset = Math.max(insets.bottom, 12) + 64 + 16;

  return (
    <Animated.View
      style={[
        pulseStyle,
        {
          position: 'absolute',
          bottom: bottomOffset,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          shadowColor: '#00CF35',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 16,
          elevation: 12,
        },
      ]}
    >
      <Pressable
        testID="floating-chat-button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(app)/messenger' as any);
        }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#00CF35',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MessageSquare size={22} color="#001935" />
      </Pressable>
    </Animated.View>
  );
}

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
        <Tabs.Screen name="create" options={{ title: 'Create' }} />
        <Tabs.Screen name="activity" options={{ href: null, title: 'Activity' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="messenger" options={{ title: 'Chat' }} />
        <Tabs.Screen name="messenger/[userId]" options={{ href: null }} />
        <Tabs.Screen name="post/[id]" options={{ href: null }} />
        <Tabs.Screen name="user/[id]" options={{ href: null }} />
        <Tabs.Screen name="interests" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="legal" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
      </Tabs>
      <FloatingTabBar />
      <FloatingChatButton />
    </View>
  );
}
