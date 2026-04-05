import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HelpCircle, Mail, ChevronLeft, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react-native';
import Constants from 'expo-constants';

const FAQ_ITEMS = [
  {
    id: '1',
    question: 'How do I change my profile photo?',
    answer: 'Tap your profile picture on the Profile tab. This will open your device\'s photo library so you can choose a new image. You can also tap the header banner to update your cover photo.',
  },
  {
    id: '2',
    question: 'How do I control what content I see?',
    answer: 'Go to your Profile tab and tap "Interests" to select the content categories you enjoy. You can also toggle "Show explicit content" on or off from the same settings section.',
  },
  {
    id: '3',
    question: 'How do I report inappropriate content?',
    answer: 'If you come across content that violates our guidelines, please email us at info@clearstepsdigital.com with details of the post. We take all reports seriously and will review them promptly.',
  },
  {
    id: '4',
    question: 'How do I delete my account?',
    answer: 'To request account deletion, please email info@clearstepsdigital.com from the email address associated with your account. We will process your request within 30 days and permanently delete your data.',
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      testID={`faq-item-${question.slice(0, 10)}`}
      onPress={() => setExpanded((v) => !v)}
      style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
    >
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-white font-medium text-sm flex-1 pr-3">{question}</Text>
        {expanded ? (
          <ChevronUp size={16} color="#4a6fa5" />
        ) : (
          <ChevronDown size={16} color="#4a6fa5" />
        )}
      </View>
      {expanded ? (
        <View className="px-4 pb-4">
          <Text className="text-sm leading-5" style={{ color: '#a0b4c8' }}>
            {answer}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SupportScreen() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleEmail = () => {
    Linking.openURL('mailto:info@clearstepsdigital.com?subject=Support%20Request');
  };

  return (
    <SafeAreaView testID="support-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable
          testID="back-button"
          onPress={() => router.push('/(app)/settings' as any)}
          className="mr-3 p-1"
          style={{ borderRadius: 20 }}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <HelpCircle size={18} color="#00CF35" />
          <Text className="text-white font-bold text-lg">Support & FAQ</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* Contact Us */}
        <View className="px-4 mt-5">
          <Text className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>
            Contact Us
          </Text>
          <View className="rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}>
            <View
              className="flex-row items-center px-4 py-4"
              style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
            >
              <View className="mr-3 rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: '#001935' }}>
                <Mail size={18} color="#00CF35" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium text-sm">Email Support</Text>
                <Text className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>info@clearstepsdigital.com</Text>
              </View>
            </View>

            <Pressable
              testID="send-email-button"
              onPress={handleEmail}
              className="flex-row items-center justify-center py-4 gap-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <ExternalLink size={16} color="#00CF35" />
              <Text className="font-semibold text-sm" style={{ color: '#00CF35' }}>
                Send Email
              </Text>
            </Pressable>
          </View>
        </View>

        {/* FAQ */}
        <View className="px-4 mt-6">
          <Text className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>
            Frequently Asked Questions
          </Text>
          <View className="rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}>
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem
                key={item.id}
                question={item.question}
                answer={item.answer}
              />
            ))}
          </View>
        </View>

        {/* About */}
        <View className="px-4 mt-6 mb-8">
          <Text className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>
            About
          </Text>
          <View className="rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}>
            <View
              className="flex-row items-center justify-between px-4 py-4"
              style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
            >
              <View className="flex-row items-center gap-3">
                <View className="rounded-lg items-center justify-center" style={{ width: 36, height: 36, backgroundColor: '#001935' }}>
                  <Info size={18} color="#00CF35" />
                </View>
                <Text className="text-white font-medium text-sm">App Version</Text>
              </View>
              <Text className="text-sm" style={{ color: '#4a6fa5' }}>{appVersion}</Text>
            </View>
            <View className="px-4 py-4">
              <Text className="text-sm text-center" style={{ color: '#4a6fa5' }}>
                © 2025 Clear Step Digital Ltd{'\n'}All rights reserved.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
