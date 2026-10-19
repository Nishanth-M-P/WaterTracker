import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface CustomerSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
  loading?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const CustomerSearchBar: React.FC<CustomerSearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search hotel, shop or customer...',
  loading = false,
  onFocus,
  onBlur,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1e293b' : colors.surface,
          borderColor: value.length > 0 ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={value.length > 0 ? colors.primary : colors.textSecondary}
        style={styles.searchIcon}
      />
      <TextInput
        id="dashboard-customer-search-input"
        nativeID="dashboard-customer-search-input"
        aria-label="Search Customers"
        autoComplete="off"
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.clearBtn} />
      ) : value.length > 0 ? (
        <TouchableOpacity
          onPress={onClear}
          style={styles.clearBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Clear search input"
        >
          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },
});
