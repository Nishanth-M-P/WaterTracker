import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  size = 'md',
}) => {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    let bg = colors.primary;
    let border = 'transparent';

    switch (variant) {
      case 'primary':
        bg = colors.primary;
        break;
      case 'secondary':
        bg = isDark ? '#334155' : colors.primaryLight;
        break;
      case 'outline':
        bg = 'transparent';
        border = colors.border;
        break;
      case 'destructive':
        bg = colors.danger;
        break;
      case 'ghost':
        bg = 'transparent';
        break;
    }

    if (disabled) {
      bg = isDark ? '#334155' : '#cbd5e1';
      border = 'transparent';
    }

    const minHeight = size === 'sm' ? 38 : size === 'lg' ? 54 : 48;
    const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 18;

    return {
      backgroundColor: bg,
      borderColor: border,
      borderWidth: variant === 'outline' ? 1.5 : 0,
      minHeight,
      paddingHorizontal,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.6 : 1,
    };
  };

  const getTextColor = (): string => {
    if (disabled) return isDark ? '#94a3b8' : '#64748b';

    switch (variant) {
      case 'primary':
      case 'destructive':
        return '#ffffff';
      case 'secondary':
        return isDark ? '#ffffff' : colors.primaryDark;
      case 'outline':
        return colors.text;
      case 'ghost':
        return colors.primary;
      default:
        return '#ffffff';
    }
  };

  const iconColor = getTextColor();
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              styles.textBase,
              {
                color: getTextColor(),
                fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 15,
                fontWeight: size === 'lg' ? '700' : '600',
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: {
    letterSpacing: 0.2,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});
