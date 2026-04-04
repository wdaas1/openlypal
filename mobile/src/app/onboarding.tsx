import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';

const SLIDES = [
  {
    id: 'welcome',
    emoji: '✨',
    title: 'Welcome to Openly',
    subtitle: 'The creative social platform where your voice matters. Be yourself — the rest follows.',
    gradientColors: ['rgba(0,207,53,0.18)', 'rgba(0,207,53,0.03)'] as const,
    accentColor: '#00CF35',
  },
  {
    id: 'share',
    emoji: '📸',
    title: 'Share Everything',
    subtitle: 'Post photos, videos, quotes, and live moments. Express yourself in any format.',
    gradientColors: ['rgba(74,159,255,0.18)', 'rgba(74,159,255,0.03)'] as const,
    accentColor: '#4a9fff',
  },
  {
    id: 'discover',
    emoji: '🔥',
    title: 'Find Your People',
    subtitle: 'Explore trending content, follow creators, and discover communities you love.',
    gradientColors: ['rgba(255,78,106,0.18)', 'rgba(255,78,106,0.03)'] as const,
    accentColor: '#FF4E6A',
  },
];

const CATEGORIES = [
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'tech', label: 'Technology', emoji: '💻' },
  { id: 'humor', label: 'Humor', emoji: '😂' },
  { id: 'film', label: 'Film & TV', emoji: '🎬' },
  { id: 'comics', label: 'Comics', emoji: '💥' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'lgbtq', label: 'LGBTQ+', emoji: '🏳️‍🌈' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'slides' | 'interests'>('slides');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: session } = useSession();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.length > 0 && session?.user?.id) {
        await api.patch('/api/users/me', { categories: selectedIds.join(',') });
      }
    },
    onSuccess: async () => {
      await AsyncStorage.setItem('onboarding_done', 'true');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace('/(app)' as any);
    },
  });

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      setPhase('interests');
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('interests');
  };

  const toggleCategory = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Interests phase ─────────────────────────────────────────────────────────
  if (phase === 'interests') {
    return (
      <View testID="onboarding-interests-screen" style={{ flex: 1, backgroundColor: '#001935' }}>
        <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
          {/* Header */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
              What are you into?
            </Text>
            <Text style={{ color: '#4a6fa5', fontSize: 15, lineHeight: 22 }}>
              Pick topics to personalize your feed.
              {selectedIds.length > 0 ? `  ${selectedIds.length} selected` : null}
            </Text>
          </View>

          {/* Category grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {CATEGORIES.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    testID={`onboarding-interest-${item.id}`}
                    onPress={() => toggleCategory(item.id)}
                    style={{
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      backgroundColor: isSelected ? 'rgba(0,207,53,0.12)' : '#0a2d50',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#00CF35' : '#1a3a5c',
                      width: (width - 50) / 2,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isSelected ? '#00CF35' : '#a0b4c8',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Get Started button — pinned to bottom */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 24,
            paddingBottom: Math.max(insets.bottom + 16, 32),
            paddingTop: 16,
            backgroundColor: '#001935',
            borderTopWidth: 0.5,
            borderTopColor: '#1a3a5c',
          }}
        >
          <Pressable
            testID="get-started-button"
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              backgroundColor: '#00CF35',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              shadowColor: '#00CF35',
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#001935" />
            ) : (
              <Text style={{ color: '#001935', fontWeight: '800', fontSize: 16 }}>
                {selectedIds.length > 0 ? 'Get Started' : 'Skip & Get Started'}
              </Text>
            )}
          </Pressable>
          {saveMutation.isError ? (
            <Text style={{ color: '#FF4E6A', textAlign: 'center', fontSize: 13, marginTop: 10 }}>
              Something went wrong. Please try again.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Intro slides phase ───────────────────────────────────────────────────────
  return (
    <View testID="onboarding-slides-screen" style={{ flex: 1, backgroundColor: '#001935' }}>
      {/* Skip */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 16,
          right: 20,
          zIndex: 10,
        }}
      >
        <Pressable
          testID="onboarding-skip-button"
          onPress={handleSkip}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#1a3a5c',
          }}
        >
          <Text style={{ color: '#4a6fa5', fontWeight: '600', fontSize: 14 }}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(newIndex);
        }}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 36,
              paddingTop: insets.top + 80,
              paddingBottom: 200,
            }}
          >
            {/* Icon circle */}
            <View style={{ marginBottom: 44, alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer glow */}
              <View
                style={{
                  position: 'absolute',
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: item.accentColor,
                  opacity: 0.07,
                }}
              />
              <LinearGradient
                colors={item.gradientColors}
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: item.accentColor + '35',
                }}
              >
                <Text style={{ fontSize: 64 }}>{item.emoji}</Text>
              </LinearGradient>
            </View>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 30,
                fontWeight: '800',
                textAlign: 'center',
                marginBottom: 16,
                lineHeight: 37,
                letterSpacing: -0.5,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: '#6b8fb8',
                fontSize: 16,
                textAlign: 'center',
                lineHeight: 25,
              }}
            >
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Math.max(insets.bottom + 16, 36),
          paddingHorizontal: 24,
          gap: 20,
        }}
      >
        {/* Pagination dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? '#00CF35' : '#1a3a5c',
              }}
            />
          ))}
        </View>

        {/* Next / Continue button */}
        <Pressable
          testID="onboarding-next-button"
          onPress={handleNext}
          style={{
            backgroundColor: '#00CF35',
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            shadowColor: '#00CF35',
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ color: '#001935', fontWeight: '800', fontSize: 16 }}>
            {currentIndex === SLIDES.length - 1 ? 'Continue' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
