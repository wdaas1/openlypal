import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { useTheme } from '@/lib/theme';
import { UserAvatar } from '@/components/UserAvatar';

interface MentionTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  style?: any;
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  numberOfLines?: number;
  testID?: string;
  returnKeyType?: 'done' | 'next' | 'send' | 'go';
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
}

interface SearchUser {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

interface ActiveMention {
  query: string;
  start: number;
}

const detectMentionAtCursor = (text: string, pos: number): { query: string; start: number } | null => {
  let start = pos;
  while (start > 0 && !/[\s\n]/.test(text[start - 1])) {
    start--;
  }
  const word = text.slice(start, pos);
  if (word.startsWith('@') && word.length > 1) {
    return { query: word.slice(1), start };
  }
  return null;
};

export function MentionTextInput({
  value,
  onChangeText,
  style,
  placeholder,
  placeholderTextColor,
  multiline,
  numberOfLines,
  testID,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
}: MentionTextInputProps) {
  const theme = useTheme();
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (activeMention) {
      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(activeMention.query);
      }, 200);
    } else {
      setDebouncedQuery('');
    }
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [activeMention]);

  const { data: searchResults } = useQuery({
    queryKey: ['users', 'mention-search', debouncedQuery],
    queryFn: () => api.get<SearchUser[]>(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length > 0,
  });

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) => {
    const { start } = e.nativeEvent.selection;
    const mention = detectMentionAtCursor(value, start);
    setActiveMention(mention);
  };

  const handleChangeText = (text: string) => {
    onChangeText(text);
  };

  const handleSelectUser = (username: string) => {
    if (!activeMention) return;
    const before = value.slice(0, activeMention.start);
    const after = value.slice(activeMention.start + activeMention.query.length + 1); // +1 for @
    onChangeText(`${before}@${username} ${after}`);
    setActiveMention(null);
  };

  const results = searchResults ? searchResults.slice(0, 5) : [];
  const showDropdown = debouncedQuery.length > 0 && results.length > 0 ? true : false;

  return (
    <View style={{ position: 'relative', zIndex: 1000 }}>
      {showDropdown ? (
        <View
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            backgroundColor: theme.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            zIndex: 1000,
            marginBottom: 4,
            overflow: 'hidden',
          }}
        >
          {results.map((user, index) => (
            <Pressable
              key={user.id}
              onPress={() => handleSelectUser(user.username ?? user.name)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: pressed ? theme.cardAlt : theme.card,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: theme.border,
              })}
              testID={`mention-user-${user.username ?? user.id}`}
            >
              <UserAvatar uri={user.image} name={user.name} size={28} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text
                  style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                {user.username ? (
                  <Text
                    style={{ color: theme.subtext, fontSize: 12 }}
                    numberOfLines={1}
                  >
                    @{user.username}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        style={style}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        numberOfLines={numberOfLines}
        testID={testID}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}
