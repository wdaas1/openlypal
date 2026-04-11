import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Radio, Eye, Clock, Plus, Zap, Archive, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { useSession } from '@/lib/auth/use-session';
import type { LiveMoment } from '@/lib/types';

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function LivePulse() {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      false
    );
  }, [scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View
        style={[
          dotStyle,
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FF3B30',
            shadowColor: '#FF3B30',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 5,
            elevation: 6,
          },
        ]}
      />
      <Text
        style={{
          color: '#FF3B30',
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 2,
        }}
      >
        LIVE
      </Text>
    </View>
  );
}

function MomentCard({ moment, isOwn }: { moment: LiveMoment; isOwn: boolean }) {
  const router = useRouter();
  const glowOpacity = useSharedValue(0.4);

  React.useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 })
      ),
      -1,
      false
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(app)/live-moments/${moment.id}` as any);
  };

  const timeRemaining = getTimeRemaining(moment.expiresAt);
  const isEnded = timeRemaining === 'Ended' || moment.status === 'ended';

  return (
    <Pressable
      testID={`moment-card-${moment.id}`}
      onPress={handlePress}
      style={{ marginHorizontal: 16, marginBottom: 12 }}
    >
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isEnded
            ? 'rgba(255,255,255,0.06)'
            : isOwn
            ? 'rgba(0,207,53,0.35)'
            : 'rgba(255,59,48,0.35)',
        }}
      >
        <BlurView intensity={15} tint="dark" style={{ padding: 18 }}>
          {/* Glow overlay */}
          {!isEnded && (
            <Animated.View
              style={[
                glowStyle,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isOwn
                    ? 'rgba(0,207,53,0.04)'
                    : 'rgba(255,59,48,0.04)',
                },
              ]}
            />
          )}

          {/* Header row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            {isEnded ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                }}
              >
                <Clock size={11} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>
                  ENDED
                </Text>
              </View>
            ) : !moment.isLive ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                  }}
                />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>
                  OFFLINE
                </Text>
              </View>
            ) : (
              <LivePulse />
            )}

            {isOwn ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(0,207,53,0.15)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(0,207,53,0.25)',
                  }}
                >
                  <Text
                    style={{
                      color: '#00CF35',
                      fontSize: 10,
                      fontWeight: '800',
                      letterSpacing: 1.5,
                    }}
                  >
                    YOUR MOMENT
                  </Text>
                </View>
                {!isEnded && !moment.isLive ? (
                  <View
                    style={{
                      backgroundColor: '#00CF35',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      shadowColor: '#00CF35',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.2,
                      shadowRadius: 5,
                      elevation: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: '#001935',
                        fontSize: 10,
                        fontWeight: '900',
                        letterSpacing: 1.5,
                      }}
                    >
                      GO LIVE
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Title */}
          <Text
            style={{
              color: isEnded ? 'rgba(255,255,255,0.4)' : '#ffffff',
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: 0.3,
              marginBottom: 6,
            }}
          >
            {moment.title}
          </Text>

          {/* Creator */}
          {!isOwn && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              by {moment.creator?.name ?? 'Unknown'}
            </Text>
          )}

          {/* Footer row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Eye size={14} color="rgba(255,255,255,0.45)" />
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' }}>
                {moment.viewerCount ?? 0}
              </Text>
            </View>

            <Text
              style={{
                color: isEnded
                  ? 'rgba(255,255,255,0.25)'
                  : isOwn
                  ? '#00CF35'
                  : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {isEnded ? 'Ended' : timeRemaining}
            </Text>
          </View>
        </BlurView>
      </View>
    </Pressable>
  );
}

function ArchiveCard({ moment }: { moment: LiveMoment }) {
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(app)/live-moments/recap/${moment.id}` as any);
  };

  return (
    <Pressable
      testID={`archive-card-${moment.id}`}
      onPress={handlePress}
      style={{ marginHorizontal: 16, marginBottom: 10 }}
    >
      <View
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
        }}
      >
        <BlurView intensity={10} tint="dark" style={{ padding: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 15,
                  fontWeight: '700',
                  letterSpacing: 0.2,
                  marginBottom: 4,
                }}
                numberOfLines={1}
              >
                {moment.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 6 }}>
                by {moment.creator?.name ?? 'Unknown'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} color="rgba(255,255,255,0.25)" />
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    {new Date(moment.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MessageCircle size={11} color="rgba(255,255,255,0.25)" />
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    {moment.messageCount ?? 0} msgs
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.3,
                }}
              >
                View Recap
              </Text>
            </View>
          </View>
        </BlurView>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const router = useRouter();
  const zapScale = useSharedValue(1);

  React.useEffect(() => {
    zapScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
  }, [zapScale]);

  const zapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zapScale.value }],
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Animated.View style={[zapStyle, { marginBottom: 20 }]}>
        <Zap
          size={64}
          color="#00CF35"
          style={{
            shadowColor: '#00CF35',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 5,
          }}
        />
      </Animated.View>
      <Text
        style={{
          color: '#ffffff',
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: 0.5,
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        No Live Moments
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 15,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 32,
        }}
      >
        Share a live moment with friends. It disappears when the time's up.
      </Text>
      <Pressable
        testID="empty-create-moment-button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(app)/live-moments/create' as any);
        }}
        style={{
          backgroundColor: '#00CF35',
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 30,
          shadowColor: '#00CF35',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 10,
        }}
      >
        <Text style={{ color: '#001935', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>
          Go Live Now
        </Text>
      </Pressable>
    </View>
  );
}

