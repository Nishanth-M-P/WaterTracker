import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { DateRangePicker, PresetRangeType } from '../../components/calendar/DateRangePicker';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { DailyBarChart } from '../../components/charts/DailyBarChart';
import { BottleDistributionChart } from '../../components/charts/BottleDistributionChart';
import { TopCustomersChart } from '../../components/charts/TopCustomersChart';
import { DistributionTrendChart } from '../../components/charts/DistributionTrendChart';
import {
  getSummaryReport,
  getTodayDate,
  getThisMonthRange,
  generateReportCSV,
  generateReportSummaryText,
  getConsolidatedDistributionData,
  ConsolidatedReportData,
} from '../../services/reportingService';
import {
  generateConsolidatedReportPdf,
  viewPdfDocument,
  printPdfDocument,
  sharePdfDocument,
  exportPdfDocument,
  GeneratedPdfResult,
} from '../../services/pdfService';
import { SummaryReport } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function ReportsScreen() {
  const { colors, isDark } = useTheme();

  // Default to Today's Distribution as specified in requirements
  const todayStr = getTodayDate();
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState<PresetRangeType>('today');

  const [report, setReport] = useState<SummaryReport | null>(null);
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedReportData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Tab between Overview, By Customer, By Size, and By Day
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'customer' | 'sizes' | 'daily'>('overview');

  const loadReport = useCallback(async () => {
    try {
      const [data, consData] = await Promise.all([
        getSummaryReport(startDate, endDate),
        getConsolidatedDistributionData(startDate, endDate),
      ]);
      setReport(data);
      setConsolidatedData(consData);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReport();
  };

  const handleRangeChange = (start: string, end: string, preset?: PresetRangeType) => {
    setStartDate(start);
    setEndDate(end);
    if (preset) setActivePreset(preset);
  };

  const handleShareSummary = async () => {
    if (!report) return;
    try {
      const summaryText = generateReportSummaryText(report);
      await Share.share({
        message: summaryText,
        title: `WaterTrack Report (${report.start_date} to ${report.end_date})`,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share summary');
    }
  };

  const handleExportCSV = async () => {
    if (!report) return;
    try {
      const csv = generateReportCSV(report);
      await Share.share({
        message: csv,
        title: `WaterTrack_Report_${report.start_date}_${report.end_date}.csv`,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to export CSV');
    }
  };

  const handlePdfAction = async (action: 'view' | 'print' | 'share' | 'export') => {
    if (!consolidatedData || pdfLoading) return;
    try {
      setPdfLoading(true);
      const pdfResult = await generateConsolidatedReportPdf(consolidatedData);
      switch (action) {
        case 'view':
          viewPdfDocument(pdfResult);
          break;
        case 'print':
          await printPdfDocument(pdfResult);
          break;
        case 'share':
          await sharePdfDocument(pdfResult);
          break;
        case 'export':
          exportPdfDocument(pdfResult);
          break;
      }
    } catch (err: any) {
      Alert.alert('Report Generation Error', err.message || 'Could not generate distribution report PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const hasData = report && report.total_deliveries > 0;

  const reportBannerTitle =
    activePreset === 'today' || (startDate === endDate && startDate === getTodayDate())
      ? "Today's Distribution — Print / Export PDF"
      : activePreset === 'yesterday'
      ? "Yesterday's Distribution — Print / Export PDF"
      : activePreset === 'this_week' || activePreset === 'last_week'
      ? "Weekly Distribution — Print / Export PDF"
      : activePreset === 'this_month' || activePreset === 'last_month'
      ? "Monthly Distribution — Print / Export PDF"
      : "Distribution Report — Print / Export PDF";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title="Reports & Analytics"
        subtitle={`${startDate} to ${endDate}`}
        showSettings
        rightAction={{
          icon: 'share-social-outline',
          onPress: () => handlePdfAction('share'),
        }}
      />

      {/* Date Range Selector */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        activePreset={activePreset}
        onRangeChange={handleRangeChange}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
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
        {/* Consolidated Distribution Report Hero Card */}
        <Card style={styles.pdfHeroCard}>
          <View style={styles.pdfHeroHeader}>
            <View style={styles.pdfHeroTitleRow}>
              <View style={styles.pdfHeroIconCircle}>
                <Ionicons name="document-text" size={20} color="#ffffff" />
              </View>
              <View style={styles.pdfHeroTitleBlock}>
                <Text style={[styles.pdfHeroTitle, { color: colors.text }]}>
                  {reportBannerTitle}
                </Text>
                <Text style={[styles.pdfHeroSubtitle, { color: colors.textSecondary }]}>
                  Chandan Gowda. M. K · Multi-customer accounting · {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={[styles.pdfMetricsBar, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.borderLight }]}>
            <View style={styles.pdfMetricItem}>
              <Text style={[styles.pdfMetricNum, { color: colors.text }]}>
                {consolidatedData?.totalDeliveries || 0}
              </Text>
              <Text style={[styles.pdfMetricLbl, { color: colors.textSecondary }]}>Deliveries</Text>
            </View>
            <View style={styles.pdfMetricItem}>
              <Text style={[styles.pdfMetricNum, { color: colors.text }]}>
                {consolidatedData?.uniqueCustomerCount || 0}
              </Text>
              <Text style={[styles.pdfMetricLbl, { color: colors.textSecondary }]}>Customers</Text>
            </View>
            <View style={styles.pdfMetricItem}>
              <Text style={[styles.pdfMetricNum, { color: colors.text }]}>
                {consolidatedData?.totalBottles || 0}
              </Text>
              <Text style={[styles.pdfMetricLbl, { color: colors.textSecondary }]}>Bottles</Text>
            </View>
            <View style={styles.pdfMetricItem}>
              <Text style={[styles.pdfMetricNum, { color: colors.text }]}>
                {(consolidatedData?.totalVolumeLitres || 0).toFixed(1)} L
              </Text>
              <Text style={[styles.pdfMetricLbl, { color: colors.textSecondary }]}>Volume</Text>
            </View>
            <View style={styles.pdfMetricItem}>
              <Text style={[styles.pdfMetricNum, { color: colors.primary }]}>
                ₹{(consolidatedData?.grandTotalAmount || 0).toFixed(2)}
              </Text>
              <Text style={[styles.pdfMetricLbl, { color: colors.textSecondary }]}>Total</Text>
            </View>
          </View>

          {/* Words Preview */}
          {consolidatedData && consolidatedData.grandTotalAmount > 0 && (
            <View style={styles.wordsPreviewRow}>
              <Ionicons name="cash-outline" size={14} color={colors.primary} />
              <Text style={[styles.wordsPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                {consolidatedData.grandTotalInWords}
              </Text>
            </View>
          )}

          {/* 4 Primary Action Buttons Grid */}
          <View style={styles.pdfActionGrid}>
            <View style={styles.pdfGridCol}>
              <Button
                title={pdfLoading ? 'Loading...' : 'View PDF'}
                icon="eye-outline"
                variant="primary"
                size="md"
                disabled={pdfLoading}
                onPress={() => handlePdfAction('view')}
              />
            </View>
            <View style={styles.pdfGridCol}>
              <Button
                title="Print PDF"
                icon="print-outline"
                variant="outline"
                size="md"
                disabled={pdfLoading}
                onPress={() => handlePdfAction('print')}
              />
            </View>
            <View style={styles.pdfGridCol}>
              <Button
                title="Share PDF"
                icon="share-social-outline"
                variant="outline"
                size="md"
                disabled={pdfLoading}
                onPress={() => handlePdfAction('share')}
              />
            </View>
            <View style={styles.pdfGridCol}>
              <Button
                title="Export PDF"
                icon="download-outline"
                variant="outline"
                size="md"
                disabled={pdfLoading}
                onPress={() => handlePdfAction('export')}
              />
            </View>
          </View>

          {/* Secondary Utilities */}
          <View style={[styles.pdfSecondaryRow, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              onPress={handleExportCSV}
              style={styles.pdfUtilityBtn}
            >
              <Ionicons name="document-text-outline" size={15} color={colors.primary} />
              <Text style={[styles.pdfUtilityText, { color: colors.primary }]}>Export CSV</Text>
            </TouchableOpacity>

            <View style={[styles.pdfUtilDivider, { backgroundColor: colors.borderLight }]} />

            <TouchableOpacity
              onPress={handleShareSummary}
              style={styles.pdfUtilityBtn}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.pdfUtilityText, { color: colors.textSecondary }]}>Share Text Summary</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Metric Summary Cards Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Bottles"
            value={report?.total_bottles || 0}
            subtitle="Units distributed"
            icon="water-outline"
            accentColor="#0284c7"
            style={styles.gridStat}
          />

          <StatCard
            title="Water Volume"
            value={`${(report?.total_volume_litres || 0).toFixed(1)} L`}
            subtitle="Total litres delivered"
            icon="beaker-outline"
            accentColor="#06b6d4"
            style={styles.gridStat}
          />

          <StatCard
            title="Total Deliveries"
            value={report?.total_deliveries || 0}
            subtitle="Completed shipments"
            icon="cube-outline"
            accentColor="#0d9488"
            style={styles.gridStat}
          />

          <StatCard
            title="Total Value"
            value={`₹${(report?.total_amount || 0).toFixed(2)}`}
            subtitle="Revenue / invoice total"
            icon="cash-outline"
            accentColor="#10b981"
            style={styles.gridStat}
          />

          <StatCard
            title="Unique Customers"
            value={report?.unique_customers || 0}
            subtitle="Active accounts"
            icon="people-outline"
            accentColor="#8b5cf6"
            style={styles.gridStat}
          />

          <StatCard
            title="Avg per Delivery"
            value={report?.avg_bottles_per_delivery || 0}
            subtitle="Bottles per drop"
            icon="calculator-outline"
            accentColor="#f59e0b"
            style={styles.gridStat}
          />
        </View>

        {/* Sub-view Tab Switcher */}
        <View
          style={[
            styles.subTabRow,
            { backgroundColor: isDark ? '#334155' : colors.inputBg },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveSubTab('overview')}
            style={[
              styles.subTabBtn,
              activeSubTab === 'overview' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeSubTab === 'overview' ? colors.primary : colors.textSecondary,
                  fontWeight: activeSubTab === 'overview' ? '700' : '500',
                },
              ]}
            >
              Overview & Charts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSubTab('sizes')}
            style={[
              styles.subTabBtn,
              activeSubTab === 'sizes' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeSubTab === 'sizes' ? colors.primary : colors.textSecondary,
                  fontWeight: activeSubTab === 'sizes' ? '700' : '500',
                },
              ]}
            >
              Bottle Sizes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSubTab('customer')}
            style={[
              styles.subTabBtn,
              activeSubTab === 'customer' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeSubTab === 'customer' ? colors.primary : colors.textSecondary,
                  fontWeight: activeSubTab === 'customer' ? '700' : '500',
                },
              ]}
            >
              Customers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSubTab('daily')}
            style={[
              styles.subTabBtn,
              activeSubTab === 'daily' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeSubTab === 'daily' ? colors.primary : colors.textSecondary,
                  fontWeight: activeSubTab === 'daily' ? '700' : '500',
                },
              ]}
            >
              Daily
            </Text>
          </TouchableOpacity>
        </View>

        {!hasData ? (
          <Card>
            <EmptyState
              icon="bar-chart-outline"
              title="No data for selected period"
              description="There are no delivery records in the chosen date range to compute analytics."
            />
          </Card>
        ) : (
          <>
            {/* OVERVIEW SUB-TAB: ALL 4 CHARTS */}
            {activeSubTab === 'overview' && (
              <View style={styles.tabContentGroup}>
                {/* 1. Daily Distribution Bar Chart */}
                <Card style={styles.chartCard}>
                  <View style={styles.chartTitleRow}>
                    <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Daily Distribution Bar Chart
                    </Text>
                  </View>
                  <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                    Bottles delivered per day across the selected range
                  </Text>
                  <DailyBarChart data={report.daily_breakdown} />
                </Card>

                {/* 2. Bottle-Size Distribution Chart */}
                <Card style={styles.chartCard}>
                  <View style={styles.chartTitleRow}>
                    <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Bottle-Size Breakdown
                    </Text>
                  </View>
                  <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                    Volume distribution by jar and bottle size
                  </Text>
                  <BottleDistributionChart data={report.bottle_size_breakdown} />
                </Card>

                {/* 3. Top Customers Chart */}
                <Card style={styles.chartCard}>
                  <View style={styles.chartTitleRow}>
                    <Ionicons name="trophy-outline" size={18} color={colors.primary} />
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Top Customers by Quantity
                    </Text>
                  </View>
                  <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                    Highest volume clients during this period
                  </Text>
                  <TopCustomersChart data={report.customer_breakdown} limit={5} />
                </Card>

                {/* 4. Distribution Trend Chart */}
                <Card style={styles.chartCard}>
                  <View style={styles.chartTitleRow}>
                    <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Distribution Trend
                    </Text>
                  </View>
                  <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                    Volume progression over the selected timeframe
                  </Text>
                  <DistributionTrendChart data={report.daily_breakdown} />
                </Card>
              </View>
            )}

            {/* BOTTLE SIZES SUB-TAB */}
            {activeSubTab === 'sizes' && (
              <View style={styles.tabContentGroup}>
                <Card style={styles.chartCard}>
                  <BottleDistributionChart data={report.bottle_size_breakdown} />
                </Card>

                <Card>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Detailed Bottle Breakdown
                  </Text>
                  {report.bottle_size_breakdown.map((item) => (
                    <View
                      key={item.bottle_size_id}
                      style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                    >
                      <View>
                        <Text style={[styles.tableRowTitle, { color: colors.text }]}>
                          {item.bottle_size_name}
                        </Text>
                        <Text style={[styles.tableRowSub, { color: colors.textSecondary }]}>
                          Product ID #{item.bottle_size_id}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.tableRowValue, { color: colors.primary }]}>
                          {item.total_quantity} bottles
                        </Text>
                        {item.total_amount > 0 && (
                          <Text style={[styles.tableRowSub, { color: colors.textMuted }]}>
                            ₹{item.total_amount.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {/* CUSTOMERS SUB-TAB */}
            {activeSubTab === 'customer' && (
              <View style={styles.tabContentGroup}>
                <Card style={styles.chartCard}>
                  <TopCustomersChart data={report.customer_breakdown} limit={10} />
                </Card>

                <Card>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Customer Distribution List
                  </Text>
                  {report.customer_breakdown.map((cust) => (
                    <View
                      key={cust.customer_id}
                      style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.tableRowTitle, { color: colors.text }]} numberOfLines={1}>
                          {cust.customer_name}
                        </Text>
                        <Text style={[styles.tableRowSub, { color: colors.textSecondary }]}>
                          {cust.customer_type} • {cust.total_deliveries} deliveries
                        </Text>
                      </View>
                      <Text style={[styles.tableRowValue, { color: colors.primary }]}>
                        {cust.total_bottles} bottles
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {/* DAILY SUB-TAB */}
            {activeSubTab === 'daily' && (
              <View style={styles.tabContentGroup}>
                <Card style={styles.chartCard}>
                  <DailyBarChart data={report.daily_breakdown} />
                </Card>

                <Card>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Daily Breakdown Log
                  </Text>
                  {report.daily_breakdown.map((day) => (
                    <View
                      key={day.date}
                      style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                    >
                      <View>
                        <Text style={[styles.tableRowTitle, { color: colors.text }]}>
                          {day.date}
                        </Text>
                        <Text style={[styles.tableRowSub, { color: colors.textSecondary }]}>
                          {day.day_label} • {day.delivery_count} {day.delivery_count === 1 ? 'delivery' : 'deliveries'}
                        </Text>
                      </View>
                      <Text style={[styles.tableRowValue, { color: colors.primary }]}>
                        {day.total_bottles} bottles
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}
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
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridStat: {
    width: '48%',
  },
  subTabRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabText: {
    fontSize: 12,
  },
  tabContentGroup: {
    gap: 16,
  },
  chartCard: {
    padding: 16,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tableRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tableRowValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  pdfHeroCard: {
    padding: 16,
    gap: 14,
  },
  pdfHeroHeader: {
    marginBottom: 2,
  },
  pdfHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pdfHeroIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfHeroTitleBlock: {
    flex: 1,
  },
  pdfHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  pdfHeroSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  pdfMetricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pdfMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  pdfMetricNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  pdfMetricLbl: {
    fontSize: 9.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  wordsPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  wordsPreviewText: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  pdfActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdfGridCol: {
    width: '48.5%',
  },
  pdfSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  pdfUtilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  pdfUtilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pdfUtilDivider: {
    width: 1,
    height: 16,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  exportCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  exportCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
});
