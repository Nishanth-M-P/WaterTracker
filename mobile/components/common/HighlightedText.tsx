import React from 'react';
import { Text, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface HighlightedTextProps {
  text: string;
  highlight?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlight,
  style,
  numberOfLines,
}) => {
  const { isDark } = useTheme();

  if (!highlight || !highlight.trim() || !text) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const query = highlight.trim();
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <Text
            key={index}
            style={[
              style,
              styles.highlight,
              {
                backgroundColor: isDark ? '#1e3a8a' : '#bfdbfe',
                color: isDark ? '#93c5fd' : '#1d4ed8',
                fontWeight: '700',
              },
            ]}
          >
            {part}
          </Text>
        ) : (
          <Text key={index} style={style}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  highlight: {
    borderRadius: 3,
    paddingHorizontal: 2,
  },
});
