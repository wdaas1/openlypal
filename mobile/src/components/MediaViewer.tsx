import React from 'react';
import { Modal, View, Pressable, StatusBar, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface MediaViewerProps {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  uri: string;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DISMISS_THRESHOLD = 120;

function VideoViewerInner({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      nativeControls
    />
  );
}

function ZoomableImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width, height } = Dimensions.get('window');

  const scale = useSharedValue<number>(1);
  const savedScale = useSharedValue<number>(1);

  const translateX = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(0);
  const savedTranslateX = useSharedValue<number>(0);
  const savedTranslateY = useSharedValue<number>(0);

  function clampTranslate(value: number, currentScale: number, dimension: number): number {
    'worklet';
    const maxOffset = (dimension * (currentScale - 1)) / 2;
    return Math.min(Math.max(value, -maxOffset), maxOffset);
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
      scale.value = newScale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) {
        // At 1x: only allow vertical swipe-down dismiss, no horizontal drift
        translateX.value = 0;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // Zoomed in: pan within image bounds
        const rawX = savedTranslateX.value + e.translationX;
        const rawY = savedTranslateY.value + e.translationY;
        translateX.value = clampTranslate(rawX, scale.value, width);
        translateY.value = clampTranslate(rawY, scale.value, height);
      }
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        if (translateY.value > DISMISS_THRESHOLD) {
          runOnJS(onClose)();
        } else {
          translateY.value = withSpring(0, SPRING_CONFIG);
          savedTranslateY.value = 0;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
      } else {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedScale.value = MIN_SCALE;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  // Double-tap races against the combined pinch+pan so a quick double-tap isn't
  // consumed by the pan recogniser before it fires.
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          { width, height, alignItems: 'center', justifyContent: 'center' },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
          testID="media-viewer-image"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function MediaViewer({ visible, onClose, type, uri }: MediaViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Media content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {type === 'image' ? (
            <ZoomableImage uri={uri} onClose={onClose} />
          ) : (
            <VideoViewerInner uri={uri} />
          )}
        </View>

        {/* Close button — always rendered on top via zIndex */}
        <Pressable
          testID="media-viewer-close"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}
