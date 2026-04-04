import React, { useEffect, useCallback } from 'react';
import { Modal, View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
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
    p.play();
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

  // Tap on black background closes
  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => runOnJS(onDismiss)());

  const composed = Gesture.Simultaneous(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    flex: 1,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={animatedStyle}>
        <VideoView
          player={player}
          style={{ width: SW, height: SH }}
          contentFit="contain"
          nativeControls
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── MediaViewer ──────────────────────────────────────────────────────────────

export function MediaViewer({ visible, onClose, type, uri }: MediaViewerProps) {
  const insets = useSafeAreaInsets();

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={triggerDismiss}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Fading black background — tap here also closes */}
        <Animated.View style={backgroundStyle}>
          <Pressable style={StyleSheet.absoluteFill} onPress={triggerDismiss} />
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
      </View>
    </Modal>
  );
}
