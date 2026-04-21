import React from 'react';
import { Text, TextStyle } from 'react-native';

export function renderTextWithMentions(
  text: string,
  onPressMention: (username: string) => void,
  baseStyle: TextStyle,
  mentionStyle?: TextStyle
): React.ReactNode {
  const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={lastIndex} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }
    const username = match[1];
    parts.push(
      <Text
        key={match.index}
        style={[baseStyle, { color: '#00CF35', fontWeight: '600' }, mentionStyle]}
        onPress={() => onPressMention(username)}
      >
        @{username}
      </Text>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key={lastIndex} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : <Text style={baseStyle}>{text}</Text>;
}
