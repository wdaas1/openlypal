import React, { useEffect, useCallback } from 'react';
import { Modal, View, Pressable, Dimensions, StyleSheet, Platform, Text, Pressable as RNPressable, ScrollView } from 'react-native';
import { Image, Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, ExternalLink, Hash } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');

const SPRING = { damping: 22, stiffness: 220, mass: 0.5 };
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DISMISS_THRESHOLD = 90;
const DISMISS_VELOCITY = 600;

interface MediaViewerProps {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  uri: string;
  post?: {
    id: string;
    title: string | null;
    content: string | null;
    tags: string[];
    category: string | null;
    user: { name: string; username: string | null; image: string | null };
    likeCount: number;
    commentCount: number;
    createdAt: string;
  };
}

// ─── Zoomable image ───────────────────────────────────────────────────────────

interface ZoomableImageProps {
  uri: string;
  dragY: Animated.SharedValue<number>;
  bgOpacity: Animated.SharedValue<number>;
  onDismiss: () => void;
}

function ZoomableImage({ uri, dragY, bgOpacity, onDismiss }: ZoomableImageProps) {
  const scale = useSharedValue<number>(1);
  const savedScale = useSharedValue<number>(1);
  const tx = useSharedValue<number>(0);
  const ty = useSharedValue<number>(0);
  const savedTx = useSharedValue<number>(0);
  const savedTy = useSharedValue<number>(0);

  function clamp(v: number, s: number, dim: number): number {
    'worklet';
    const max = (dim * (s - 1)) / 2;
    return Math.min(Math.max(v, -max), max);
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING);
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
        dragY.value = withSpring(0, SPRING);
        savedTx.value = 0;
        savedTy.value = 0;
      }
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) {
        // Only allow downward swipe for dismiss
        const dy = Math.max(0, e.translationY);
        dragY.value = dy;
        bgOpacity.value = interpolate(dy, [0, 220], [1, 0.25]);
      } else {
        tx.value = clamp(savedTx.value + e.translationX, scale.value, SW);
        ty.value = clamp(savedTy.value + e.translationY, scale.value, SH);
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1) {
        if (dragY.value > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
          runOnJS(onDismiss)();
        } else {
          dragY.value = withSpring(0, SPRING);
          bgOpacity.value = withTiming(1, { duration: 200 });
        }
        tx.value = withSpring(0, SPRING);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(MIN_SCALE, SPRING);
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
      savedScale.value = MIN_SCALE;
      savedTx.value = 0;
      savedTy.value = 0;
    });

  // Single tap on black background (letterbox areas) dismisses.
  // Exclusive ensures double-tap wins if recognised first.
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1) runOnJS(onDismiss)();
    });

  const composed = Gesture.Race(
    Gesture.Exclusive(doubleTap, singleTap),
    Gesture.Simultaneous(pinch, pan),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: scale.value <= 1 ? 0 : tx.value },
      // At 1x: use shared dragY so MediaViewer exit animation moves the image
      { translateY: scale.value <= 1 ? dragY.value : ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { width: SW, height: SH, alignItems: 'center', justifyContent: 'center' },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: SW, height: SH }}
          contentFit="contain"
          testID="media-viewer-image"
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Video viewer ─────────────────────────────────────────────────────────────

interface VideoViewerProps {
  uri: string;
  dragY: Animated.SharedValue<number>;
  bgOpacity: Animated.SharedValue<number>;
  onDismiss: () => void;
}

