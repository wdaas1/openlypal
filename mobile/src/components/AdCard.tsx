import React, { useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Megaphone, Sparkles, TrendingUp, Star } from 'lucide-react-native';

const AD_THEMES = [
  {
    colors: ['#0f4c2e', '#00CF35', '#0a3d24'] as const,
    icon: TrendingUp,
    iconColor: '#00FF4C',
    headline: 'Grow Your Audience',
    subtext: 'Reach thousands of engaged readers on Openly',
    cta: 'Get Started',
    accentColor: '#00FF4C',
  },
  {
    colors: ['#1a1a3e', '#3b2de8', '#0d0d2b'] as const,
    icon: Sparkles,
    iconColor: '#a78bfa',
    headline: 'Discover Amazing Content',
    subtext: 'Advertise your brand to our creative community',
    cta: 'Learn More',
    accentColor: '#a78bfa',
  },
  {
    colors: ['#3d1a0a', '#e85f2d', '#2b0d0d'] as const,
    icon: Megaphone,
    iconColor: '#fb923c',
    headline: 'Your Ad Could Be Here',
    subtext: 'Connect with passionate creators and their fans',
    cta: 'Advertise',
    accentColor: '#fb923c',
  },
  {
    colors: ['#1a2a3d', '#2d6ae8', '#0d1b2b'] as const,
    icon: Star,
    iconColor: '#60a5fa',
    headline: 'Premium Placement',
    subtext: 'Sponsor posts and reach your ideal audience',
    cta: 'Contact Us',
    accentColor: '#60a5fa',
  },
] as const;

interface AdCardProps {
  index: number;
}

export function AdCard({ index }: AdCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const { width } = useWindowDimensions();
  const theme = AD_THEMES[index % AD_THEMES.length];
  const Icon = theme.icon;

  if (dismissed) return null;

  return (
    <View
      testID={`ad-card-${index}`}
      style={{ width, marginBottom: 12 }}
    >
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: '100%', paddingHorizontal: 16, paddingVertical: 16 }}
      >
        {/* Sponsored badge + dismiss */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 3,
              gap: 4,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.accentColor,
              }}
            />
            <Text style={{ color: theme.accentColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              SPONSORED
            </Text>
          </View>
          <Pressable
            testID={`ad-dismiss-${index}`}
            onPress={() => setDismissed(true)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: `${theme.accentColor}30`,
            }}
          >
            <Icon size={26} color={theme.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 3 }}>
              {theme.headline}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 }}>
              {theme.subtext}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          testID={`ad-cta-${index}`}
          style={{
            marginTop: 14,
            alignSelf: 'flex-start',
            backgroundColor: theme.accentColor,
            borderRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>
            {theme.cta}
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}
