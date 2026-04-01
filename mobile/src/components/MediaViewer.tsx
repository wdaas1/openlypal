import React from 'react';
import { Modal, View, Pressable, StatusBar, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface MediaViewerProps {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  uri: string;
}

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

export function MediaViewer({ visible, onClose, type, uri }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');

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
        <View style={{ flex: 1 }}>
          {type === 'image' ? (
            <Image
              source={{ uri }}
              style={{ width, height }}
              contentFit="contain"
              testID="media-viewer-image"
            />
          ) : (
            <VideoViewerInner uri={uri} />
          )}
        </View>

        {/* Close button */}
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
          }}
        >
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}
