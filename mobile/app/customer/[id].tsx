import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/StatCard';
import { DeliveryItemCard } from '../../components/delivery/DeliveryItemCard';
import { CustomerStatementModal } from '../../components/customer/CustomerStatementModal';
import {
  getCustomerById,
  getCustomerDeliveries,
  getCustomerBottleTotals,
  deleteCustomerSafe,
  archiveCustomer,
  unarchiveCustomer,
  getCustomerProductRates,
  setCustomerProductRate,
  deleteCustomerProductRate,
} from '../../services/customerService';
import { confirmAction, showAlert } from '../../utils/dialog';
import { getBottleSizes } from '../../services/bottleSizeService';
import {
  getCustomerStatementData,
  CustomerStatementData,
  getTodayDate,
  getYesterdayDate,
  getDayBeforeYesterdayDate,
  getThisWeekRange,
  getThisMonthRange,
  formatDisplayDate,
  formatLocalDate,
  parseLocalDate,
} from '../../services/reportingService';
import {
  generateCustomerStatementPdf,
  printPdfDocument,
  sharePdfDocument,
  GeneratedPdfResult,
} from '../../services/pdfService';
import { CustomerWithStats, Delivery, BottleSizeSummary, CustomerProductRate, BottleSize } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';
import { isPlaceholderCustomerName, formatCustomerName } from '../../utils/formatters';

