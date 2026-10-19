import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { StatCard } from '../../components/common/StatCard';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { DeliveryItemCard } from '../../components/delivery/DeliveryItemCard';
import { BottleDistributionChart } from '../../components/charts/BottleDistributionChart';
import { DailyBarChart } from '../../components/charts/DailyBarChart';
import { CustomerSearchBar } from '../../components/dashboard/CustomerSearchBar';
import { CustomerSearchResultCard } from '../../components/dashboard/CustomerSearchResultCard';
import { getDashboardMetrics, getTodayDate } from '../../services/reportingService';
import { searchActiveCustomers } from '../../services/customerService';
import { DashboardMetrics, CustomerWithStats } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{
    deliverySaved?: string;
    customerName?: string;
    bottles?: string;
  }>();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Delivery saved notification toast banner state
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Customer search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithStats[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Listen for redirected delivery success params
  useEffect(() => {
    if (params.deliverySaved === '1') {
      const cName = params.customerName || 'Customer';
      const bCount = params.bottles || 'bottles';
      setToastMessage({
        title: 'Delivery Saved Successfully!',
        message: `Delivery of ${bCount} bottles for ${cName} has been recorded.`,
      });
      // Clear search when returning from delivery so clean dashboard is displayed
      setSearchQuery('');
      setSearchResults([]);
      loadData();

      router.setParams({ deliverySaved: undefined, customerName: undefined, bottles: undefined });

      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [params.deliverySaved, params.customerName, params.bottles, loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Debounced search query against SQLite customer records
  useEffect(() => {
    let isMounted = true;
    const queryTrimmed = searchQuery.trim();

    if (!queryTrimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchActiveCustomers(queryTrimmed, 30);
        if (isMounted) {
          setSearchResults(results);
        }
      } catch (err) {
        console.error('Failed to search customers', err);
      } finally {
        if (isMounted) {
          setSearchLoading(false);
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectForDelivery = (customer: CustomerWithStats) => {
    router.push({
      pathname: '/delivery/new',
      params: { customerId: customer.id.toString() },
    });
  };

  const handleViewProfile = (customer: CustomerWithStats) => {
    router.push(`/customer/${customer.id}`);
  };

  const formattedTodayDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        subtitle={formattedTodayDate}
        showSettings
      />

      {/* Delivery Saved Success Toast Banner */}
      {toastMessage && (
        <View
          style={[
            styles.toastBanner,
            {
              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
              borderColor: '#10b981',
            },
          ]}
        >
          <View style={styles.toastLeft}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.toastTitle, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                {toastMessage.title}
              </Text>
              <Text style={[styles.toastSubtitle, { color: isDark ? '#d1fae5' : '#047857' }]}>
                {toastMessage.message}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setToastMessage(null)} style={styles.toastCloseBtn}>
            <Ionicons name="close" size={18} color={isDark ? '#a7f3d0' : '#065f46'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Prominent Customer Search Bar directly below Header */}
      <View
        style={[
          styles.searchBarWrapper,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <CustomerSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={handleClearSearch}
          loading={searchLoading}
          placeholder="Search hotel, shop or customer..."
        />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isSearching ? (
          /* Search Results Section */
          <View style={styles.searchResultsSection}>
            <View style={styles.searchResultsHeaderRow}>
              <View>
                <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
                  {searchLoading
                    ? 'Searching...'
                    : `${searchResults.length} ${
                        searchResults.length === 1 ? 'Customer' : 'Customers'
                      } Found`}
                </Text>
                <Text style={[styles.searchResultsSubtitle, { color: colors.textSecondary }]}>
                  Tap a customer to record delivery directly
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleClearSearch}
                style={[
                  styles.closeSearchBtn,
                  {
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
                <Text style={[styles.closeSearchText, { color: colors.textSecondary }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 ? (
              searchResults.map((cust) => (
                <CustomerSearchResultCard
                  key={cust.id}
                  customer={cust}
                  searchQuery={searchQuery}
                  onSelectForDelivery={handleSelectForDelivery}
                  onViewProfile={handleViewProfile}
                />
              ))
            ) : !searchLoading ? (
              <Card style={styles.emptyCard}>
                <EmptyState
                  icon="search-outline"
                  title="No customers found."
                  description={`No hotel, shop or customer matches "${searchQuery.trim()}". You can register them as a new customer.`}
                  actionTitle="Register New Customer"
                  onAction={() => router.push('/customer/new')}
                />
              </Card>
            ) : null}
          </View>
        ) : (
          /* Normal Dashboard Layout */
          <>
            {/* Today's Distribution Banner */}
            <Card
              style={[
                styles.todayBanner,
                {
                  backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={styles.todayBannerRow}>
                <View style={styles.todayBannerLeft}>
                  <Text style={[styles.todayBannerLabel, { color: colors.primaryDark }]}>
                    TODAY'S DISTRIBUTION
                  </Text>
                  <Text style={[styles.todayBottlesCount, { color: colors.text }]}>
                    {metrics?.today_bottles || 0}
                    <Text style={[styles.todayBottlesUnit, { color: colors.textSecondary }]}>
                      {' '}bottles
                    </Text>
                  </Text>
                  <Text style={[styles.todaySubtext, { color: colors.textSecondary }]}>
                    {metrics?.today_deliveries || 0} deliveries across {metrics?.today_unique_customers || 0} customer(s)
                    {metrics?.today_volume_litres !== undefined && ` • ${metrics.today_volume_litres.toFixed(1)} L`}
                    {metrics?.today_amount !== undefined && metrics.today_amount > 0 ? ` • ₹${metrics.today_amount.toFixed(2)}` : ''}
                  </Text>
                </View>

                <View style={[styles.todayWaterIconCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="water" size={32} color="#ffffff" />
                </View>
              </View>
            </Card>

            {/* 4 Summary Stat Cards Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Today Deliveries"
                value={metrics?.today_deliveries || 0}
                subtitle="Completed today"
                icon="checkbox-outline"
                accentColor="#0284c7"
                style={styles.gridStat}
              />

              <StatCard
                title="Customers Today"
                value={metrics?.today_unique_customers || 0}
                subtitle="Served today"
                icon="people-outline"
                accentColor="#0d9488"
                style={styles.gridStat}
              />

              <StatCard
                title="This Week"
                value={metrics?.week_bottles || 0}
                subtitle="Total bottles"
                icon="calendar-outline"
                accentColor="#8b5cf6"
                style={styles.gridStat}
              />

              <StatCard
                title="This Month"
                value={metrics?.month_bottles || 0}
                subtitle="Total bottles"
                icon="trending-up-outline"
                accentColor="#f59e0b"
                style={styles.gridStat}
              />
            </View>

            {/* Secondary Quick Navigation Bar */}
            <View style={styles.quickNavRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/deliveries')}
                style={[
                  styles.quickNavBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="list-outline" size={18} color={colors.primary} />
                <Text style={[styles.quickNavText, { color: colors.text }]}>
                  View Today's Deliveries
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/reports')}
                style={[
                  styles.quickNavBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
                <Text style={[styles.quickNavText, { color: colors.text }]}>
                  View Reports & Analytics
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Today's Bottle-size Breakdown */}
            {metrics && metrics.today_bottle_sizes.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Today's Bottle Sizes
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    Breakdown by bottle volume
                  </Text>
                </View>
                <Card>
                  <BottleDistributionChart data={metrics.today_bottle_sizes} />
                </Card>
              </View>
            )}

            {/* Weekly Activity Bar Chart */}
            {metrics &&
              metrics.weekly_distribution &&
              metrics.weekly_distribution.some((d) => d.total_bottles > 0) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        This Week's Activity
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                        Daily bottle deliveries (Mon – Sun)
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/reports')}>
                      <Text style={[styles.viewAllText, { color: colors.primary }]}>Full Report</Text>
                    </TouchableOpacity>
                  </View>
                  <Card style={{ padding: 14 }}>
                    <DailyBarChart data={metrics.weekly_distribution} height={175} />
                  </Card>
                </View>
              )}

            {/* Recent Deliveries */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Recent Deliveries
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    Latest recorded water shipments
                  </Text>
                </View>

                {metrics && metrics.recent_deliveries.length > 0 && (
                  <TouchableOpacity onPress={() => router.push('/deliveries')}>
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {metrics && metrics.recent_deliveries.length > 0 ? (
                metrics.recent_deliveries.map((delivery) => (
                  <DeliveryItemCard
                    key={delivery.id}
                    delivery={delivery}
                    onPress={() => router.push(`/delivery/${delivery.id}`)}
                  />
                ))
              ) : (
                <Card>
                  <EmptyState
                    icon="water-outline"
                    title="No deliveries recorded yet"
                    description="Search for a hotel or shop above to record your first delivery."
                  />
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  searchResultsSection: {
    gap: 10,
  },
  searchResultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchResultsSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  closeSearchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 16,
  },
  todayBanner: {
    padding: 16,
    borderRadius: 16,
  },
  todayBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayBannerLeft: {
    flex: 1,
  },
  todayBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  todayBottlesCount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  todayBottlesUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  todaySubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  todayWaterIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridStat: {
    width: '48%',
  },
  quickNavRow: {
    gap: 8,
  },
  quickNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickNavText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toastBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  toastSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toastCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