export default function LiveMomentsScreen() {
  const router = useRouter();
  const { data: session } = useSession();

  const {
    data: moments,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['live-moments'],
    queryFn: () => liveMomentsApi.getAll(),
    refetchInterval: 5000,
  });

  const { data: archivedMoments } = useQuery({
    queryKey: ['live-moments-archive'],
    queryFn: () => liveMomentsApi.getArchive(),
    refetchInterval: 30000,
  });

  const myMoments = (moments ?? []).filter(
    (m) => m.creatorId === session?.user?.id
  );
  const invitedMoments = (moments ?? []).filter(
    (m) => m.creatorId !== session?.user?.id
  );

  const handleCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push('/(app)/live-moments/create' as any);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000d1a' }}>
      <LinearGradient
        colors={['#000d1a', '#001025', '#000d1a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Radio size={22} color="#00CF35" />
            <Text
              style={{
                color: '#ffffff',
                fontSize: 26,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}
            >
              Live Moments
            </Text>
          </View>

          <Pressable
            testID="create-moment-button"
            onPress={handleCreate}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#00CF35',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 8,
            }}
          >
            <Plus size={20} color="#001935" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
          </View>
        ) : (moments ?? []).length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollView
            testID="live-moments-list"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor="#00CF35"
              />
            }
          >
            {myMoments.length > 0 && (
              <>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 2,
                    marginHorizontal: 20,
                    marginBottom: 12,
                    marginTop: 4,
                  }}
                >
                  YOUR MOMENTS
                </Text>
                {myMoments.map((m) => (
                  <MomentCard key={m.id} moment={m} isOwn />
                ))}
              </>
            )}

            {invitedMoments.length > 0 && (
              <>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 2,
                    marginHorizontal: 20,
                    marginBottom: 12,
                    marginTop: myMoments.length > 0 ? 16 : 4,
                  }}
                >
                  FROM FRIENDS
                </Text>
                {invitedMoments.map((m) => (
                  <MomentCard key={m.id} moment={m} isOwn={false} />
                ))}
              </>
            )}

            {(archivedMoments ?? []).length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginHorizontal: 20,
                    marginBottom: 12,
                    marginTop: (myMoments.length > 0 || invitedMoments.length > 0) ? 24 : 4,
                  }}
                >
                  <Archive size={13} color="rgba(255,255,255,0.3)" />
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.3)',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 2,
                    }}
                  >
                    ARCHIVE
                  </Text>
                </View>
                {(archivedMoments ?? []).map((m) => (
                  <ArchiveCard key={m.id} moment={m} />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
