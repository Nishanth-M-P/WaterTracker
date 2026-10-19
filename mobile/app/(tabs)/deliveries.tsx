import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { PresetRangeType } from '../../components/calendar/DateRangePicker';
import { DeliveryReportToolbar } from '../../components/delivery/DeliveryReportToolbar';
import { DeliverySummaryCards } from '../../components/delivery/DeliverySummaryCards';
import { PdfPreviewModal } from '../../components/delivery/PdfPreviewModal';
import { DeliveryItemCard } from '../../components/delivery/DeliveryItemCard';
import { EmptyState } from '../../components/common/EmptyState';
import { getDeliveries, deleteDelivery } from '../../services/deliveryService';
import { confirmAction, showAlert } from '../../utils/dialog';
import { formatCustomerName } from '../../utils/formatters';
import {
  getTodayDate,
  getConsolidatedReportData,
  ConsolidatedReportData,
} from '../../services/reportingService';
import {
  generateConsolidatedReportPdf,
  printPdfDocument,
  sharePdfDocument,
  GeneratedPdfResult,
} from '../../services/pdfService';
import { exportConsolidatedReportCsv } from '../../services/csvService';
import { CustomerType, Delivery } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function DeliveriesScreen() {
  const { colors, isDark } = useTheme();

  // Filters state (Default selection: Today as required)
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activePreset, setActivePreset] = useState<PresetRangeType>('today');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Consolidated PDF & Report state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [reportData, setReportData] = useState<ConsolidatedReportData | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const loadDeliveries = useCallback(async () => {
    try {
      const list = await getDeliveries({
        startDate,
        endDate,
        customerQuery,
        customerType,
        sort: sortOrder,
      });
      setDeliveries(list);
    } catch (err) {
      console.error('Failed to load deliveries', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, customerQuery, customerType, sortOrder]);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDeliveries();
  };

  const handleRangeChange = (start: string, end: string, preset?: PresetRangeType) => {
    setStartDate(start);
    setEndDate(end);
    if (preset) setActivePreset(preset);
  };

  /**
   * Helper to fetch and generate consolidated statement data
   */
  const ensureReportGenerated = async (): Promise<{
    data: ConsolidatedReportData;
    pdf: GeneratedPdfResult;
  }> => {
    const data = await getConsolidatedReportData(startDate, endDate, activePreset);
    const pdf = await generateConsolidatedReportPdf(data, activePreset);
    setReportData(data);
    setPdfResult(pdf);
    return { data, pdf };
  };

  /**
   * 1. Preview PDF: opens full-screen interactive preview modal
   */
  const handlePreviewPdf = async () => {
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for the selected period to preview.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsGeneratingReport(true);
      await ensureReportGenerated();
      setPreviewModalVisible(true);
    } catch (err: any) {
      Alert.alert('Report Generation Error', err.message || 'Failed to compile statement preview');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * 2. Print: prints consolidated statement directly to printer
   */
  const handlePrint = async () => {
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for the selected period to print.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsGeneratingReport(true);
      const { pdf } = await ensureReportGenerated();
      await printPdfDocument(pdf);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Failed to print distribution statement');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * 3. Export / Share PDF: native share sheet on mobile, download on web
   */
  const handleSharePdf = async () => {
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for the selected period to share.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsGeneratingReport(true);
      const { pdf } = await ensureReportGenerated();
      await sharePdfDocument(pdf);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share distribution statement');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * 4. Export CSV: exports RFC 4180 CSV spreadsheet
   */
  const handleExportCsv = async () => {
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for the selected period to export as CSV.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsGeneratingReport(true);
      const data = await getConsolidatedReportData(startDate, endDate, activePreset);
      setReportData(data);
      await exportConsolidatedReportCsv(data, activePreset);
    } catch (err: any) {
      Alert.alert('CSV Export Error', err.message || 'Failed to export CSV report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDelete = (delivery: Delivery) => {
    const custName = formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`);
    confirmAction({
      title: 'Delete Delivery',
      message: `Are you sure you want to delete Delivery #${delivery.id} for "${custName}"? This will permanently remove its ${delivery.total_bottles} bottles from business totals.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDelivery(delivery.id);
          loadDeliveries();
          showAlert('Delivery Deleted', `Delivery #${delivery.id} has been removed.`);
        } catch (err: any) {
          showAlert('Error', err?.message || 'Failed to delete delivery');
        }
      },
    });
  };

  // High-level summary metrics for the selected period (Requirement 8)
  const totalPeriodBottles = deliveries.reduce((acc, d) => acc + (d.total_bottles || 0), 0);
  const totalPeriodDeliveries = deliveries.length;
  const uniqueCustomersCount = new Set(deliveries.map((d) => d.customer_id)).size;
  const totalPeriodAmount = deliveries.reduce((acc, d) => acc + (d.total_amount || 0), 0);

  const customerTypes: { label: string; value: CustomerType | undefined }[] = [
    { label: 'All Types', value: undefined },
    { label: 'Hotels', value: 'Hotel' },
    { label: 'Shops', value: 'Shop' },
    { label: 'Offices', value: 'Office' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title="Deliveries"
        subtitle={`${deliveries.length} records • ${totalPeriodBottles} bottles`}
        showSettings
        rightAction={{
          icon: 'add-circle',
          onPress: () => router.push('/delivery/new'),
        }}
      />

      {/* Deliveries List with Full-Page Scroll (Toolbar, Cards, Filters in Header) */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderWrapper}>
            {/* 1. Official Report Toolbar with Presets & Navigation */}
            <DeliveryReportToolbar
              startDate={startDate}
              endDate={endDate}
              activePreset={activePreset}
              onRangeChange={handleRangeChange}
              onPreviewPdf={handlePreviewPdf}
              onPrint={handlePrint}
              onSharePdf={handleSharePdf}
              onExportCsv={handleExportCsv}
              isGenerating={isGeneratingReport}
              recordCount={deliveries.length}
            />

            {/* 2. Summary Cards for Selected Period (Requirement 8) */}
            <DeliverySummaryCards
              totalBottles={totalPeriodBottles}
              totalDeliveries={totalPeriodDeliveries}
              uniqueCustomers={uniqueCustomersCount}
              totalAmount={totalPeriodAmount}
            />

            {/* 3. Search & Filter Bar */}
            <View style={styles.filterSection}>
              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  id="deliveries-tab-search-input"
                  nativeID="deliveries-tab-search-input"
                  aria-label="Search customer or location"
                  autoComplete="off"
                  placeholder="Search customer or location..."
                  placeholderTextColor={colors.textMuted}
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {customerQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCustomerQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Customer Type Filter Chips & Sort Toggle */}
              <View style={styles.chipsAndSortRow}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={customerTypes}
                  keyExtractor={(item) => item.label}
                  contentContainerStyle={styles.typeChipsContainer}
                  renderItem={({ item }) => {
                    const active = customerType === item.value;
                    return (
                      <TouchableOpacity
                        onPress={() => setCustomerType(item.value)}
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

                {/* Sort order toggle button */}
                <TouchableOpacity
                  onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                  style={[
                    styles.sortBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={[styles.sortText, { color: colors.text }]}>
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <DeliveryItemCard
              delivery={item}
              onPress={() => router.push(`/delivery/${item.id}`)}
              onEdit={() => router.push(`/delivery/edit?id=${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="cube-outline"
              title="No deliveries found"
              description={
                customerQuery || customerType
                  ? 'Try adjusting your search or category filters.'
                  : 'No water deliveries recorded for the selected date period.'
              }
              actionTitle="Record Delivery"
              onAction={() => router.push('/delivery/new')}
            />
          </View>
        }
      />

      {/* 5. Full-Screen Interactive PDF Preview Modal */}
      <PdfPreviewModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        reportData={reportData}
        pdfResult={pdfResult}
        onPrint={handlePrint}
        onShare={handleSharePdf}
        onExportCsv={handleExportCsv}
        isLoading={isGeneratingReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  chipsAndSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeChipsContainer: {
    gap: 6,
    paddingRight: 8,
  },
  typeChip: {
    paddingHorizontal: 10,
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
    paddingBottom: 100,
  },
  listHeaderWrapper: {
    paddingBottom: 4,
  },
  cardWrapper: {
    paddingHorizontal: 16,
  },
  emptyWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
