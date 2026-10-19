import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSettings?: boolean;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label?: string;
  };
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  showSettings = false,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16),
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? '#334155' : colors.inputBg },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          )}

          {!showBack && !title && (
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.logoCircle,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Ionicons name="water" size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: colors.text }]}>WaterTrack</Text>
                {subtitle && (
                  <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>
          )}

          {title && (
            <View style={[styles.titleGroup, showBack && { marginLeft: 12 }]}>
              <Text style={[styles.screenTitle, { color: colors.text }]}>{title}</Text>
              {subtitle && (
                <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.rightGroup}>
          {rightAction && (
            <TouchableOpacity
              onPress={rightAction.onPress}
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? '#334155' : colors.inputBg },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightAction.icon} size={20} color={colors.text} />
            </TouchableOpacity>
          )}

          {showSettings && (
            <TouchableOpacity
              onPress={handleSettings}
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? '#334155' : colors.inputBg, marginLeft: 8 },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  titleGroup: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
