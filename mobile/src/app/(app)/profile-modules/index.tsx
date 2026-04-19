import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { ArrowLeft, Plus, Trash2, Rocket, Target, Smile, BookOpen, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { profileModulesApi, type ModuleType, type ProfileModule } from '@/lib/api/profile-modules';
import { useTheme } from '@/lib/theme';

const MODULE_TYPES: { type: ModuleType; label: string; emoji: string; icon: React.ReactNode }[] = [
  { type: 'project', label: 'Projects', emoji: '🚀', icon: <Rocket size={22} color="#00CF35" /> },
  { type: 'goal', label: 'Goals', emoji: '🎯', icon: <Target size={22} color="#00CF35" /> },
  { type: 'mood', label: 'Current Mood', emoji: '😊', icon: <Smile size={22} color="#00CF35" /> },
  { type: 'learning', label: "What I'm Learning", emoji: '📚', icon: <BookOpen size={22} color="#00CF35" /> },
  { type: 'availability', label: 'Availability', emoji: '🟢', icon: <Circle size={22} color="#00CF35" /> },
];

const MOOD_EMOJIS = ['😊', '😔', '😤', '🤔', '🥳', '😴'];
const AVAILABILITY_OPTIONS = ['Open to chat', 'Busy', 'Deep focus', 'Available for collabs'];

type FormState =
  | { type: 'project'; name: string; description: string; url: string }
  | { type: 'goal'; title: string; deadline: string }
  | { type: 'mood'; emoji: string; label: string }
  | { type: 'learning'; topic: string; resource: string }
  | { type: 'availability'; status: string };

function getDefaultForm(type: ModuleType): FormState {
  switch (type) {
    case 'project': return { type: 'project', name: '', description: '', url: '' };
    case 'goal': return { type: 'goal', title: '', deadline: '' };
    case 'mood': return { type: 'mood', emoji: '😊', label: '' };
    case 'learning': return { type: 'learning', topic: '', resource: '' };
    case 'availability': return { type: 'availability', status: 'Open to chat' };
  }
}

function parseModuleContent(mod: ProfileModule): Record<string, string> {
  try {
    return JSON.parse(mod.content) as Record<string, string>;
  } catch {
    return {};
  }
}

function ModuleCard({ mod, onDelete }: { mod: ProfileModule; onDelete: () => void }) {
  const theme = useTheme();
  const content = parseModuleContent(mod);
  const typeInfo = MODULE_TYPES.find(t => t.type === mod.type);

  const renderContent = () => {
    switch (mod.type) {
      case 'project':
        return (
          <View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{content.name ?? ''}</Text>
            {content.description ? (
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{content.description}</Text>
            ) : null}
            {content.url ? (
              <Text style={{ color: '#00CF35', fontSize: 11, marginTop: 4 }} numberOfLines={1}>{content.url}</Text>
            ) : null}
          </View>
        );
      case 'goal':
        return (
          <View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{content.title ?? ''}</Text>
            {content.deadline ? (
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Due: {content.deadline}</Text>
            ) : null}
          </View>
        );
      case 'mood':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 28 }}>{content.emoji ?? '😊'}</Text>
            {content.label ? (
              <Text style={{ color: theme.subtext, fontSize: 13 }}>{content.label}</Text>
            ) : null}
          </View>
        );
      case 'learning':
        return (
          <View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{content.topic ?? ''}</Text>
            {content.resource ? (
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>{content.resource}</Text>
            ) : null}
          </View>
        );
      case 'availability':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00CF35' }} />
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{content.status ?? ''}</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(0,207,53,0.2)',
      }}
    >
      <BlurView intensity={10} tint={theme.isDark ? 'dark' : 'light'} style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(0,207,53,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {typeInfo?.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                {typeInfo?.label.toUpperCase()}
              </Text>
              {renderContent()}
            </View>
          </View>
          <Pressable
            testID={`delete-module-${mod.id}`}
            onPress={onDelete}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(255,78,106,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
          >
            <Trash2 size={15} color="#FF4E6A" />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

function FormInput({
  placeholder,
  value,
  onChangeText,
  multiline,
  autoCapitalize,
  theme,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={theme.subtext}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: theme.text,
        fontSize: 14,
        borderWidth: 0.5,
        borderColor: theme.border,
        minHeight: multiline ? 72 : undefined,
        textAlignVertical: multiline ? 'top' : undefined,
      }}
    />
  );
}

function ProjectForm({
  form,
  setForm,
  theme,
}: {
  form: { type: 'project'; name: string; description: string; url: string };
  setForm: (f: FormState) => void;
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <View style={{ gap: 10 }}>
      <FormInput
        placeholder="Project name"
        value={form.name}
        onChangeText={t => setForm({ ...form, name: t })}
        theme={theme}
      />
      <FormInput
        placeholder="Short description"
        value={form.description}
        onChangeText={t => setForm({ ...form, description: t })}
        multiline
        theme={theme}
      />
      <FormInput
        placeholder="URL (optional)"
        value={form.url}
        onChangeText={t => setForm({ ...form, url: t })}
        autoCapitalize="none"
        theme={theme}
      />
    </View>
  );
}

function GoalForm({
  form,
  setForm,
  theme,
}: {
  form: { type: 'goal'; title: string; deadline: string };
  setForm: (f: FormState) => void;
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <View style={{ gap: 10 }}>
      <FormInput
        placeholder="Goal title"
        value={form.title}
        onChangeText={t => setForm({ ...form, title: t })}
        theme={theme}
      />
      <FormInput
        placeholder="Deadline e.g. Dec 2025 (optional)"
        value={form.deadline}
        onChangeText={t => setForm({ ...form, deadline: t })}
        theme={theme}
      />
    </View>
  );
}

function MoodForm({
  form,
  setForm,
  theme,
}: {
  form: { type: 'mood'; emoji: string; label: string };
  setForm: (f: FormState) => void;
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {MOOD_EMOJIS.map(e => (
          <Pressable
            key={e}
            testID={`mood-emoji-${e}`}
            onPress={() => setForm({ ...form, emoji: e })}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: form.emoji === e ? 'rgba(0,207,53,0.2)' : theme.card,
              borderWidth: form.emoji === e ? 1.5 : 0.5,
              borderColor: form.emoji === e ? '#00CF35' : theme.border,
            }}
          >
            <Text style={{ fontSize: 26 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <FormInput
        placeholder="Describe your mood (optional)"
        value={form.label}
        onChangeText={t => setForm({ ...form, label: t })}
        theme={theme}
      />
    </View>
  );
}

function LearningForm({
  form,
  setForm,
  theme,
}: {
  form: { type: 'learning'; topic: string; resource: string };
  setForm: (f: FormState) => void;
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <View style={{ gap: 10 }}>
      <FormInput
        placeholder="What are you learning?"
        value={form.topic}
        onChangeText={t => setForm({ ...form, topic: t })}
        theme={theme}
      />
      <FormInput
        placeholder="Resource or course (optional)"
        value={form.resource}
        onChangeText={t => setForm({ ...form, resource: t })}
        theme={theme}
      />
    </View>
  );
}

function AvailabilityForm({
  form,
  setForm,
  theme,
}: {
  form: { type: 'availability'; status: string };
  setForm: (f: FormState) => void;
  theme: { text: string; subtext: string; card: string; border: string };
}) {
  return (
    <View style={{ gap: 8 }}>
      {AVAILABILITY_OPTIONS.map(opt => (
        <Pressable
          key={opt}
          testID={`availability-option-${opt}`}
          onPress={() => setForm({ ...form, status: opt })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderRadius: 12,
            backgroundColor: form.status === opt ? 'rgba(0,207,53,0.15)' : theme.card,
            borderWidth: form.status === opt ? 1.5 : 0.5,
            borderColor: form.status === opt ? '#00CF35' : theme.border,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: form.status === opt ? '#00CF35' : theme.subtext,
            }}
          />
          <Text
            style={{
              color: form.status === opt ? theme.text : theme.subtext,
              fontSize: 14,
              fontWeight: form.status === opt ? '700' : '400',
            }}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileModulesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const queryClient = useQueryClient();
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState<ModuleType | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const { data: modules, isLoading } = useQuery({
    queryKey: ['profile-modules'],
    queryFn: () => profileModulesApi.getOwn(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { type: ModuleType; content: string }) =>
      profileModulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-modules'] });
      setForm(null);
      setSelectedType(null);
      setShowTypeSelector(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileModulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-modules'] });
    },
  });

  const handleSelectType = (type: ModuleType) => {
    setSelectedType(type);
    setForm(getDefaultForm(type));
    setShowTypeSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    if (!form || !selectedType) return;
    const { type, ...rest } = form;
    createMutation.mutate({ type, content: JSON.stringify(rest) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteMutation.mutate(id);
  };

  const renderForm = () => {
    if (!form) return null;
    switch (form.type) {
      case 'project':
        return <ProjectForm form={form} setForm={setForm} theme={theme} />;
      case 'goal':
        return <GoalForm form={form} setForm={setForm} theme={theme} />;
      case 'mood':
        return <MoodForm form={form} setForm={setForm} theme={theme} />;
      case 'learning':
        return <LearningForm form={form} setForm={setForm} theme={theme} />;
      case 'availability':
        return <AvailabilityForm form={form} setForm={setForm} theme={theme} />;
      default:
        return null;
    }
  };

  const moduleList = modules ?? [];

  return (
    <SafeAreaView testID="profile-modules-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.border,
        }}
      >
        <Pressable
          testID="back-button"
          onPress={handleBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', flex: 1 }}>My Modules</Text>
        <Pressable
          testID="add-module-button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowTypeSelector(true);
            setSelectedType(null);
            setForm(null);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#00CF35',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Plus size={16} color="#001935" />
          <Text style={{ color: '#001935', fontSize: 13, fontWeight: '800' }}>Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Type Selector */}
        {showTypeSelector ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 12, fontWeight: '600' }}>
              Choose a module type
            </Text>
            <View style={{ gap: 8 }}>
              {MODULE_TYPES.map(mt => (
                <Pressable
                  key={mt.type}
                  testID={`module-type-${mt.type}`}
                  onPress={() => handleSelectType(mt.type)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: theme.card,
                    borderWidth: 0.5,
                    borderColor: 'rgba(0,207,53,0.2)',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{mt.emoji}</Text>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{mt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              testID="cancel-type-selector"
              onPress={() => setShowTypeSelector(false)}
              style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}
            >
              <Text style={{ color: theme.subtext, fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Module Form */}
        {form && !showTypeSelector ? (
          <View
            style={{
              margin: 16,
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: 0.5,
              borderColor: 'rgba(0,207,53,0.3)',
            }}
          >
            <BlurView intensity={12} tint={theme.isDark ? 'dark' : 'light'} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Text style={{ fontSize: 22 }}>
                  {MODULE_TYPES.find(t => t.type === selectedType)?.emoji}
                </Text>
                <Text style={{ color: '#00CF35', fontSize: 15, fontWeight: '700' }}>
                  {MODULE_TYPES.find(t => t.type === selectedType)?.label}
                </Text>
              </View>
              {renderForm()}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  testID="cancel-form-button"
                  onPress={() => {
                    setForm(null);
                    setSelectedType(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: theme.card,
                    borderWidth: 0.5,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ color: theme.subtext, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="save-module-button"
                  onPress={handleSave}
                  disabled={createMutation.isPending}
                  style={{
                    flex: 2,
                    paddingVertical: 13,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: '#00CF35',
                  }}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#001935" size="small" />
                  ) : (
                    <Text style={{ color: '#001935', fontWeight: '800', fontSize: 14 }}>Save Module</Text>
                  )}
                </Pressable>
              </View>
            </BlurView>
          </View>
        ) : null}

        {/* Module List */}
        {isLoading ? (
          <ActivityIndicator testID="loading-indicator" color="#00CF35" style={{ marginTop: 40 }} />
        ) : moduleList.length === 0 && !showTypeSelector && !form ? (
          <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🧩</Text>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
              No modules yet
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Add modules to showcase your projects, goals, mood, and more on your profile.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: showTypeSelector || form ? 8 : 16 }}>
            {moduleList.length > 0 ? (
              <Text
                style={{
                  color: theme.subtext,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  paddingHorizontal: 20,
                  marginBottom: 10,
                }}
              >
                YOUR MODULES
              </Text>
            ) : null}
            {moduleList.map(mod => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                onDelete={() => handleDelete(mod.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
