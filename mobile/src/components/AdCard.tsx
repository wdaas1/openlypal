import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Megaphone, Sparkles, TrendingUp, Star } from 'lucide-react-native';
import type { Ad } from '@/lib/types';

const THEME_CONFIG = {
  green: {
    colors: ['#0f4c2e', '#00CF35', '#0a3d24'] as const,
    icon: TrendingUp,
    iconColor: '#00FF4C',
    accentColor: '#00FF4C',
  },
  purple: {
    colors: ['#1a1a3e', '#3b2de8', '#0d0d2b'] as const,
    icon: Sparkles,
    iconColor: '#a78bfa',
    accentColor: '#a78bfa',
  },
  orange: {
    colors: ['#3d1a0a', '#e85f2d', '#2b0d0d'] as const,
    icon: Megaphone,
    iconColor: '#fb923c',
    accentColor: '#fb923c',
  },
  blue: {
    colors: ['#1a2a3d', '#2d6ae8', '#0d1b2b'] as const,
    icon: Star,
    iconColor: '#60a5fa',
    accentColor: '#60a5fa',
  },
} as const;

interface AdCardProps {
  ad: Ad;
  adIndex: number;
  onDismiss: (adId: string) => void;
}

export function AdCard({ ad, adIndex, onDismiss }: AdCardProps) {
  const { width } = useWindowDimensions();
  const theme = THEME_CONFIG[ad.theme] ?? THEME_CONFIG.green;
  const Icon = theme.icon;

  return (
    <View testID={`ad-card-${adIndex}`} style={{ width, marginBottom: 12 }}>
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: '100%', paddingHorizontal: 16, paddingVertical: 16 }}
      >
        {/* Sponsored badge + dismiss */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accentColor }} />
            <Text style={{ color: theme.accentColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>SPONSORED</Text>
          </View>
          <Pressable
            testID={`ad-dismiss-${adIndex}`}
            onPress={() => onDismiss(ad.id)}
            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={13} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${theme.accentColor}30` }}>
            <Icon size={26} color={theme.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 3 }}>{ad.headline}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 }}>{ad.subtext}</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          testID={`ad-cta-${adIndex}`}
          style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: theme.accentColor, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 }}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>{ad.cta}</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}
