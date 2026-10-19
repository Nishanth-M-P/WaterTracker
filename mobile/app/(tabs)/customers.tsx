import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { CustomerCard } from '../../components/customer/CustomerCard';
import { EmptyState } from '../../components/common/EmptyState';
import { getCustomers } from '../../services/customerService';
import { CustomerType, CustomerWithStats } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function CustomersScreen() {
  const { colors, isDark } = useTheme();

  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CustomerType | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'alpha' | 'recent'>('alpha');
  const [showArchived, setShowArchived] = useState(false);

  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    try {
      const list = await getCustomers({
        query,
        type: selectedType,
        sort: sortOrder,
        includeArchived: showArchived,
      });
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, selectedType, sortOrder, showArchived]);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  const customerTypes: { label: string; value: CustomerType | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Hotels', value: 'Hotel' },
    { label: 'Shops', value: 'Shop' },
    { label: 'Offices', value: 'Office' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title="Customers"
        subtitle={`${customers.length} registered clients`}
        showSettings
        rightAction={{
          icon: 'person-add',
          onPress: () => router.push('/customer/new'),
        }}
      />

      {/* Search & Filter Bar */}
      <View style={styles.topFilterBar}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            id="customers-tab-search-input"
            nativeID="customers-tab-search-input"
            aria-label="Search by name, address, or phone"
            autoComplete="off"
            placeholder="Search by name, address, or phone..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Type Filter Chips & Controls */}
        <View style={styles.controlsRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={customerTypes}
            keyExtractor={(item) => item.label}
            contentContainerStyle={styles.typeChipsContainer}
            renderItem={({ item }) => {
              const active = selectedType === item.value;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedType(item.value)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? colors.primary : isDark ? '#334155' : colors.inputBg,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      {
                        color: active ? '#ffffff' : colors.textSecondary,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Sort Alphabetical / Recent Delivery Toggle */}
          <TouchableOpacity
            onPress={() => setSortOrder(sortOrder === 'alpha' ? 'recent' : 'alpha')}
            style={[
              styles.sortBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={sortOrder === 'alpha' ? 'text-outline' : 'time-outline'}
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.sortText, { color: colors.text }]}>
              {sortOrder === 'alpha' ? 'A-Z' : 'Recent'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customers List */}
      <FlatList
        data={customers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onPress={() => router.push(`/customer/${item.id}`)}
            onEdit={() => router.push(`/customer/edit?id=${item.id}`)}
            onAddDelivery={() => router.push(`/delivery/new?customerId=${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No customers found"
            description={
              query || selectedType
                ? 'Try adjusting your search query or customer category.'
                : 'No clients registered yet. Register your first hotel, shop, or office.'
            }
            actionTitle="Add New Customer"
            onAction={() => router.push('/customer/new')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topFilterBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeChipsContainer: {
    gap: 6,
    paddingRight: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipText: {
    fontSize: 12,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  sortText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
