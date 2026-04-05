import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Pressable, Text, LayoutChangeEvent, StyleSheet, Modal } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Home, Compass, PlusCircle, MessageSquare, User, Radio, Layers, Camera, Video, Users } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { api } from '@/lib/api/api';
import { useE2EInit } from '@/lib/use-e2e-init';
import { fireHomeTabPress } from '@/lib/home-tab-press';
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
    route: '/(app)/rooms',
    icon: (color, size) => <Layers size={size} color={color} />,
  },
  {
    route: '/(app)/profile',
    icon: (color, size) => <User size={size} color={color} />,
  },
];

// ─── CreateModal ─────────────────────────────────────────────────────────────

type CreateModalProps = {
  visible: boolean;
  onClose: () => void;
  translateY: Animated.SharedValue<number>;
  backdropOpacity: Animated.SharedValue<number>;
};

function CreateModal({ visible, onClose, translateY, backdropOpacity }: CreateModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as any);
    }, 260);
  };

  const actions = [
    {
      testID: 'create-modal-post',
      icon: <Camera size={22} color="#00CF35" />,
      label: 'Post',
      sub: 'Share a photo or video',
      onPress: () => navigate('/(app)/create'),
    },
    {
      testID: 'create-modal-live',
      icon: <Video size={22} color="#00CF35" />,
      label: 'Go Live',
      sub: 'Start a live session',
      onPress: () => navigate('/(app)/live-moments/create'),
    },
    {
      testID: 'create-modal-room',
      icon: <Users size={22} color="#00CF35" />,
      label: 'Create Room',
      sub: 'Start a group space',
      onPress: () => navigate('/(app)/rooms'),
    },
    {
      testID: 'create-modal-message',
      icon: <MessageSquare size={22} color="#00CF35" />,
      label: 'Message',
      sub: 'Send a direct message',
      onPress: () => navigate('/(app)/messenger'),
    },
  ];

  return (
    <Modal
      testID="create-modal"
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          backdropStyle,
          { backgroundColor: '#000' },
        ]}
      />

      {/* Full-screen pressable to close on tap outside */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyle,
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#001228',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 24,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.25)',
            }}
          />
        </View>

        {/* Title */}
        <Text
          style={{
            color: '#ffffff',
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            opacity: 0.45,
            textAlign: 'center',
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          Create something
        </Text>

        {/* Actions */}
        <View style={{ paddingHorizontal: 16, gap: 4 }}>
          {actions.map((action) => (
            <Pressable
              key={action.testID}
              testID={action.testID}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 18,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: pressed
                  ? 'rgba(0,207,53,0.08)'
                  : 'rgba(255,255,255,0.04)',
                gap: 16,
              })}
            >
              {/* Icon container */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(0,207,53,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0,207,53,0.2)',
                }}
              >
                {action.icon}
              </View>

              {/* Labels */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 17,
                    fontWeight: '600',
                    letterSpacing: -0.2,
                  }}
                >
                  {action.label}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    marginTop: 1,
                  }}
                >
                  {action.sub}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Cancel */}
        <Pressable
          testID="create-modal-cancel"
          onPress={onClose}
          style={({ pressed }) => ({
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            marginHorizontal: 16,
            borderRadius: 14,
            backgroundColor: pressed
              ? 'rgba(255,255,255,0.06)'
              : 'transparent',
          })}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16,
              fontWeight: '500',
            }}
          >
            Cancel
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── TabButton ────────────────────────────────────────────────────────────────

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
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: '#00CF35',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 6,
            },
          ]}
        >
          {config.icon('#001935', 20, false)}
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
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            ...(isActive ? {
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
            } : {}),
          },
        ]}
      >
        {config.icon(iconColor, 20, isActive)}
      </Animated.View>
    </Pressable>
  );
}

// ─── FloatingTabBar ───────────────────────────────────────────────────────────

type FloatingTabBarProps = {
  onOpenModal: () => void;
};