type StatementPreset = 'all_time' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export default function CustomerDetailsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();

  const [customer, setCustomer] = useState<CustomerWithStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [bottleTotals, setBottleTotals] = useState<BottleSizeSummary[]>([]);
  const [customerRates, setCustomerRates] = useState<CustomerProductRate[]>([]);
  const [allBottleSizes, setAllBottleSizes] = useState<BottleSize[]>([]);
  const [loading, setLoading] = useState(true);

  // Statement Period Filter State
  const [statementPreset, setStatementPreset] = useState<StatementPreset>('all_time');
  const [customStart, setCustomStart] = useState<string>(() => getThisMonthRange().start);
  const [customEnd, setCustomEnd] = useState<string>(() => getTodayDate());
  const [customCalendarVisible, setCustomCalendarVisible] = useState(false);

  // Statement Modal & PDF State
  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [statementData, setStatementData] = useState<CustomerStatementData | null>(null);
  const [statementPdfResult, setStatementPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Calendar view state for custom range picker
  const [calViewDate, setCalViewDate] = useState(() => parseLocalDate(customStart || getTodayDate()));
  const [calTempStart, setCalTempStart] = useState<string>(customStart);
  const [calTempEnd, setCalTempEnd] = useState<string>(customEnd);

  // Rate edit modal state
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [selectedBottleForRate, setSelectedBottleForRate] = useState<BottleSize | null>(null);
  const [inputRate, setInputRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getCustomerById(Number(id));
      setCustomer(c);

      let dList: Delivery[] = [];
      let bTotals: BottleSizeSummary[] = [];

      if (statementPreset === 'all_time') {
        dList = await getCustomerDeliveries(Number(id));
        bTotals = await getCustomerBottleTotals(Number(id));
      } else if (statementPreset === 'today') {
        const today = getTodayDate();
        dList = await getCustomerDeliveries(Number(id), today, today);
        bTotals = await getCustomerBottleTotals(Number(id), today, today);
      } else if (statementPreset === 'yesterday') {
        const yest = getYesterdayDate();
        dList = await getCustomerDeliveries(Number(id), yest, yest);
        bTotals = await getCustomerBottleTotals(Number(id), yest, yest);
      } else if (statementPreset === 'this_week') {
        const w = getThisWeekRange('monday');
        dList = await getCustomerDeliveries(Number(id), w.start, w.end);
        bTotals = await getCustomerBottleTotals(Number(id), w.start, w.end);
      } else if (statementPreset === 'this_month') {
        const m = getThisMonthRange();
        dList = await getCustomerDeliveries(Number(id), m.start, m.end);
        bTotals = await getCustomerBottleTotals(Number(id), m.start, m.end);
      } else if (statementPreset === 'custom') {
        dList = await getCustomerDeliveries(Number(id), customStart, customEnd);
        bTotals = await getCustomerBottleTotals(Number(id), customStart, customEnd);
      }

      setDeliveries(dList);
      setBottleTotals(bTotals);

      const rates = await getCustomerProductRates(Number(id));
      setCustomerRates(rates);

      const bSizes = await getBottleSizes(true);
      setAllBottleSizes(bSizes);
    } catch (err) {
      console.error('Failed to load customer details', err);
    } finally {
      setLoading(false);
    }
  }, [id, statementPreset, customStart, customEnd]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    if (!customer) return;
    confirmAction({
      title: 'Remove Customer',
      message: `Are you sure you want to delete or archive "${customer.name}"?`,
      confirmText: 'Delete / Archive',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await deleteCustomerSafe(customer.id);
          if (res.archivedInstead) {
            showAlert(
              'Customer Archived',
              res.reason || 'Customer has delivery history and was safely archived to preserve records.'
            );
            loadData();
          } else {
            showAlert('Deleted', `"${customer.name}" was permanently removed.`);
            router.replace('/(tabs)/customers');
          }
        } catch (err: any) {
          showAlert('Error', err?.message || 'Action failed');
        }
      },
    });
  };

  const handleToggleArchive = async () => {
    if (!customer) return;
    try {
      if (customer.is_archived === 1) {
        await unarchiveCustomer(customer.id);
      } else {
        await archiveCustomer(customer.id);
      }
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const openRateModal = (bottle: BottleSize) => {
    setSelectedBottleForRate(bottle);
    const existingRate = customerRates.find((r) => r.bottle_size_id === bottle.id);
    setInputRate(existingRate ? String(existingRate.rate_rupees) : String(bottle.default_unit_price || ''));
    setRateModalVisible(true);
  };

  const handleSaveRate = async () => {
    if (!customer || !selectedBottleForRate) return;
    const num = parseFloat(inputRate.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid non-negative rate in ₹.');
      return;
    }
    setSavingRate(true);
    try {
      await setCustomerProductRate(customer.id, selectedBottleForRate.id, num);
      setRateModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save agreed rate');
    } finally {
      setSavingRate(false);
    }
  };

  const handleResetRate = async (bottleSizeId: number) => {
    if (!customer) return;
    confirmAction({
      title: 'Reset Custom Rate',
      message: 'Remove custom agreed rate for this product and revert to standard price?',
      confirmText: 'Reset',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteCustomerProductRate(customer.id, bottleSizeId);
          loadData();
          showAlert('Rate Reset', 'Custom product rate reverted to default price.');
        } catch (err: any) {
          showAlert('Error', err?.message || 'Failed to reset rate');
        }
      },
    });
  };

  const ensureStatementGenerated = async () => {
    if (!customer) throw new Error('Customer not loaded');
    let sDate: string | undefined = undefined;
    let eDate: string | undefined = undefined;

    if (statementPreset === 'today') {
      sDate = getTodayDate();
      eDate = getTodayDate();
    } else if (statementPreset === 'yesterday') {
      sDate = getYesterdayDate();
      eDate = getYesterdayDate();
    } else if (statementPreset === 'this_week') {
      const w = getThisWeekRange('monday');
      sDate = w.start;
      eDate = w.end;
    } else if (statementPreset === 'this_month') {
      const m = getThisMonthRange();
      sDate = m.start;
      eDate = m.end;
    } else if (statementPreset === 'custom') {
      sDate = customStart;
      eDate = customEnd;
    }

    const data = await getCustomerStatementData(customer.id, statementPreset, sDate, eDate);
    const pdf = await generateCustomerStatementPdf(data);
    setStatementData(data);
    setStatementPdfResult(pdf);
    return { data, pdf };
  };

  const handleViewStatementPdf = async () => {
    if (!customer) return;
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for this customer in the selected period.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await ensureStatementGenerated();
      setStatementModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate customer statement');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintStatement = async () => {
    if (!customer) return;
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for this customer in the selected period.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      setIsGeneratingPdf(true);
      let pdf = statementPdfResult;
      if (!pdf || statementData?.customer.id !== customer.id || statementData?.preset !== statementPreset) {
        const res = await ensureStatementGenerated();
        pdf = res.pdf;
      }
      await printPdfDocument(pdf);
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Failed to print statement');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareStatement = async () => {
    if (!customer) return;
    if (deliveries.length === 0) {
      Alert.alert(
        'No Deliveries Found',
        'There are no delivery records for this customer in the selected period.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      setIsGeneratingPdf(true);
      let pdf = statementPdfResult;
      if (!pdf || statementData?.customer.id !== customer.id || statementData?.preset !== statementPreset) {
        const res = await ensureStatementGenerated();
        pdf = res.pdf;
      }
      await sharePdfDocument(pdf);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share statement');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrevMonth = () => {
    setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDayPress = (dayNum: number) => {
    const selected = formatLocalDate(new Date(calViewDate.getFullYear(), calViewDate.getMonth(), dayNum));

    if (!calTempStart || (calTempStart && calTempEnd && calTempStart !== calTempEnd)) {
      setCalTempStart(selected);
      setCalTempEnd(selected);
    } else if (calTempStart && calTempStart === calTempEnd) {
      if (selected < calTempStart) {
        setCalTempStart(selected);
        setCalTempEnd(selected);
      } else {
        setCalTempEnd(selected);
      }
    }
  };

  const handleApplyCustom = () => {
    let s = calTempStart;
    let e = calTempEnd;
    if (e < s) {
      const temp = s;
      s = e;
      e = temp;
    }
    setCustomStart(s);
    setCustomEnd(e);
    setStatementPreset('custom');
    setCustomCalendarVisible(false);
  };

  const getStatementPeriodLabel = () => {
    switch (statementPreset) {
      case 'all_time':
        return 'All Time (Full Delivery History)';
      case 'today':
        return `Today • ${formatDisplayDate(getTodayDate())}`;
      case 'yesterday':
        return `Yesterday • ${formatDisplayDate(getYesterdayDate())}`;
      case 'this_week': {
        const w = getThisWeekRange('monday');
        return `This Week • ${formatDisplayDate(w.start)} to ${formatDisplayDate(w.end)}`;
      }
      case 'this_month': {
        const m = getThisMonthRange();
        return `This Month • ${formatDisplayDate(m.start)} to ${formatDisplayDate(m.end)}`;
      }
      case 'custom':
        return `Custom • ${formatDisplayDate(customStart)} to ${formatDisplayDate(customEnd)}`;
      default:
        return 'All Time';
    }
  };

  // Period totals
  const periodTotalDeliveries = deliveries.length;
  const periodTotalBottles = deliveries.reduce((acc, d) => acc + (d.total_bottles || 0), 0);
  const periodTotalLitres = deliveries.reduce((acc, d) => {
    const l = d.total_volume_litres ?? (d.total_volume_ml ? d.total_volume_ml / 1000 : 0);
    return acc + l;
  }, 0);
  const periodTotalAmount = deliveries.reduce((acc, d) => {
    if (d.items && d.items.length > 0) {
      return acc + d.items.reduce((sum, item) => sum + (item.quantity * (item.unit_price_snapshot || 0)), 0);
    }
    return acc + (d.total_amount || 0);
  }, 0);

  // Calendar helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const calYear = calViewDate.getFullYear();
  const calMonth = calViewDate.getMonth();
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  if (!customer && !loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title="Customer Details" showBack />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Customer not found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title={customer?.name || 'Customer'}
        subtitle={customer?.customer_type}
        showBack
        rightAction={{
          icon: 'create-outline',
          onPress: () => router.push(`/customer/edit?id=${customer?.id}`),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Banner when redirected after creating customer */}
        {created === 'true' && (
          <View
            style={[
              styles.successBanner,
              { backgroundColor: isDark ? '#064e3b' : '#d1fae5', borderColor: '#10b981' },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={[styles.successBannerText, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
              Customer added successfully.
            </Text>
          </View>
        )}

        {customer && (
          <>
            {isPlaceholderCustomerName(customer.name) && (
              <TouchableOpacity
                onPress={() => router.push(`/customer/edit?id=${customer.id}`)}
                style={[
                  styles.warningBanner,
                  { backgroundColor: isDark ? '#451a03' : '#fef3c7', borderColor: '#f59e0b' },
                ]}
              >
                <Ionicons name="alert-circle" size={20} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.warningBannerTitle, { color: isDark ? '#fde68a' : '#92400e' }]}>
                    Missing Real Business Name
                  </Text>
                  <Text style={[styles.warningBannerSub, { color: isDark ? '#fcd34d' : '#b45309' }]}>
                    Tap here to set the business/hotel name for accurate bills & reports.
                  </Text>
                </View>
                <Ionicons name="create-outline" size={18} color="#d97706" />
              </TouchableOpacity>
            )}

            {/* Customer Profile Card */}
            <Card style={styles.card}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.titleName, { color: colors.text }]}>{customer.name}</Text>
                  <View style={styles.badgeRow}>
                    <Badge label={customer.customer_type} type={customer.customer_type} size="sm" />
                    {customer.is_archived === 1 && (
                      <Badge label="Archived" type="inactive" size="sm" />
                    )}
                  </View>
                </View>

                {customer.is_archived === 0 && (
                  <Button
                    title="Add Delivery"
                    icon="add-circle"
                    variant="primary"
                    size="sm"
                    onPress={() => router.push(`/delivery/new?customerId=${customer.id}`)}
                  />
                )}
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              {customer.address ? (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {customer.address}
                  </Text>
                </View>
              ) : null}

              {customer.phone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {customer.phone}
                  </Text>
                </View>
              ) : null}

              {customer.notes ? (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.textMuted }]}>
                    "{customer.notes}"
                  </Text>
                </View>
              ) : null}

              {/* Profile Action Buttons */}
              <View style={styles.cardActionsRow}>
                <Button
                  title="Edit Profile"
                  icon="create-outline"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push(`/customer/edit?id=${customer.id}`)}
                  style={{ flex: 1 }}
                />
                {customer.is_archived === 0 && (
                  <Button
                    title="Add Delivery"
                    icon="add-circle"
                    variant="primary"
                    size="sm"
                    onPress={() => router.push(`/delivery/new?customerId=${customer.id}`)}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </Card>

            {/* Quick Metrics Grid (4 key customer metrics) */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Deliveries"
                value={customer.total_deliveries || 0}
                subtitle="Total orders"
                icon="cube-outline"
                accentColor="#0d9488"
                style={styles.gridStat}
              />
              <StatCard
                title="Total Bottles"
                value={customer.total_bottles || 0}
                subtitle="All-time count"
                icon="water-outline"
                accentColor="#0284c7"
                style={styles.gridStat}
              />
              <StatCard
                title="Total Water"
                value={`${(customer.total_volume_litres || 0).toLocaleString()} L`}
                subtitle="Volume delivered"
                icon="flask-outline"
                accentColor="#3b82f6"
                style={styles.gridStat}
              />
              <StatCard
                title="Total Value"
                value={`₹${(customer.total_delivery_value || 0).toFixed(2)}`}
                subtitle="All-time billing"
                icon="cash-outline"
                accentColor="#16a34a"
                style={styles.gridStat}
              />
            </View>

            {/* Customer Account Statement Section */}
            <Card style={[styles.card, styles.statementCard, { borderColor: colors.primary, borderWidth: 1.5 }]}>
              <View style={styles.statementHeaderRow}>
                <View style={[styles.statementIconCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="receipt-outline" size={20} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statementCardTitle, { color: colors.text }]}>
                    Customer Account Statement
                  </Text>
                  <Text style={[styles.statementCardSubtitle, { color: colors.textSecondary }]}>
                    Consolidated billing statement & official delivery report
                  </Text>
                </View>
              </View>

              {/* Period Preset Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsList}
              >
                {[
                  { id: 'all_time' as const, label: 'All Time' },
                  { id: 'today' as const, label: 'Today' },
                  { id: 'yesterday' as const, label: 'Yesterday' },
                  { id: 'this_week' as const, label: 'This Week' },
                  { id: 'this_month' as const, label: 'This Month' },
                  { id: 'custom' as const, label: 'Custom Date' },
                ].map((p) => {
                  const isActive = statementPreset === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (p.id === 'custom') {
                          setCalTempStart(customStart);
                          setCalTempEnd(customEnd);
                          setCalViewDate(parseLocalDate(customStart));
                          setCustomCalendarVisible(true);
                        } else {
                          setStatementPreset(p.id);
                        }
                      }}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isActive ? colors.primary : isDark ? '#334155' : colors.inputBg,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          {
                            color: isActive ? '#ffffff' : colors.textSecondary,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Active Period Info Bar */}
              <View
                style={[
                  styles.activePeriodBar,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f0f9ff',
                    borderColor: isDark ? '#334155' : '#bae6fd',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar" size={15} color={colors.primary} />
                    <Text style={[styles.activePeriodText, { color: colors.text }]}>
                      {getStatementPeriodLabel()}
                    </Text>
                  </View>
                  <Text style={[styles.activePeriodMetrics, { color: colors.textSecondary }]}>
                    {periodTotalDeliveries} {periodTotalDeliveries === 1 ? 'delivery' : 'deliveries'} • {periodTotalBottles} bottles • ₹{periodTotalAmount.toFixed(2)} total bill
                  </Text>
                </View>

                {statementPreset === 'custom' && (
                  <TouchableOpacity
                    onPress={() => {
                      setCalTempStart(customStart);
                      setCalTempEnd(customEnd);
                      setCalViewDate(parseLocalDate(customStart));
                      setCustomCalendarVisible(true);
                    }}
                    style={[styles.changeDatesBtn, { backgroundColor: isDark ? '#334155' : '#e0f2fe' }]}
                  >
                    <Text style={[styles.changeDatesText, { color: colors.primary }]}>Change Dates</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Statement Action Buttons */}
              <View style={styles.statementButtonsCol}>
                <Button
                  title={isGeneratingPdf ? 'Compiling Statement...' : 'View Total Bill (PDF)'}
                  icon="document-text-outline"
                  variant="primary"
                  size="md"
                  loading={isGeneratingPdf}
                  disabled={periodTotalDeliveries === 0}
                  onPress={handleViewStatementPdf}
                />

                <View style={styles.statementSecondaryButtonsRow}>
                  <Button
                    title="Print Statement"
                    icon="print-outline"
                    variant="outline"
                    size="sm"
                    disabled={periodTotalDeliveries === 0 || isGeneratingPdf}
                    onPress={handlePrintStatement}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Share / Export PDF"
                    icon="share-outline"
                    variant="outline"
                    size="sm"
                    disabled={periodTotalDeliveries === 0 || isGeneratingPdf}
                    onPress={handleShareStatement}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </Card>

            {/* Customer-Specific Agreed Rates Card (Section 5) */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Agreed Bottle Pricing
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    Special negotiated rates for this customer
                  </Text>
                </View>
              </View>

              {allBottleSizes.map((b) => {
                const customRate = customerRates.find((r) => r.bottle_size_id === b.id);
                return (
                  <View
                    key={b.id}
                    style={[styles.rateRow, { borderBottomColor: colors.borderLight }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rateBottleName, { color: colors.text }]}>
                        {b.name}
                      </Text>
                      <Text style={[styles.rateSub, { color: colors.textSecondary }]}>
                        Standard: ₹{(b.default_unit_price || 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.rateActions}>
                      {customRate ? (
                        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                          <Text style={[styles.customRateValue, { color: '#059669' }]}>
                            ₹{customRate.rate_rupees.toFixed(2)}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>
                            Agreed Rate
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.standardRateTag, { color: colors.textMuted }]}>
                          Standard
                        </Text>
                      )}

                      <TouchableOpacity
                        onPress={() => openRateModal(b)}
                        style={[styles.rateBtn, { backgroundColor: isDark ? '#334155' : colors.inputBg }]}
                      >
                        <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                        <Text style={[styles.rateBtnText, { color: colors.primary }]}>
                          {customRate ? 'Edit' : 'Set Rate'}
                        </Text>
                      </TouchableOpacity>

                      {customRate && (
                        <TouchableOpacity
                          onPress={() => handleResetRate(b.id)}
                          style={[styles.rateResetBtn, { backgroundColor: isDark ? '#451a1a' : '#fee2e2' }]}
                        >
                          <Ionicons name="close" size={14} color="#dc2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>

            {/* Customer Bottle Totals Breakdown */}
            {bottleTotals.length > 0 && (
              <Card style={styles.card}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Bottle Sizes Delivered
                </Text>
                {bottleTotals.map((item) => (
                  <View
                    key={item.bottle_size_id}
                    style={[styles.bottleRow, { borderBottomColor: colors.borderLight }]}
                  >
                    <View>
                      <Text style={[styles.bottleName, { color: colors.text }]}>
                        {item.bottle_size_name}
                      </Text>
                      {item.total_volume_litres ? (
                        <Text style={[styles.bottleVolSub, { color: colors.textSecondary }]}>
                          {item.total_volume_litres} Litres total
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.bottleQty, { color: colors.primary }]}>
                      {item.total_quantity} bottles
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Delivery History */}
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Delivery History ({deliveries.length})
                  </Text>
                  {statementPreset !== 'all_time' && (
                    <TouchableOpacity onPress={() => setStatementPreset('all_time')}>
                      <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                        Show All Time
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {statementPreset === 'all_time'
                    ? 'All past shipments recorded for this client'
                    : `Past shipments filtered by statement period`}
                </Text>
              </View>

              {deliveries.length > 0 ? (
                deliveries.map((d) => (
                  <DeliveryItemCard
                    key={d.id}
                    delivery={d}
                    onPress={() => router.push(`/delivery/${d.id}`)}
                  />
                ))
              ) : (
                <Card style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    No deliveries found for {getStatementPeriodLabel()}.
                  </Text>
                  {statementPreset !== 'all_time' && (
                    <Button
                      title="View All Past Deliveries"
                      variant="outline"
                      size="sm"
                      onPress={() => setStatementPreset('all_time')}
                      style={{ marginTop: 4 }}
                    />
                  )}
                </Card>
              )}
            </View>

            {/* Customer Management Actions */}
            <View style={styles.actionsRow}>
              <Button
                title="Edit Details"
                icon="create-outline"
                variant="outline"
                onPress={() => router.push(`/customer/edit?id=${customer.id}`)}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Button
                title={customer.is_archived === 1 ? 'Unarchive' : 'Archive'}
                variant="outline"
                onPress={handleToggleArchive}
                style={{ flex: 1, marginHorizontal: 3 }}
              />
              <Button
                title="Delete"
                icon="trash-outline"
                variant="destructive"
                onPress={handleDelete}
                style={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            {/* Back to Customers Directory Action */}
            <Button
              title="Back to Customers Directory"
              icon="arrow-back"
              variant="outline"
              size="lg"
              onPress={() => router.replace('/(tabs)/customers')}
              style={{ marginTop: 4 }}
            />
          </>
        )}
      </ScrollView>

      {/* Agreed Rate Edit Modal */}
      <Modal
        visible={rateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Set Agreed Customer Price
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {selectedBottleForRate?.name} • Standard: ₹{(selectedBottleForRate?.default_unit_price || 0).toFixed(2)}
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Agreed Rate per Bottle (₹)
              </Text>
              <TextInput
                id="agreed-rate-input"
                nativeID="agreed-rate-input"
                aria-label="Agreed Rate per Bottle"
                value={inputRate}
                onChangeText={setInputRate}
                placeholder="e.g. 35.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[
                  styles.formInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setRateModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Agreed Rate"
                variant="primary"
                loading={savingRate}
                onPress={handleSaveRate}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={customCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Calendar Month Navigation Header */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.calMonthTitle, { color: colors.text }]}>
                {monthNames[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels (Mon to Sun) */}
            <View style={styles.weekLabelsRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <Text key={day} style={[styles.weekLabelText, { color: colors.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {Array.from({ length: startOffset }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.emptyDayCell} />
              ))}

              {Array.from({ length: totalDays }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = formatLocalDate(
                  new Date(calYear, calMonth, dayNum)
                );

                const isStart = calTempStart === dateStr;
                const isEnd = calTempEnd === dateStr;
                const isInRange =
                  calTempStart &&
                  calTempEnd &&
                  calTempStart < calTempEnd &&
                  dateStr > calTempStart &&
                  dateStr < calTempEnd;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    onPress={() => handleDayPress(dayNum)}
                    style={[
                      styles.dayCell,
                      isInRange && { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' },
                      (isStart || isEnd) && {
                        backgroundColor: colors.primary,
                        borderRadius: 20,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        { color: isStart || isEnd ? '#ffffff' : colors.text },
                        isInRange && { color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '700' },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Range Display */}
            <View style={styles.calSelectionSummary}>
              <Text style={[styles.calSelectionLabel, { color: colors.textSecondary }]}>
                Selected:{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {formatDisplayDate(calTempStart)} ➔ {formatDisplayDate(calTempEnd)}
                </Text>
              </Text>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCustomCalendarVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Apply Date Range"
                variant="primary"
                onPress={handleApplyCustom}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Account Statement Preview Modal */}
      <CustomerStatementModal
        visible={statementModalVisible}
        onClose={() => setStatementModalVisible(false)}
        statementData={statementData}
        pdfResult={statementPdfResult}
        onPrint={handlePrintStatement}
        onShare={handleShareStatement}
        isLoading={isGeneratingPdf}
      />
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
    gap: 16,
    paddingBottom: 40,
  },
  notFound: {
    padding: 32,
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 15,
  },
  card: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleName: {
    fontSize: 18,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  divider: {
    height: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridStat: {
    flex: 1,
    minWidth: '47%',
  },
  statementCard: {
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statementHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statementIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statementCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statementCardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  presetsList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
  },
  activePeriodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  activePeriodText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activePeriodMetrics: {
    fontSize: 12,
    marginTop: 2,
  },
  changeDatesBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  changeDatesText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statementButtonsCol: {
    gap: 8,
    marginTop: 2,
  },
  statementSecondaryButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  bottleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bottleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottleQty: {
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    gap: 10,
  },
  historyHeader: {
    gap: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  successBannerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rateBottleName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rateSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customRateValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  standardRateTag: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  rateBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rateResetBtn: {
    padding: 5,
    borderRadius: 8,
  },
  bottleVolSub: {
    fontSize: 12,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  weekLabelText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  emptyDayCell: {
    width: '14.28%',
    height: 38,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calSelectionSummary: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  calSelectionLabel: {
    fontSize: 13,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  warningBannerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});

