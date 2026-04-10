import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Repeat2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { PostCard } from './PostCard';
import type { ReblogFeedItem } from '@/lib/types';

interface ReblogCardProps {
  item: ReblogFeedItem;
  isVisible?: boolean;
}

const ReblogCard = React.memo(function ReblogCard({ item, isVisible }: ReblogCardProps) {
  const router = useRouter();
  const username = item.rebloggedBy.username ?? item.rebloggedBy.name;

  return (
    <View>
      <Pressable
        onPress={() => router.push(`/user/${item.rebloggedBy.id}` as any)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Repeat2 size={13} color="#00CF35" />
        <Text style={{ marginLeft: 6, fontSize: 12, color: '#4a6fa5', fontWeight: '600' }}>
          @{username} reposted
        </Text>
      </Pressable>
      <PostCard post={item.post} isVisible={isVisible} />
    </View>
  );
});

export { ReblogCard };
