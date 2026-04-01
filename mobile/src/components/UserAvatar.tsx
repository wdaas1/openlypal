import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';

interface UserAvatarProps {
  uri: string | null | undefined;
  name: string;
  size?: number;
}

export function UserAvatar({ uri, name, size = 40 }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#1a3a5c',
        }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1a3a5c',
      }}
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}
