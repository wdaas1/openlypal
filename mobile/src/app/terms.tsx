import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export const TERMS_KEY = 'terms_accepted_v1';

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance',
    body: 'By using Openly ("the App"), you agree to these Terms of Use. If you do not agree, do not use the App.',
  },
  {
    title: '2. Prohibited Conduct',
    body: 'You must not use the App to:\n\n• Harass, bully, threaten, or abuse any person\n• Post hate speech targeting race, ethnicity, religion, gender, sexual orientation, disability, or nationality\n• Share non-consensual intimate images (NCII) or content involving minors\n• Distribute spam, scams, or fraudulent content\n• Promote violence, self-harm, or terrorism\n• Impersonate others or create fake accounts\n• Violate any applicable law or regulation',
  },
  {
    title: '3. Content Moderation',
    body: 'We use automated and human moderation. Content that violates these Terms may be removed without notice. Accounts that repeatedly violate these Terms will be banned.',
  },
  {
    title: '4. Reporting',
    body: 'Use the Report button on any post to flag violations. We review all reports and will take appropriate action. False or malicious reporting may result in account suspension.',
  },
  {
    title: '5. User-Generated Content',
    body: 'You are responsible for content you post. You retain ownership, but grant Openly a licence to display and distribute your content within the App. Do not post content you do not have the right to share.',
  },
  {
    title: '6. Privacy',
    body: 'We collect only the data necessary to provide the service. We do not sell your personal data to third parties. You may request deletion of your account and data at any time.',
  },
  {
    title: '7. Termination',
    body: 'We may suspend or terminate your account for violations of these Terms without prior notice. You may delete your account at any time in Settings.',
  },
  {
    title: '8. Changes',
    body: 'We may update these Terms. Continued use after changes constitutes acceptance. We will notify you of material changes in the App.',
  },
  {
    title: '9. Contact',
    body: 'For questions or to report abuse, contact: support@openlypal.com',
  },
];

export default function TermsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(TERMS_KEY, 'true');
    router.replace('/welcome' as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}>
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: 'rgba(0,207,53,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <ShieldCheck size={30} color="#00CF35" />
        </View>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginBottom: 6 }}>
          Terms of Use
        </Text>
        <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
          Please read and accept our Terms of Use before continuing.
        </Text>
      </View>

      {/* Scrollable Terms */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {TERMS_SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
              {section.title}
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 20 }}>
              {section.body}
            </Text>
          </View>
        ))}

        <View style={{
          marginTop: 8,
          padding: 14,
          borderRadius: 12,
          backgroundColor: 'rgba(255,78,106,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255,78,106,0.2)',
        }}>
          <Text style={{ color: '#FF4E6A', fontSize: 13, fontWeight: '600', lineHeight: 19 }}>
            Violations including abuse, harassment, hate speech, and illegal content will result in immediate account suspension and may be reported to law enforcement.
          </Text>
        </View>
      </ScrollView>

      {/* Accept Button */}
      <View style={{
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
        borderTopWidth: 0.5,
        borderTopColor: theme.border,
        backgroundColor: theme.bg,
      }}>
        <Text style={{ color: theme.subtext, fontSize: 12, textAlign: 'center', marginBottom: 14, lineHeight: 17 }}>
          By tapping "I Agree & Continue" you confirm you are 13+ years old and agree to our Terms of Use.
        </Text>
        <Pressable
          testID="terms-accept-button"
          onPress={handleAccept}
          style={{
            backgroundColor: '#00CF35',
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#001935', fontWeight: '800', fontSize: 16 }}>
            I Agree &amp; Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
