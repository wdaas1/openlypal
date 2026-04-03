import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { Ghost, ArrowLeft } from 'lucide-react-native';
import { relationshipsApi, RelationshipStat } from '@/lib/api/relationships';
import { useSession } from '@/lib/auth/use-session';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function daysAgoLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

function getInitial(name: string): string {
  return (name ?? '?').charAt(0).toUpperCase();
}

function strengthColor(score: number): string {
  if (score > 60) return '#00CF35';
  if (score >= 30) return '#F5A623';
  return '#FF4E6A';
}

// ---------- Drift Nudge Card ----------
function NudgeCard({ stat }: { stat: RelationshipStat }) {
  const router = useRouter();
  return (
    <Pressable
      testID={`nudge-card-${stat.user.id}`}
      onPress={() => router.push(`/(app)/messenger/${stat.user.id}` as any)}
      style={{
        backgroundColor: '#011e3d',
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        width: 180,
        borderWidth: 1,
        borderColor: 'rgba(255,78,106,0.25)',
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#FF4E6A22',
          borderWidth: 2,
          borderColor: '#FF4E6A55',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Text style={{ color: '#FF4E6A', fontSize: 20, fontWeight: '700' }}>
          {getInitial(stat.user.name)}
        </Text>
      </View>
      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
        {stat.user.name}
      </Text>
      {stat.user.username ? (
        <Text style={{ color: '#4a7fa5', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          @{stat.user.username}
        </Text>
      ) : null}
      <Text style={{ color: '#FF4E6A', fontSize: 11, marginTop: 6 }}>
        {stat.daysSince > 0 ? `${stat.daysSince} days since last chat` : 'No messages yet'}
      </Text>
      {/* Say Hi button */}
      <View
        style={{
          marginTop: 12,
          backgroundColor: '#00CF35',
          borderRadius: 8,
          paddingVertical: 6,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#001935', fontWeight: '700', fontSize: 12 }}>Say Hi →</Text>
      </View>
    </Pressable>
  );
}

// ---------- Relationship Map ----------
function RelationshipMap({
  stats,
  userName,
}: {
  stats: RelationshipStat[];
  userName: string;
}) {
  const MAP_HEIGHT = 300;
  const mapWidth = SCREEN_WIDTH - 32; // 16px horizontal padding each side
  const centerX = mapWidth / 2;
  const centerY = MAP_HEIGHT / 2;
  const radius = Math.min(centerX, centerY) * 0.72;

  const visible = stats.slice(0, 8);

  return (
    <View
      testID="relationship-map"
      style={{
        height: MAP_HEIGHT,
        position: 'relative',
        backgroundColor: '#011428',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#0a2a44',
      }}
    >
      <Svg width={mapWidth} height={MAP_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
        {visible.map((stat, i) => {
          const angle = (2 * Math.PI * i) / visible.length - Math.PI / 2;
          const fx = centerX + radius * Math.cos(angle);
          const fy = centerY + radius * Math.sin(angle);
          const opacity = 0.2 + (stat.strengthScore / 100) * 0.7;
          const lineColor = stat.isDrifting ? '#FF4E6A' : '#00CF35';
          return (
            <Line
              key={stat.user.id}
              x1={centerX}
              y1={centerY}
              x2={fx}
              y2={fy}
              stroke={lineColor}
              strokeWidth={1.5}
              strokeOpacity={opacity}
            />
          );
        })}
        {/* Center glow ring */}
        <SvgCircle
          cx={centerX}
          cy={centerY}
          r={28}
          fill="rgba(0,207,53,0.1)"
          stroke="rgba(0,207,53,0.4)"
          strokeWidth={1.5}
        />
      </Svg>

      {/* Center node — You */}
      <View
        style={{
          position: 'absolute',
          left: centerX - 24,
          top: centerY - 24,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#001935',
          borderWidth: 2.5,
          borderColor: '#00CF35',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#00CF35',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text style={{ color: '#00CF35', fontWeight: '800', fontSize: 18 }}>
          {getInitial(userName)}
        </Text>
      </View>

      {/* Friend nodes */}
      {visible.map((stat, i) => {
        const angle = (2 * Math.PI * i) / visible.length - Math.PI / 2;
        const fx = centerX + radius * Math.cos(angle);
        const fy = centerY + radius * Math.sin(angle);
        const nodeSize = 12 + Math.round((stat.strengthScore / 100) * 14);
        const half = nodeSize / 2;
        const nodeColor = stat.isDrifting ? '#FF4E6A' : '#00CF35';
        return (
          <View
            key={stat.user.id}
            style={{
              position: 'absolute',
              left: fx - half - 1,
              top: fy - half - 20,
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, marginBottom: 2 }}
              numberOfLines={1}
            >
              {stat.user.name.split(' ')[0]}
            </Text>
            <View
              style={{
                width: nodeSize,
                height: nodeSize,
                borderRadius: nodeSize / 2,
                backgroundColor: nodeColor + '33',
                borderWidth: 1.5,
                borderColor: nodeColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: nodeColor, fontSize: 8, fontWeight: '700' }}>
                {getInitial(stat.user.name)}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          right: 14,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00CF35' }} />
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Active</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4E6A' }} />
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Drifting</Text>
        </View>
      </View>
    </View>
  );
}

// ---------- Friend Card ----------
function FriendCard({ stat }: { stat: RelationshipStat }) {
  const router = useRouter();
  const barColor = strengthColor(stat.strengthScore);

  return (
    <Pressable
      testID={`friend-card-${stat.user.id}`}
      onPress={() => router.push(`/(app)/user/${stat.user.id}` as any)}
      style={{
        backgroundColor: '#011e3d',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#0a2a44',
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: barColor + '22',
          borderWidth: 2,
          borderColor: barColor + '55',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ color: barColor, fontWeight: '700', fontSize: 18 }}>
          {getInitial(stat.user.name)}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
            {stat.user.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            {stat.messageCount} msgs
          </Text>
        </View>
        {stat.user.username ? (
          <Text style={{ color: '#4a7fa5', fontSize: 12, marginTop: 1 }}>
            @{stat.user.username}
          </Text>
        ) : null}
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>
          {stat.lastInteractionAt
            ? daysAgoLabel(stat.daysSince)
            : 'Never'}
        </Text>
        {/* Strength bar */}
        <View
          style={{
            marginTop: 7,
            height: 3,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${stat.strengthScore}%`,
              height: '100%',
              backgroundColor: barColor,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ---------- Main Screen ----------
export default function RelationshipsScreen() {
  const router = useRouter();
  const { data: session } = useSession();

  const { data: allStats, isLoading: loadingAll } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => relationshipsApi.getAll(),
  });

  const { data: nudges, isLoading: loadingNudges } = useQuery({
    queryKey: ['relationship-nudges'],
    queryFn: () => relationshipsApi.getNudges(),
  });

  const isLoading = loadingAll || loadingNudges;
  const stats = allStats ?? [];
  const drifting = nudges ?? [];
  const userName = session?.user?.name ?? 'You';

  return (
    <SafeAreaView
      testID="relationships-screen"
      style={{ flex: 1, backgroundColor: '#000d1a' }}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 0.5,
          borderBottomColor: '#0a2a44',
        }}
      >
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ marginRight: 12, padding: 4 }}
        >
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>
          Relationship Map
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : stats.length === 0 ? (
        <View
          testID="empty-state"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 40, marginBottom: 16 }}>
            👥
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            Start chatting with friends to see your relationship map
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1 — Drift Nudges */}
          {drifting.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <Ghost size={18} color="#FF4E6A" />
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                  Drifting Apart
                </Text>
                <View
                  style={{
                    backgroundColor: '#FF4E6A22',
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#FF4E6A', fontSize: 11, fontWeight: '700' }}>
                    {drifting.length}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
              >
                {drifting.map((stat) => (
                  <NudgeCard key={stat.user.id} stat={stat} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Section 2 — Relationship Map */}
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontWeight: '700',
                marginBottom: 12,
              }}
            >
              Your Circle
            </Text>
            <RelationshipMap stats={stats} userName={userName} />
          </View>

          {/* Section 3 — Friend Cards */}
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontWeight: '700',
                marginBottom: 12,
              }}
            >
              All Connections
            </Text>
            {stats.map((stat) => (
              <FriendCard key={stat.user.id} stat={stat} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
