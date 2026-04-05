import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ChevronLeft } from 'lucide-react-native';

const PRIVACY_POLICY = `Last updated: January 1, 2025

Clear Step Digital Ltd ("we", "our", or "us") operates this mobile application. This Privacy Policy explains how we collect, use, and protect your personal information.

1. INFORMATION WE COLLECT

Account Information
When you create an account, we collect your name, email address, username, and profile photo. This information is necessary to provide our services.

Content You Post
We store content you voluntarily upload, including photos, videos, captions, and comments. You retain ownership of your content, but grant us a licence to display it within the app.

Usage Data
We automatically collect information about how you use the app, including features accessed, time spent, and interactions with content. This data helps us improve the service.

Device Information
We collect device identifiers, operating system version, and app version for diagnostic and security purposes.

2. HOW WE USE YOUR INFORMATION

We use your information to:
• Provide and maintain the app and its features
• Personalise your content feed based on your stated interests
• Send service-related notifications
• Detect and prevent fraudulent or abusive activity
• Comply with legal obligations

We do not sell your personal information to third parties.

3. DATA SHARING

We may share your information with:
• Service providers who assist us in operating the app (e.g. cloud storage, analytics)
• Law enforcement when required by law or to protect rights and safety
• A successor entity in the event of a merger or acquisition

4. DATA RETENTION

We retain your data for as long as your account is active. You may request deletion of your account and associated data by contacting us at info@clearstepsdigital.com.

5. YOUR RIGHTS

Depending on your jurisdiction, you may have the right to:
• Access the personal data we hold about you
• Request correction of inaccurate data
• Request deletion of your data
• Object to or restrict our processing of your data
• Data portability

To exercise any of these rights, please contact us at info@clearstepsdigital.com.

6. SECURITY

We implement industry-standard security measures to protect your information. However, no method of transmission over the internet is 100% secure.

7. CHILDREN'S PRIVACY

This app is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13.

8. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice in the app or via email.

9. CONTACT US

If you have questions about this Privacy Policy, please contact:

Clear Step Digital Ltd
Email: info@clearstepsdigital.com

© 2024–2025 Clear Step Digital Ltd. All rights reserved.`;

const TERMS_OF_SERVICE = `Last updated: January 1, 2025

These Terms of Service ("Terms") govern your use of the mobile application operated by Clear Step Digital Ltd ("we", "our", or "us"). By using the app, you agree to these Terms.

1. ACCEPTANCE OF TERMS

By creating an account or using this app, you confirm that you are at least 13 years of age and agree to be bound by these Terms and our Privacy Policy.

2. YOUR ACCOUNT

You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at info@clearstepsdigital.com if you suspect unauthorised access.

3. CONTENT AND CONDUCT

You may post photos, videos, and other content ("User Content") subject to the following rules:

You must not post content that:
• Is illegal, harmful, threatening, abusive, or harassing
• Infringes any intellectual property or privacy rights
• Contains malware, spam, or unsolicited commercial messages
• Depicts minors in a sexual context
• Violates any applicable law or regulation

We reserve the right to remove content and suspend or terminate accounts that violate these rules.

4. INTELLECTUAL PROPERTY

All rights in the app, its design, and underlying technology belong to Clear Step Digital Ltd. You may not copy, modify, distribute, or create derivative works based on the app without our express written permission.

You retain ownership of User Content you post. By posting, you grant us a worldwide, royalty-free, non-exclusive licence to store, display, and distribute your content within the app.

5. EXPLICIT CONTENT

The app includes an optional explicit content setting. By enabling this setting, you confirm you are of legal age in your jurisdiction to view such content. You accept full responsibility for your decision to enable this feature.

6. DISCLAIMER OF WARRANTIES

The app is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the app will be error-free, uninterrupted, or free of viruses.

7. LIMITATION OF LIABILITY

To the maximum extent permitted by law, Clear Step Digital Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the app.

8. TERMINATION

We may suspend or terminate your account at any time, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.

9. GOVERNING LAW

These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.

10. CHANGES TO TERMS

We may update these Terms from time to time. Continued use of the app after changes constitutes acceptance of the updated Terms.

11. CONTACT US

If you have questions about these Terms, please contact:

Clear Step Digital Ltd
Email: info@clearstepsdigital.com

© 2024–2025 Clear Step Digital Ltd. All rights reserved.`;

export default function LegalScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  const content = activeTab === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <SafeAreaView testID="legal-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
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
          <Shield size={18} color="#00CF35" />
          <Text className="text-white font-bold text-lg">Legal</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row mx-4 mt-4 rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50' }}>
        <Pressable
          testID="privacy-tab"
          onPress={() => setActiveTab('privacy')}
          className="flex-1 py-3 items-center"
          style={{
            backgroundColor: activeTab === 'privacy' ? '#00CF35' : 'transparent',
            borderRadius: 10,
            margin: 3,
          }}
        >
          <Text
            className="font-semibold text-sm"
            style={{ color: activeTab === 'privacy' ? '#001935' : '#4a6fa5' }}
          >
            Privacy Policy
          </Text>
        </Pressable>
        <Pressable
          testID="terms-tab"
          onPress={() => setActiveTab('terms')}
          className="flex-1 py-3 items-center"
          style={{
            backgroundColor: activeTab === 'terms' ? '#00CF35' : 'transparent',
            borderRadius: 10,
            margin: 3,
          }}
        >
          <Text
            className="font-semibold text-sm"
            style={{ color: activeTab === 'terms' ? '#001935' : '#4a6fa5' }}
          >
            Terms of Service
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 mt-4" showsVerticalScrollIndicator={false}>
        <View
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
        >
          <Text className="text-sm leading-6" style={{ color: '#a0b4c8' }}>
            {content}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
