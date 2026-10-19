import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  getCustomers,
  getCustomerById,
  getCustomerProductRates,
  searchActiveCustomers,
} from '../../services/customerService';
import { getBottleSizes } from '../../services/bottleSizeService';
import { createDelivery } from '../../services/deliveryService';
import { formatLocalDate, getTodayDate } from '../../services/reportingService';
import { BottleSize, CustomerWithStats } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';
import { formatCustomerName } from '../../utils/formatters';

function showAppAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function NewDeliveryScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ customerId?: string }>();

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [customerPickerModalVisible, setCustomerPickerModalVisible] = useState(false);

  // Products and Quantities
  const [bottleSizes, setBottleSizes] = useState<BottleSize[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [customerRates, setCustomerRates] = useState<Record<number, number>>({});
  const [customRates, setCustomRates] = useState<Record<number, number>>({});

  // Line Price Edit Modal State
  const [editingPriceBottle, setEditingPriceBottle] = useState<BottleSize | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState('');

  // Delivery Details
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  const [deliveryDate, setDeliveryDate] = useState<string>(getTodayDate());
  const [deliveryTime, setDeliveryTime] = useState<string>(defaultTime);
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submitting State & Idempotency Key
  const [saving, setSaving] = useState(false);
  const [savedSuccessData, setSavedSuccessData] = useState<{
    deliveryId: number;
    customerName: string;
    totalBottles: number;
    totalAmount: number;
    billNumber?: string | null;
  } | null>(null);
  const isSubmittingRef = useRef(false);
  const submissionKeyRef = useRef<string>(
    'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
  );

  // Load initial bottle sizes and check if customerId is passed
  useEffect(() => {
    (async () => {
      try {
        const sizes = await getBottleSizes(true);
        setBottleSizes(sizes);

        const initialQtys: Record<number, number> = {};
        for (const s of sizes) {
          initialQtys[s.id] = 0;
        }
        setQuantities(initialQtys);

        const custList = await getCustomers({ includeArchived: false, sort: 'recent', limit: 50 });
        setCustomers(custList);

        if (params.customerId) {
          const preselected = await getCustomerById(Number(params.customerId));
          if (preselected) {
            await handleSelectCustomer(preselected);
          }
        }
      } catch (err) {
        console.error('Error loading delivery setup data', err);
      }
    })();
  }, [params.customerId]);

  const handleSelectCustomer = async (c: CustomerWithStats) => {
    setSelectedCustomer(c);
    setDeliveryLocation(c.address?.trim() || c.name || 'Store Location');

    // Fetch agreed customer product rates
    try {
      const rates = await getCustomerProductRates(c.id);
      const rateMap: Record<number, number> = {};
      for (const r of rates) {
        rateMap[r.bottle_size_id] = r.rate_rupees ?? r.unit_price_minor_units / 100;
      }
      setCustomerRates(rateMap);
      setCustomRates({}); // reset line overrides when customer changes
    } catch (err) {
      console.warn('Could not load customer rates', err);
    }

    setCustomerPickerModalVisible(false);
  };

  const getEffectiveRate = (
    bottle: BottleSize
  ): { rate: number; source: 'custom' | 'customer' | 'standard' } => {
    if (customRates[bottle.id] !== undefined) {
      return { rate: customRates[bottle.id], source: 'custom' };
    }
    if (customerRates[bottle.id] !== undefined) {
      return { rate: customerRates[bottle.id], source: 'customer' };
    }
    const standardRate = bottle.standard_price_paise
      ? bottle.standard_price_paise / 100
      : bottle.default_unit_price || 0;
    return { rate: standardRate, source: 'standard' };
  };

  const handleQtyChange = (bottleId: number, delta: number) => {
    const current = quantities[bottleId] || 0;
    const next = Math.max(0, current + delta);
    setQuantities((prev) => ({ ...prev, [bottleId]: next }));
  };

  const handleDirectQtyChange = (bottleId: number, text: string) => {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setQuantities((prev) => ({
      ...prev,
      [bottleId]: isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const openPriceEditModal = (bottle: BottleSize) => {
    const { rate } = getEffectiveRate(bottle);
    setEditingPriceBottle(bottle);
    setTempPriceInput(rate > 0 ? rate.toString() : '');
  };

  const applyCustomPrice = () => {
    if (!editingPriceBottle) return;
    const parsed = parseFloat(tempPriceInput.trim());
    if (isNaN(parsed) || parsed < 0) {
      showAppAlert('Invalid Price', 'Please enter a valid price amount.');
      return;
    }
    setCustomRates((prev) => ({
      ...prev,
      [editingPriceBottle.id]: parsed,
    }));
    setEditingPriceBottle(null);
  };

  const resetCustomPrice = (bottleId: number) => {
    setCustomRates((prev) => {
      const copy = { ...prev };
      delete copy[bottleId];
      return copy;
    });
  };

  // Live Aggregations
  const totalBottles = Object.values(quantities).reduce((a, b) => a + b, 0);

  const totalVolumeLitres = bottleSizes.reduce((sum, size) => {
    const qty = quantities[size.id] || 0;
    const volMl = size.volume_ml || 1000;
    return sum + (qty * volMl) / 1000;
  }, 0);

  const totalAmount = bottleSizes.reduce((sum, size) => {
    const qty = quantities[size.id] || 0;
    const { rate } = getEffectiveRate(size);
    return sum + qty * rate;
  }, 0);

  // Quick Presets
  const setToday = () => setDeliveryDate(getTodayDate());
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDeliveryDate(formatLocalDate(d));
  };
  const setTimeNow = () => {
    const d = new Date();
    setDeliveryTime(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  };

  const handleGoToDashboard = () => {
    const data = savedSuccessData;
    setSavedSuccessData(null);
    router.replace({
      pathname: '/(tabs)',
      params: {
        deliverySaved: '1',
        customerName: data?.customerName || selectedCustomer?.name || 'Customer',
        bottles: (data?.totalBottles || totalBottles || 0).toString(),
      },
    });
  };

  const handleSaveDelivery = async () => {
    // Immediate synchronous guard against repeated rapid taps
    if (isSubmittingRef.current || saving) {
      return;
    }

    if (!selectedCustomer) {
      showAppAlert('Customer Required', 'Please select a customer for this delivery.');
      return;
    }

    if (totalBottles <= 0) {
      showAppAlert('Invalid Quantities', 'At least one bottle quantity must be greater than zero.');
      return;
    }

    const resolvedLocation =
      deliveryLocation.trim() ||
      selectedCustomer.address?.trim() ||
      selectedCustomer.name ||
      'Store Location';

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      const lineItems = bottleSizes
        .filter((size) => (quantities[size.id] || 0) > 0)
        .map((size) => {
          const { rate } = getEffectiveRate(size);
          const volMl = size.volume_ml ?? 1000;
          const volUnit = size.volume_unit || (volMl >= 1000 ? 'L' : 'mL');
          return {
            bottle_size_id: size.id,
            bottle_size_name_snapshot: size.name,
            volume_ml_snapshot: volMl,
            volume_unit_snapshot: volUnit,
            quantity: quantities[size.id],
            unit_price_snapshot: rate,
            line_total: quantities[size.id] * rate,
          };
        });

      const timeClean = deliveryTime.trim() || defaultTime;
      const timeParts = timeClean.split(':');
      const hh = (timeParts[0] || '10').padStart(2, '0');
      const mm = (timeParts[1] || '00').padStart(2, '0');
      const dateClean = deliveryDate.trim() || getTodayDate();
      const deliveredAt = `${dateClean}T${hh}:${mm}:00.000Z`;

      const delivery = await createDelivery({
        submission_key: submissionKeyRef.current,
        customer_id: selectedCustomer.id,
        delivery_date: dateClean,
        delivered_at: deliveredAt,
        delivery_location: resolvedLocation,
        notes: notes.trim() || null,
        items: lineItems,
      });

      // Renew submission key for any subsequent submission
      submissionKeyRef.current =
        'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      // Show success popup modal
      setSavedSuccessData({
        deliveryId: delivery.id,
        customerName: selectedCustomer.name,
        totalBottles,
        totalAmount,
        billNumber: delivery.bill_number,
      });
    } catch (err: any) {
      console.error('Error saving delivery:', err);
      submissionKeyRef.current =
        'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      if (err.message && err.message.includes('submission_key')) {
        showAppAlert('Notice', 'This delivery has already been recorded.');
        router.replace('/(tabs)/deliveries');
      } else {
        showAppAlert(
          'Unable to Save Delivery',
          err.message || 'An error occurred while saving. Your entries have been preserved. Please try again.'
        );
      }
    } finally {
      setSaving(false);
      isSubmittingRef.current = false;
    }
  };

  // Filtered customer list for customer selection/switching
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch)) ||
      (c.address && c.address.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Header
        title={selectedCustomer ? 'Quick Delivery' : 'Select Customer'}
        subtitle={
          selectedCustomer
            ? formatCustomerName(selectedCustomer.name, `Customer #${selectedCustomer.id}`)
            : 'Choose a recipient to record delivery'
        }
        showBack
        onBack={() => {
          if (customerPickerModalVisible) {
            setCustomerPickerModalVisible(false);
          } else {
            router.back();
          }
        }}
      />

      {/* Main Delivery Workflow Body */}
      {selectedCustomer ? (
        <View style={styles.flexOne}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Top Customer Summary Card */}
            <Card style={styles.customerSummaryCard}>
              <View style={styles.customerSummaryTopRow}>
                <View style={styles.customerNameBlock}>
                  <Text style={[styles.customerBusinessName, { color: colors.text }]} numberOfLines={1}>
                    {formatCustomerName(selectedCustomer.name, `Customer #${selectedCustomer.id}`)}
                  </Text>
                  <Badge
                    label={selectedCustomer.customer_type}
                    type={selectedCustomer.customer_type}
                    size="sm"
                  />
                </View>

                {/* Change Customer Action */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setCustomerPickerModalVisible(true)}
                  style={[
                    styles.changeCustomerBtn,
                    {
                      backgroundColor: isDark ? '#334155' : colors.inputBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                  <Text style={[styles.changeCustomerText, { color: colors.primary }]}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Customer Address */}
              {selectedCustomer.address ? (
                <View style={styles.customerMetaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.customerMetaText, { color: colors.textSecondary }]}>
                    {selectedCustomer.address}
                  </Text>
                </View>
              ) : null}

              {/* Customer Phone */}
              {selectedCustomer.phone ? (
                <View style={styles.customerMetaRow}>
                  <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.customerMetaText, { color: colors.textSecondary }]}>
                    {selectedCustomer.phone}
                  </Text>
                </View>
              ) : null}
            </Card>

            {/* Configurable Bottle Products Section */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Bottle Quantities & Rates</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Enter delivered bottle quantities and verify pricing
                </Text>
              </View>

              {bottleSizes.map((size) => {
                const qty = quantities[size.id] || 0;
                const { rate, source } = getEffectiveRate(size);
                const lineTotal = qty * rate;
                const volText = size.volume_ml
                  ? size.volume_ml >= 1000
                    ? `${(size.volume_ml / 1000).toFixed(1).replace(/\.0$/, '')} L`
                    : `${size.volume_ml} mL`
                  : '';
                const unitLabel = size.volume_ml && size.volume_ml >= 1000 ? 'jar' : 'bottle';

                return (
                  <Card key={size.id} style={styles.productCard}>
                    {/* Product Name and Volume */}
                    <View style={styles.productTopRow}>
                      <View style={styles.productNameInfo}>
                        <Text style={[styles.productTitle, { color: colors.text }]}>
                          {size.name} · {volText || 'Standard'}
                        </Text>
                        <View style={styles.rateRow}>
                          <Text style={[styles.productRateText, { color: colors.textSecondary }]}>
                            Rate: <Text style={{ fontWeight: '700', color: colors.text }}>₹{rate.toFixed(2)}</Text> per {unitLabel}
                          </Text>
                          {source === 'customer' && (
                            <View style={[styles.rateBadge, { backgroundColor: '#dcfce7' }]}>
                              <Text style={[styles.rateBadgeText, { color: '#166534' }]}>Customer Rate</Text>
                            </View>
                          )}
                          {source === 'custom' && (
                            <View style={[styles.rateBadge, { backgroundColor: '#fef3c7' }]}>
                              <Text style={[styles.rateBadgeText, { color: '#b45309' }]}>Custom</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Edit rate link */}
                      <TouchableOpacity onPress={() => openPriceEditModal(size)}>
                        <Text style={[styles.editRateLink, { color: colors.primary }]}>
                          {source === 'custom' ? 'Change Rate' : 'Edit Rate'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Quantity Stepper and Line Total */}
                    <View style={[styles.productBottomRow, { borderTopColor: colors.borderLight }]}>
                      <View style={styles.stepperContainer}>
                        <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>Quantity:</Text>
                        <TouchableOpacity
                          onPress={() => handleQtyChange(size.id, -1)}
                          style={[
                            styles.stepperBtn,
                            { backgroundColor: isDark ? '#334155' : colors.inputBg },
                          ]}
                          disabled={qty <= 0}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name="remove"
                            size={18}
                            color={qty <= 0 ? colors.textMuted : colors.text}
                          />
                        </TouchableOpacity>

                        <TextInput
                          id={`bottle-qty-${size.id}`}
                          nativeID={`bottle-qty-${size.id}`}
                          aria-label={`Quantity for ${size.name}`}
                          keyboardType="number-pad"
                          value={String(qty)}
                          onChangeText={(t) => handleDirectQtyChange(size.id, t)}
                          selectTextOnFocus
                          style={[
                            styles.qtyInput,
                            {
                              color: colors.text,
                              backgroundColor: isDark ? '#1e293b' : colors.surface,
                              borderColor: colors.border,
                            },
                          ]}
                        />

                        <TouchableOpacity
                          onPress={() => handleQtyChange(size.id, 1)}
                          style={[
                            styles.stepperBtn,
                            { backgroundColor: isDark ? '#334155' : colors.inputBg },
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="add" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>

                      {/* Line Total */}
                      <View style={styles.lineTotalContainer}>
                        <Text style={[styles.lineTotalLabel, { color: colors.textMuted }]}>Line total:</Text>
                        <Text style={[styles.lineTotalValue, { color: colors.primary }]}>
                          ₹{lineTotal.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Delivery Details Card */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery Information</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Schedule, location, and driver notes
                </Text>
              </View>

              <Card style={styles.formCard}>
                {/* Date Quick Presets */}
                <View style={styles.presetRow}>
                  <Text style={[styles.presetLabel, { color: colors.textSecondary }]}>Quick Date:</Text>
                  <TouchableOpacity
                    onPress={setToday}
                    style={[
                      styles.presetPill,
                      deliveryDate === getTodayDate()
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        { color: deliveryDate === getTodayDate() ? '#ffffff' : colors.text },
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={setYesterday}
                    style={[styles.presetPill, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.presetPillText, { color: colors.text }]}>Yesterday</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={setTimeNow}
                    style={[styles.presetPill, { borderColor: colors.border, marginLeft: 'auto' }]}
                  >
                    <Ionicons name="time-outline" size={13} color={colors.primary} />
                    <Text style={[styles.presetPillText, { color: colors.primary }]}>Time Now</Text>
                  </TouchableOpacity>
                </View>

                {/* Date and Time Inputs */}
                <View style={styles.rowInputs}>
                  <View style={[styles.fieldGroup, { flex: 3 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Date (YYYY-MM-DD) *
                    </Text>
                    <TextInput
                      id="delivery-date-input"
                      nativeID="delivery-date-input"
                      aria-label="Delivery Date"
                      value={deliveryDate}
                      onChangeText={setDeliveryDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
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

                  <View style={[styles.fieldGroup, { flex: 2 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Time (HH:MM) *
                    </Text>
                    <TextInput
                      id="delivery-time-input"
                      nativeID="delivery-time-input"
                      aria-label="Delivery Time"
                      value={deliveryTime}
                      onChangeText={setDeliveryTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textMuted}
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
                </View>

                {/* Delivery Location / Address */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Delivery Location / Address *
                  </Text>
                  <TextInput
                    id="delivery-location-input"
                    nativeID="delivery-location-input"
                    aria-label="Delivery Location"
                    autoComplete="street-address"
                    value={deliveryLocation}
                    onChangeText={setDeliveryLocation}
                    placeholder="e.g. Hotel Front Entrance, 2nd Floor"
                    placeholderTextColor={colors.textMuted}
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

                {/* Optional Notes */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Notes / Instructions (Optional)
                  </Text>
                  <TextInput
                    id="delivery-notes-input"
                    nativeID="delivery-notes-input"
                    aria-label="Delivery Notes"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="e.g. Collected 5 empty water jars, signed by manager"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={2}
                    style={[
                      styles.formTextArea,
                      {
                        color: colors.text,
                        backgroundColor: isDark ? '#334155' : colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                </View>
              </Card>
            </View>

            {/* Live Order Summary Card */}
            <Card
              style={[
                styles.summaryCard,
                {
                  backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryLabel, { color: colors.primaryDark }]}>TOTAL BOTTLES</Text>
                  <Text style={[styles.summaryVal, { color: colors.text }]}>{totalBottles}</Text>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryLabel, { color: colors.primaryDark }]}>TOTAL VOLUME</Text>
                  <Text style={[styles.summaryVal, { color: colors.text }]}>
                    {totalVolumeLitres.toFixed(1)} L
                  </Text>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryLabel, { color: colors.primaryDark }]}>TOTAL AMOUNT</Text>
                  <Text style={[styles.summaryVal, { color: colors.primary }]}>
                    ₹{totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>
          </ScrollView>

          {/* Sticky Bottom Bar with Save Delivery Button */}
          <View
            style={[
              styles.stickyBottomBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.stickySummaryInfo}>
              <Text style={[styles.stickySummaryCount, { color: colors.text }]}>
                {totalBottles} {totalBottles === 1 ? 'Bottle' : 'Bottles'}
              </Text>
              <Text style={[styles.stickySummaryAmount, { color: colors.primary }]}>
                ₹{totalAmount.toFixed(2)}
              </Text>
            </View>

            <Button
              title={saving ? 'Saving...' : 'Save Delivery'}
              variant="primary"
              size="lg"
              icon="checkmark-circle"
              loading={saving}
              disabled={totalBottles <= 0 || saving}
              onPress={handleSaveDelivery}
              style={styles.saveDeliveryBtn}
            />
          </View>
        </View>
      ) : (
        /* Customer Selection View (when no customer is preselected) */
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.selectCustomerHeader}>
            <Text style={[styles.selectCustomerTitle, { color: colors.text }]}>
              Choose Delivery Recipient
            </Text>
            <Text style={[styles.selectCustomerSubtitle, { color: colors.textSecondary }]}>
              Search for an existing hotel, shop, or customer, or register a new one.
            </Text>
          </View>

          {/* Customer Search Bar */}
          <View
            style={[
              styles.searchBarBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              id="customer-search-input"
              nativeID="customer-search-input"
              aria-label="Search hotel, shop, phone or address"
              autoComplete="off"
              placeholder="Search hotel, shop, phone or address..."
              placeholderTextColor={colors.textMuted}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              style={[styles.searchInput, { color: colors.text }]}
              autoFocus
            />
            {customerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setCustomerSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* New Customer Option */}
          <Button
            title="Register New Customer"
            icon="person-add"
            variant="outline"
            onPress={() => router.push('/customer/new')}
            style={{ marginBottom: 12 }}
          />

          {/* Customer Selection Cards */}
          {filteredCustomers.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No matching customer found.
              </Text>
              <Button
                title="Add This Customer"
                variant="primary"
                size="sm"
                onPress={() => router.push('/customer/new')}
                style={{ marginTop: 10 }}
              />
            </Card>
          ) : (
            filteredCustomers.map((c) => (
              <Card
                key={c.id}
                onPress={() => handleSelectCustomer(c)}
                style={styles.customerChoiceCard}
              >
                <View style={styles.customerChoiceTop}>
                  <Text style={[styles.customerChoiceName, { color: colors.text }]}>
                    {formatCustomerName(c.name, `Customer #${c.id}`)}
                  </Text>
                  <Badge label={c.customer_type} type={c.customer_type} size="sm" />
                </View>
                {c.address ? (
                  <Text style={[styles.customerChoiceAddr, { color: colors.textSecondary }]} numberOfLines={1}>
                    {c.address}
                  </Text>
                ) : null}
                {c.phone ? (
                  <Text style={[styles.customerChoicePhone, { color: colors.textMuted }]}>
                    {c.phone}
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal: Change Customer */}
      <Modal
        visible={customerPickerModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCustomerPickerModalVisible(false)}
      >
        <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <Header
            title="Change Customer"
            showBack
            onBack={() => setCustomerPickerModalVisible(false)}
          />

          <View style={{ padding: 16, flex: 1 }}>
            <View
              style={[
                styles.searchBarBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
              <TextInput
                id="modal-customer-search-input"
                nativeID="modal-customer-search-input"
                aria-label="Search hotel, shop, or customer"
                autoComplete="off"
                placeholder="Search hotel, shop, or customer..."
                placeholderTextColor={colors.textMuted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {customerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredCustomers.map((c) => (
                <Card
                  key={c.id}
                  onPress={() => handleSelectCustomer(c)}
                  style={[
                    styles.customerChoiceCard,
                    selectedCustomer?.id === c.id ? { borderColor: colors.primary, borderWidth: 2 } : {},
                  ]}
                >
                  <View style={styles.customerChoiceTop}>
                    <Text style={[styles.customerChoiceName, { color: colors.text }]}>
                      {formatCustomerName(c.name, `Customer #${c.id}`)}
                    </Text>
                    <Badge label={c.customer_type} type={c.customer_type} size="sm" />
                  </View>
                  {c.address ? (
                    <Text style={[styles.customerChoiceAddr, { color: colors.textSecondary }]}>
                      {c.address}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Custom Price Override */}
      <Modal
        visible={editingPriceBottle !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPriceBottle(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Unit Price</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Customize the delivery price for "{editingPriceBottle?.name}" on this specific shipment.
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Unit Rate (₹ per bottle/jar)
              </Text>
              <TextInput
                id="unit-price-input"
                nativeID="unit-price-input"
                aria-label="Unit Rate"
                value={tempPriceInput}
                onChangeText={setTempPriceInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                autoFocus
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

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditingPriceBottle(null)}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Button
                title="Apply Rate"
                variant="primary"
                onPress={applyCustomPrice}
                style={{ flex: 1, marginLeft: 6 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Modal: Delivery Saved Success Popup */}
      <Modal
        visible={savedSuccessData !== null}
        transparent
        animationType="fade"
        onRequestClose={handleGoToDashboard}
      >
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={54} color="#10b981" />
            </View>

            <Text style={[styles.successModalTitle, { color: colors.text }]}>
              Delivery Saved!
            </Text>

            <Text style={[styles.successModalMessage, { color: colors.textSecondary }]}>
              Delivery of{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {savedSuccessData?.totalBottles} bottles
              </Text>{' '}
              for{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {savedSuccessData?.customerName}
              </Text>{' '}
              has been recorded successfully.
            </Text>

            <View style={[styles.successSummaryBox, { backgroundColor: colors.inputBg }]}>
              <View style={styles.successSummaryItem}>
                <Text style={[styles.successSummaryLabel, { color: colors.textMuted }]}>
                  Bill No.
                </Text>
                <Text style={[styles.successSummaryValue, { color: colors.primary }]}>
                  {savedSuccessData?.billNumber || 'WT-XXXX'}
                </Text>
              </View>
              <View style={[styles.successSummaryDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.successSummaryItem}>
                <Text style={[styles.successSummaryLabel, { color: colors.textMuted }]}>
                  Total Amount
                </Text>
                <Text style={[styles.successSummaryValue, { color: colors.text }]}>
                  ₹{(savedSuccessData?.totalAmount || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.successActionsColumn}>
              <Button
                title="Go to Dashboard"
                icon="home-outline"
                variant="primary"
                onPress={handleGoToDashboard}
                style={{ width: '100%' }}
              />

              <Button
                title="View Official Bill"
                icon="document-text-outline"
                variant="outline"
                onPress={() => {
                  if (savedSuccessData) {
                    const id = savedSuccessData.deliveryId;
                    setSavedSuccessData(null);
                    router.replace(`/delivery/${id}`);
                  }
                }}
                style={{ width: '100%', marginTop: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
    gap: 14,
  },
  customerSummaryCard: {
    padding: 14,
    borderRadius: 14,
    gap: 6,
  },
  customerSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerNameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  customerBusinessName: {
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  changeCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  changeCustomerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  customerMetaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  productCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    gap: 10,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  productNameInfo: {
    flex: 1,
    gap: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  productRateText: {
    fontSize: 13,
  },
  rateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editRateLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 52,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  lineTotalContainer: {
    alignItems: 'flex-end',
  },
  lineTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lineTotalValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  formCard: {
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  formInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  formTextArea: {
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  stickyBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
  },
  stickySummaryInfo: {
    flex: 1,
  },
  stickySummaryCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  stickySummaryAmount: {
    fontSize: 19,
    fontWeight: '900',
  },
  saveDeliveryBtn: {
    minWidth: 170,
  },
  selectCustomerHeader: {
    marginBottom: 8,
  },
  selectCustomerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  selectCustomerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  customerChoiceCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 4,
  },
  customerChoiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerChoiceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  customerChoiceAddr: {
    fontSize: 12,
  },
  customerChoicePhone: {
    fontSize: 12,
  },
  modalScreen: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  successModalOverlay: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  successSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  successSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  successSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  successSummaryValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  successSummaryDivider: {
    width: 1,
    height: '100%',
  },
  successActionsColumn: {
    width: '100%',
  },
});
