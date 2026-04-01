import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Compass, PlusCircle, Zap, User, MessageCircle } from 'lucide-react-native';
import { View } from 'react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#001935',
          borderTopColor: '#1a3a5c',
          borderTopWidth: 0.5,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#4a6fa5',
        tabBarIconStyle: { width: 20, height: 20 },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Compass size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: () => (
            <View className="items-center justify-center rounded-full" style={{ backgroundColor: '#00CF35', width: 40, height: 40, marginTop: -4 }}>
              <PlusCircle size={24} color="#001935" />
            </View>
          ),
          tabBarLabelStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <Zap size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messenger"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageCircle size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={20} color={color} />,
        }}
      />
      <Tabs.Screen name="messenger/[userId]" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
      <Tabs.Screen name="interests" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="legal" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
  );
}
