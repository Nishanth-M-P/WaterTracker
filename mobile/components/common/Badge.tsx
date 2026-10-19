import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CustomerType } from '../../types/database';
import { useTheme } from '../../context/ThemeContext';

interface BadgeProps {
  label: string;
  type?: CustomerType | 'active' | 'inactive' | 'info' | 'warning';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, type = 'info', size = 'sm' }) => {
  const { colors, isDark } = useTheme();

  const getColors = () => {
    switch (type) {
      case 'Hotel':
        return {
          bg: isDark ? '#1e1b4b' : '#ede9fe',
          text: isDark ? '#c4b5fd' : '#6d28d9',
        };
      case 'Shop':
        return {
          bg: isDark ? '#064e3b' : '#dcfce7',
          text: isDark ? '#6ee7b7' : '#15803d',
        };
      case 'Office':
        return {
          bg: isDark ? '#431407' : '#ffedd5',
          text: isDark ? '#fdba74' : '#c2410c',
        };
      case 'active':
        return {
          bg: colors.successLight,
          text: colors.success,
        };
      case 'inactive':
        return {
          bg: isDark ? '#334155' : '#f1f5f9',
          text: colors.textMuted,
        };
      case 'warning':
        return {
          bg: isDark ? '#451a03' : '#fef3c7',
          text: isDark ? '#fde68a' : '#b45309',
        };
      case 'Other':
      default:
        return {
          bg: isDark ? '#334155' : '#e2e8f0',
          text: colors.textSecondary,
        };
    }
  };

  const badgeColor = getColors();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeColor.bg },
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: badgeColor.text },
          size === 'sm' ? styles.textSm : styles.textMd,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
  textMd: {
    fontSize: 13,
  },
});
