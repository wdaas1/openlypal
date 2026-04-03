import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Pressable, Text, LayoutChangeEvent, StyleSheet } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Home, Compass, PlusCircle, MessageSquare, User, Radio } from 'lucide-react-native';
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
import { BlurView } from 'expo-blur';
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
    route: '/(app)/live-moments',
    icon: (color, size) => <Radio size={size} color={color} />,
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
              shadowOpacity: 0.9,
              shadowRadius: 18,
              elevation: 10,
            },
          ]}
        >
          {config.icon('#001935', 24, false)}
        </Animated.View>
      </Pressable>
    );
  }

  const iconColor = isActive ? '#00CF35' : 'rgba(255,255,255,0.38)';

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
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
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

  const barWidth = useSharedValue(0);
  const pillLeft = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  const getActiveIndex = () => {
    if (pathname === '/' || pathname === '/index' || pathname.endsWith('/(app)')) return 0;
    if (pathname.includes('/explore')) return 1;
    if (pathname.includes('/create')) return 2;
    if (pathname.includes('/live-moments')) return 3;
    if (pathname.includes('/profile')) return 4;
    return -1;
  };

  const activeIndex = getActiveIndex();
  const bottomOffset = Math.max(insets.bottom, 12);

  const PILL_WIDTH = 46;
  const BAR_HEIGHT = 68;

  React.useEffect(() => {
    const isCenter = activeIndex === 2;
    const isValid = activeIndex !== -1 && !isCenter;

    if (isValid && barWidth.value > 0) {
      const slotWidth = barWidth.value / 5;
      const targetLeft = activeIndex * slotWidth + (slotWidth - PILL_WIDTH) / 2;
      pillLeft.value = withSpring(targetLeft, { damping: 20, stiffness: 200 });
      pillOpacity.value = withSpring(1, { damping: 20, stiffness: 200 });
    } else {
      pillOpacity.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  }, [activeIndex, barWidth.value]);

  const pillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: (BAR_HEIGHT - PILL_WIDTH) / 2,
    left: pillLeft.value,
    width: PILL_WIDTH,
    height: PILL_WIDTH,
    borderRadius: PILL_WIDTH / 2,
    backgroundColor: 'rgba(0,207,53,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(0,207,53,0.28)',
    opacity: pillOpacity.value,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    barWidth.value = width;
    const isCenter = activeIndex === 2;
    const isValid = activeIndex !== -1 && !isCenter;
    if (isValid && width > 0) {
      const slotWidth = width / 5;
      pillLeft.value = activeIndex * slotWidth + (slotWidth - PILL_WIDTH) / 2;
      pillOpacity.value = 1;
    }
  };

  if (pathname.includes('/post/')) return null;
  // Hide tab bar inside a live moment room (but not the list or create screens)
  if (/\/live-moments\/(?!create)[^/]+/.test(pathname)) return null;

  return (
    <View
      pointerEvents="box-none"
      onLayout={handleLayout}
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 16,
        right: 16,
        height: BAR_HEIGHT,
        borderRadius: 34,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 24,
      }}
    >
      {/* Blur layer */}
      <BlurView
        intensity={90}
        tint="dark"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Glass tint overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,18,40,0.55)',
        }}
      />
      {/* Top specular highlight */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      />
      {/* Bottom edge highlight */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      />
      {/* Sliding pill indicator */}
      <Animated.View style={pillStyle} />
      {/* Tab buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: '100%' }}>
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
                '/(app)/live-moments': '/(app)/live-moments',
                '/(app)/profile': '/(app)/profile',
              };
              router.push(routeMap[tab.route] as any);
            }}
          />
        ))}
      </View>
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
  if (pathname.includes('/live-moments')) return null;
  if (pathname.includes('/post/')) return null;

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
    <KeyboardProvider>
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
        <Tabs.Screen name="live-moments/index" options={{ title: 'Live' }} />
        <Tabs.Screen name="live-moments/create" options={{ href: null }} />
        <Tabs.Screen name="live-moments/[id]" options={{ href: null }} />
        <Tabs.Screen name="messenger/index" options={{ href: null, title: 'Chat' }} />
        <Tabs.Screen name="messenger/[userId]" options={{ href: null }} />
        <Tabs.Screen name="post/[id]" options={{ href: null }} />
        <Tabs.Screen name="user/[id]" options={{ href: null }} />
        <Tabs.Screen name="user/followers" options={{ href: null }} />
        <Tabs.Screen name="interests" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="legal" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="admin" options={{ href: null }} />
      </Tabs>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <FloatingTabBar />
        <FloatingChatButton />
      </View>
    </View>
    </KeyboardProvider>
  );
}
