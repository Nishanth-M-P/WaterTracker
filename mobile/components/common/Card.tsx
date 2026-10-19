import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, variant = 'elevated' }) => {
  const { colors, isDark } = useTheme();

  const getBorderColor = () => {
    if (variant === 'outlined') return colors.border;
    return isDark ? colors.border : '#eef2f6';
  };

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderColor: getBorderColor(),
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: isDark ? '#000000' : '#64748b',
    shadowOffset: { width: 0, height: variant === 'elevated' ? 2 : 0 },
    shadowOpacity: variant === 'elevated' ? (isDark ? 0.3 : 0.06) : 0,
    shadowRadius: 6,
    elevation: variant === 'elevated' ? 2 : 0,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