function FloatingTabBar({ onOpenModal }: FloatingTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const insets = useSafeAreaInsets();

  const barWidth = useSharedValue(0);
  const barWidthRef = React.useRef(0);
  const pillLeft = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  const getActiveIndex = () => {
    if (pathname === '/' || pathname === '/index' || pathname.endsWith('/(app)')) return 0;
    if (pathname.includes('/explore')) return 1;
    if (pathname.includes('/create')) return 2;
    if (pathname.includes('/live-moments')) return 3;
    if (pathname.includes('/rooms')) return 4;
    if (pathname.includes('/profile')) return 5;
    return -1;
  };

  const activeIndex = getActiveIndex();
  const bottomOffset = Math.max(insets.bottom, 12);

  const PILL_WIDTH = 46;
  const BAR_HEIGHT = 68;

  React.useEffect(() => {
    const isCenter = activeIndex === 2;
    const isValid = activeIndex !== -1 && !isCenter;

    if (isValid && barWidthRef.current > 0) {
      const slotWidth = barWidthRef.current / 6;
      const targetLeft = activeIndex * slotWidth + (slotWidth - PILL_WIDTH) / 2;
      pillLeft.value = withSpring(targetLeft, { damping: 20, stiffness: 200 });
      pillOpacity.value = withSpring(1, { damping: 20, stiffness: 200 });
    } else {
      pillOpacity.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  }, [activeIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: (BAR_HEIGHT - PILL_WIDTH) / 2,
    left: pillLeft.value,
    width: PILL_WIDTH,
    height: PILL_WIDTH,
    borderRadius: PILL_WIDTH / 2,
    backgroundColor: 'rgba(0,207,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,207,53,0.18)',
    opacity: pillOpacity.value,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    barWidth.value = width;
    barWidthRef.current = width;
    const isCenter = activeIndex === 2;
    const isValid = activeIndex !== -1 && !isCenter;
    if (isValid && width > 0) {
      const slotWidth = width / 6;
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
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      {/* Blur layer */}
      <BlurView
        intensity={70}
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
          backgroundColor: 'rgba(0,12,28,0.72)',
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
              if (tab.isCenter) {
                onOpenModal();
                return;
              }
              const isHome = tab.route === '/(app)/index';
              const alreadyOnHome = activeIndex === index;
              if (isHome && alreadyOnHome) {
                fireHomeTabPress();
                return;
              }
              const routeMap: Record<string, string> = {
                '/(app)/index': '/',
                '/(app)/explore': '/(app)/explore',
                '/(app)/live-moments': '/(app)/live-moments',
                '/(app)/rooms': '/(app)/rooms',
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

// ─── E2EInitializer ───────────────────────────────────────────────────────────

function E2EInitializer() {
  useE2EInit();
  return null;
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [modalVisible, setModalVisible] = React.useState(false);

  // Animation shared values
  const sheetTranslateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);
  const contentScale = useSharedValue(1);

  const openModal = () => {
    setModalVisible(true);
    sheetTranslateY.value = 600;
    backdropOpacity.value = 0;
    contentScale.value = 1;

    sheetTranslateY.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(0.5, { duration: 250 });
    contentScale.value = withTiming(0.96, { duration: 250 });
  };

  const closeModal = () => {
    sheetTranslateY.value = withTiming(600, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    backdropOpacity.value = withTiming(0, { duration: 220 });
    contentScale.value = withTiming(1, {
      duration: 220,
    }, () => {
      runOnJS(setModalVisible)(false);
    });
  };

  const contentAnimStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ scale: contentScale.value }],
    borderRadius: contentScale.value < 1 ? 16 : 0,
    overflow: 'hidden',
  }));

  return (
    <KeyboardProvider>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <E2EInitializer />
        <Animated.View style={contentAnimStyle}>
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
            <Tabs.Screen name="rooms/index" options={{ href: null, title: 'Rooms' }} />
            <Tabs.Screen name="rooms/[id]" options={{ href: null }} />
            <Tabs.Screen name="rooms/add-members" options={{ href: null }} />
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
            <Tabs.Screen name="relationships/index" options={{ href: null }} />
            <Tabs.Screen name="profile-modules/index" options={{ href: null }} />
          </Tabs>
        </Animated.View>

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <FloatingTabBar onOpenModal={openModal} />
        </View>

        <CreateModal
          visible={modalVisible}
          onClose={closeModal}
          translateY={sheetTranslateY}
          backdropOpacity={backdropOpacity}
        />
      </View>
    </KeyboardProvider>
  );
}