function VideoViewerInner({ uri, dragY, bgOpacity, onDismiss }: VideoViewerProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    if (Platform.OS !== 'web') p.play();
  });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        dragY.value = e.translationY;
        bgOpacity.value = interpolate(e.translationY, [0, 220], [1, 0.25]);
      }
    })
    .onEnd((e) => {
      if (dragY.value > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onDismiss)();
      } else {
        dragY.value = withSpring(0, SPRING);
        bgOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    flex: 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[animatedStyle, { flex: 1 }]}>
        <VideoView
          player={player}
          style={{ width: SW, height: SH }}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── MediaViewer ──────────────────────────────────────────────────────────────

export function MediaViewer({ visible, onClose, type, uri, post }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Shared values owned here so exit animation can drive them from outside the media components
  const bgOpacity = useSharedValue<number>(0);
  const dragY = useSharedValue<number>(0);
  const uiOpacity = useSharedValue<number>(0); // close button + any chrome

  // ─ Entry animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      bgOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.ease) });
      uiOpacity.value = withTiming(1, { duration: 300 });
    } else {
      // Snap-reset so the next open starts clean
      bgOpacity.value = 0;
      uiOpacity.value = 0;
      dragY.value = 0;
    }
  }, [visible]);

  // ─ Exit animation ──────────────────────────────────────────────────────────
  const triggerDismiss = useCallback(() => {
    uiOpacity.value = withTiming(0, { duration: 150 });
    bgOpacity.value = withTiming(0, { duration: 260 });
    dragY.value = withTiming(
      SH * 1.15,
      { duration: 300, easing: Easing.in(Easing.ease) },
      () => runOnJS(onClose)(),
    );
  }, [onClose]);

  // ─ Animated styles ─────────────────────────────────────────────────────────
  const backgroundStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    opacity: bgOpacity.value,
  }));

  const closeButtonStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    position: 'absolute',
    top: insets.top + 12,
    right: 16,
    zIndex: 20,
  }));

  const videoInfoStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    transform: [{ translateY: interpolate(uiOpacity.value, [0, 1], [30, 0]) }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={triggerDismiss}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Fading black background */}
        <Animated.View style={backgroundStyle}>
          {type === 'image' && (
            <Pressable style={StyleSheet.absoluteFill} onPress={triggerDismiss} />
          )}
        </Animated.View>

        {/* Media */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {type === 'image' ? (
            <ZoomableImage
              uri={uri}
              dragY={dragY}
              bgOpacity={bgOpacity}
              onDismiss={triggerDismiss}
            />
          ) : (
            <VideoViewerInner
              uri={uri}
              dragY={dragY}
              bgOpacity={bgOpacity}
              onDismiss={triggerDismiss}
            />
          )}
        </View>

        {/* Close button */}
        <Animated.View style={closeButtonStyle}>
          <Pressable
            testID="media-viewer-close"
            onPress={triggerDismiss}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        {/* Video info panel — only for videos */}
        {type === 'video' && post ? (
          <Animated.View
            style={[
              videoInfoStyle,
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom: insets.bottom + 16,
                paddingHorizontal: 16,
                paddingTop: 20,
              },
            ]}
            pointerEvents="box-none"
          >
            {/* Dark overlay behind text */}
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.0)',
              }}
              pointerEvents="none"
            />

            {/* Author row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {post.user.image ? (
                <ExpoImage
                  source={{ uri: post.user.image }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{post.user.name?.[0] ?? '?'}</Text>
                </View>
              )}
              <View>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>{post.user.name}</Text>
                {post.user.username ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>@{post.user.username}</Text>
                ) : null}
              </View>
            </View>

            {/* Title */}
            {post.title ? (
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 4, lineHeight: 22 }} numberOfLines={2}>
                {post.title}
              </Text>
            ) : null}

            {/* Content / caption */}
            {post.content ? (
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginBottom: 8 }} numberOfLines={3}>
                {post.content}
              </Text>
            ) : null}

            {/* Tags */}
            {post.tags && post.tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {post.tags.slice(0, 4).map((tag: string) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: 'rgba(0,207,53,0.15)',
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderWidth: 0.5,
                      borderColor: 'rgba(0,207,53,0.4)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Hash size={10} color="#00CF35" />
                    <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '600' }}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Similar posts link */}
            <Pressable
              onPress={() => {
                triggerDismiss();
                const tag = post.tags?.[0] ?? post.category;
                if (tag) {
                  setTimeout(() => {
                    try {
                      router.push({ pathname: '/(app)/search' as any, params: { q: tag } });
                    } catch (_) {}
                  }, 350);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <ExternalLink size={13} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Similar posts</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
