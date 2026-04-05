import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaViewer } from '@/components/MediaViewer';

export default function RoomMediaScreen() {
  const { mediaId, id } = useLocalSearchParams<{ mediaId: string; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };

  // Determine media type from URI extension
  const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaId ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Back button overlay */}
      <Pressable
        testID="back-button"
        onPress={handleBack}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 30,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={20} color="#FFFFFF" />
      </Pressable>

      <MediaViewer
        visible={visible}
        type={isVideo ? 'video' : 'image'}
        uri={mediaId ?? ''}
        onClose={handleBack}
      />
    </View>
  );
}
