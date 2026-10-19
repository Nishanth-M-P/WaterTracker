import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Share,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { getDeliveryById, deleteDelivery } from '../../services/deliveryService';
import { confirmAction, showAlert } from '../../utils/dialog';
import {
  generateIndividualBillPdf,
  viewPdfDocument,
  printPdfDocument,
  sharePdfDocument,
  exportPdfDocument,
  GeneratedPdfResult,
} from '../../services/pdfService';
import { getBillProductMapping, mapDeliveryToBillRows } from '../../services/billMappingService';
import { Delivery } from '../../types/database';
import { Ionicons } from '@expo/vector-icons';
import { formatCustomerName } from '../../utils/formatters';

function showAppAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function DeliveryDetailsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [cachedPdf, setCachedPdf] = useState<GeneratedPdfResult | null>(null);
  const [previewPdf, setPreviewPdf] = useState<GeneratedPdfResult | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getDeliveryById(Number(id));
      setDelivery(data);
      setCachedPdf(null); // invalidate cached PDF when data is refreshed
    } catch (err) {
      console.error('Failed to load delivery details', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    if (!delivery) return;
    const name = formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`);
    confirmAction({
      title: 'Delete Delivery',
      message: `Are you sure you want to delete Delivery #${delivery.id} for "${name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDelivery(delivery.id);
          showAlert('Delivery Deleted', `Delivery #${delivery.id} has been removed.`);
          router.replace('/(tabs)/deliveries');
        } catch (err: any) {
          showAlert('Error', err?.message || 'Failed to delete delivery');
        }
      },
    });
  };

  const handleBillAction = async (action: 'view' | 'print' | 'share' | 'export') => {
    if (!delivery || pdfLoading) return;

    try {
      setPdfLoading(true);

      // Verify product mapping against original 4 rows
      const mapping = await getBillProductMapping();
      const mappingResult = mapDeliveryToBillRows(delivery, mapping);

      if (!mappingResult.canGenerateExactBill) {
        const unmappedNames = mappingResult.unmappedItems
          .map((i) => i.bottle_size_name_snapshot)
          .join(', ');

        const confirmMsg = `This delivery includes items (${unmappedNames}) that are not mapped to the 4 original bill rows (20L Can, 1/2L Water, 1L Water, Bisleri Water).\n\nOnly mapped products will be printed on the CASH/CREDIT bill. Complete quantities and amounts remain recorded in accounting and reports. Do you want to proceed with printing the bill?`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          if (window.confirm(confirmMsg)) {
            await executeBillAction(action, mapping);
          } else {
            setPdfLoading(false);
          }
          return;
        }

        Alert.alert(
          'Bill Product Mapping Notice',
          confirmMsg,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPdfLoading(false) },
            {
              text: 'Proceed',
              onPress: async () => {
                await executeBillAction(action, mapping);
              },
            },
          ]
        );
        return;
      }

      await executeBillAction(action, mapping);
    } catch (err: any) {
      showAppAlert('Bill Generation Error', err.message || 'Could not generate CASH/CREDIT bill.');
      setPdfLoading(false);
    }
  };

  const executeBillAction = async (
    action: 'view' | 'print' | 'share' | 'export',
    mapping: any
  ) => {
    try {
      if (!delivery) return;
      const pdfResult = await generateIndividualBillPdf(delivery, mapping);
      setCachedPdf(pdfResult);

      if (!pdfResult) return;

      switch (action) {
        case 'view':
          setPreviewPdf(pdfResult);
          setPreviewModalVisible(true);
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
      showAppAlert('Action Failed', err.message || 'Unable to complete bill action.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShareReceipt = async () => {
    if (!delivery) return;

    let timeStr = delivery.delivery_date;
    if (delivery.delivered_at) {
      try {
        timeStr += ' at ' + new Date(delivery.delivered_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {}
    }

    const itemsText = (delivery.items || [])
      .map((item) => {
        const vol = item.volume_ml_snapshot
          ? item.volume_ml_snapshot >= 1000
            ? `${(item.volume_ml_snapshot / 1000).toFixed(1).replace(/\.0$/, '')} L`
            : `${item.volume_ml_snapshot} mL`
          : '';
        const price = item.unit_price_snapshot
          ? ` @ ₹${item.unit_price_snapshot.toFixed(2)} = ₹${((item.line_total ?? (item.quantity * item.unit_price_snapshot))).toFixed(2)}`
          : '';
        return `• ${item.bottle_size_name_snapshot} (${vol}): ${item.quantity} pcs${price}`;
      })
      .join('\n');

    const totalVolume = delivery.total_volume_litres ?? ((delivery.total_volume_ml || 0) / 1000);
    const totalAmount = delivery.total_amount ?? 0;

    const receiptContent = `
=================================
       WATERTRACK DELIVERY RECEIPT
=================================
Receipt Ref: #${delivery.id}
Date & Time: ${timeStr}

CUSTOMER DETAILS
Customer: ${formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`)} (${delivery.customer_type || 'Customer'})
Delivery Location: ${delivery.delivery_location}
${delivery.notes ? `Instructions: ${delivery.notes}\n` : ''}
ITEMS DELIVERED:
---------------------------------
${itemsText}
---------------------------------
Total Bottles: ${delivery.total_bottles || 0}
Total Water Volume: ${totalVolume.toFixed(1)} Litres
Total Amount: ₹${totalAmount.toFixed(2)}
=================================
Thank you for your business!
Offline tracking powered by WaterTrack
`.trim();

    try {
      await Share.share({
        message: receiptContent,
        title: `WaterTrack Delivery Receipt #${delivery.id}`,
      });
    } catch (err: any) {
      Alert.alert('Sharing Failed', err.message || 'Unable to share receipt.');
    }
  };

  if (!delivery && !loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title="Delivery Details" showBack />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Delivery record not found or was removed.
          </Text>
          <Button
            title="Back to Deliveries"
            onPress={() => router.replace('/(tabs)/deliveries')}
            variant="outline"
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    );
  }

  let formattedTime = '';
  if (delivery?.delivered_at) {
    try {
      formattedTime = new Date(delivery.delivered_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      formattedTime = delivery.delivered_at;
    }
  }

  const totalVolumeLitres =
    delivery?.total_volume_litres ??
    (delivery?.total_volume_ml ? delivery.total_volume_ml / 1000 : 0);
  const totalAmount = delivery?.total_amount ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title={`Delivery #${delivery?.id || ''}`}
        subtitle={`Bill ${delivery?.bill_number || `WT-${delivery?.id || ''}`} • ${delivery?.delivery_date || ''}`}
        showBack
        onBack={() => router.replace('/(tabs)/deliveries')}
        rightAction={{
          icon: 'share-outline',
          onPress: () => handleBillAction('share'),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {delivery && (
          <>
            {/* Delivery Key Metrics Card */}
            <Card
              style={[
                styles.metricsCard,
                {
                  backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={styles.metricsRow}>
                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: colors.primaryDark }]}>TOTAL BOTTLES</Text>
                  <Text style={[styles.metricVal, { color: colors.text }]}>
                    {delivery.total_bottles || 0}
                  </Text>
                </View>

                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: colors.primaryDark }]}>WATER VOLUME</Text>
                  <Text style={[styles.metricVal, { color: colors.text }]}>
                    {totalVolumeLitres.toFixed(1)} L
                  </Text>
                </View>

                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: colors.primaryDark }]}>TOTAL VALUE</Text>
                  <Text style={[styles.metricVal, { color: colors.primary }]}>
                    ₹{totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Customer Information Card */}
            <Card style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customerName, { color: colors.text }]}>
                    {formatCustomerName(delivery.customer_name, `Customer #${delivery.customer_id}`)}
                  </Text>
                  {delivery.customer_type && (
                    <View style={{ marginTop: 4 }}>
                      <Badge label={delivery.customer_type} type={delivery.customer_type} size="sm" />
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/customer/${delivery.customer_id}`)}
                  style={[
                    styles.viewCustomerBtn,
                    { backgroundColor: isDark ? '#334155' : colors.inputBg },
                  ]}
                >
                  <Text style={[styles.viewCustomerText, { color: colors.primary }]}>
                    Customer Profile
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    Delivery Location
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {delivery.delivery_location}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    Delivered On
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {delivery.delivery_date} {formattedTime ? `at ${formattedTime}` : ''}
                  </Text>
                </View>
              </View>

              {delivery.notes ? (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                      Instructions & Notes
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {delivery.notes}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Card>

            {/* Line Items Table Card */}
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Delivered Water Bottles
              </Text>

              {delivery.items && delivery.items.map((item) => {
                const volText = item.volume_ml_snapshot
                  ? item.volume_ml_snapshot >= 1000
                    ? `${(item.volume_ml_snapshot / 1000).toFixed(1).replace(/\.0$/, '')} L`
                    : `${item.volume_ml_snapshot} mL`
                  : '';
                const itemRate = item.unit_price_snapshot ?? 0;
                const lineTotal = item.line_total ?? (item.quantity * itemRate);

                return (
                  <View
                    key={item.id}
                    style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}
                  >
                    <View style={{ flex: 1.5 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>
                        {item.bottle_size_name_snapshot}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {volText ? (
                          <View style={[styles.volPill, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                            <Text style={[styles.volPillText, { color: colors.textSecondary }]}>{volText}</Text>
                          </View>
                        ) : null}
                        {itemRate > 0 && (
                          <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                            ₹{itemRate.toFixed(2)} each
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', flex: 1 }}>
                      <Text style={[styles.itemQty, { color: colors.text }]}>
                        {item.quantity} bottles
                      </Text>
                      {itemRate > 0 && (
                        <Text style={[styles.itemAmount, { color: colors.primary }]}>
                          ₹{lineTotal.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Total Summary Row */}
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>
                    Total Bottles:
                  </Text>
                  <Text style={[styles.totalSub, { color: colors.textSecondary }]}>
                    {totalVolumeLitres.toFixed(1)} Litres delivered
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.totalValue, { color: colors.primary }]}>
                    {delivery.total_bottles || 0} bottles
                  </Text>
                  <Text style={[styles.totalAmountVal, { color: colors.primary }]}>
                    ₹{totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Official CASH / CREDIT Bill Card */}
            <Card style={styles.billCard}>
              <View style={styles.billCardHeader}>
                <View style={styles.billHeaderRow}>
                  <View style={styles.billHeaderLeft}>
                    <Text style={[styles.billCardTitle, { color: colors.text }]}>
                      CASH / CREDIT Bill
                    </Text>
                    <Text style={[styles.billCardSub, { color: colors.textSecondary }]}>
                      Exact master template · Chandan Gowda. M. K · A4 PDF
                    </Text>
                  </View>
                  <View style={[styles.billNoBadge, { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' }]}>
                    <Text style={[styles.billNoText, { color: colors.primary }]}>
                      {delivery.bill_number || `WT-${delivery.id.toString().padStart(4, '0')}`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4 Primary Bill Action Buttons Grid */}
              <View style={styles.billBtnGrid}>
                <View style={styles.gridBtnCol}>
                  <Button
                    title={pdfLoading ? 'Loading...' : 'View Bill PDF'}
                    icon="eye-outline"
                    variant="primary"
                    size="md"
                    disabled={pdfLoading}
                    onPress={() => handleBillAction('view')}
                  />
                </View>
                <View style={styles.gridBtnCol}>
                  <Button
                    title="Print Bill"
                    icon="print-outline"
                    variant="outline"
                    size="md"
                    disabled={pdfLoading}
                    onPress={() => handleBillAction('print')}
                  />
                </View>
                <View style={styles.gridBtnCol}>
                  <Button
                    title="Share PDF"
                    icon="share-social-outline"
                    variant="outline"
                    size="md"
                    disabled={pdfLoading}
                    onPress={() => handleBillAction('share')}
                  />
                </View>
                <View style={styles.gridBtnCol}>
                  <Button
                    title="Export PDF"
                    icon="download-outline"
                    variant="outline"
                    size="md"
                    disabled={pdfLoading}
                    onPress={() => handleBillAction('export')}
                  />
                </View>
              </View>

              {/* Secondary Option: Plain text receipt */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleShareReceipt}
                style={[styles.shareTextRow, { borderTopColor: colors.borderLight }]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.shareTextLabel, { color: colors.textSecondary }]}>
                  Share plain text summary (WhatsApp / SMS)
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <Button
                title="Edit Delivery"
                icon="create-outline"
                variant="outline"
                onPress={() => router.push(`/delivery/edit?id=${delivery.id}`)}
                style={{ flex: 1, marginRight: 6 }}
                size="lg"
              />
              <Button
                title="Delete"
                icon="trash-outline"
                variant="destructive"
                onPress={handleDelete}
                style={{ flex: 1, marginLeft: 6 }}
                size="lg"
              />
            </View>

            <Button
              title="Back to Deliveries"
              icon="arrow-back"
              variant="outline"
              onPress={() => router.replace('/(tabs)/deliveries')}
              size="lg"
              style={{ marginTop: 4 }}
            />
          </>
        )}
      </ScrollView>

      {/* In-App Bill PDF Preview Modal */}
      <Modal
        visible={previewModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={[styles.previewModalScreen, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.previewModalHeader,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewModalTitle, { color: colors.text }]}>
                {delivery?.bill_number || `WT-${delivery?.id.toString().padStart(4, '0')}`}
              </Text>
              <Text style={[styles.previewModalSub, { color: colors.textSecondary }]}>
                {delivery?.customer_name} • CASH / CREDIT Bill
              </Text>
            </View>

            <View style={styles.previewModalActions}>
              <TouchableOpacity
                onPress={() => previewPdf && printPdfDocument(previewPdf)}
                style={[styles.previewIconBtn, { backgroundColor: colors.primary }]}
                accessibilityLabel="Print Bill"
              >
                <Ionicons name="print-outline" size={16} color="#ffffff" />
                <Text style={styles.previewBtnTextWhite}>Print</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => previewPdf && exportPdfDocument(previewPdf)}
                style={[
                  styles.previewIconBtn,
                  { backgroundColor: isDark ? '#334155' : colors.inputBg },
                ]}
                accessibilityLabel="Download PDF"
              >
                <Ionicons name="download-outline" size={16} color={colors.text} />
                <Text style={[styles.previewBtnText, { color: colors.text }]}>Download</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPreviewModalVisible(false)}
                style={[
                  styles.previewCloseBtn,
                  { backgroundColor: isDark ? '#334155' : colors.inputBg },
                ]}
                accessibilityLabel="Close Preview"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.previewModalBody}>
            {Platform.OS === 'web' && previewPdf?.blobUrl ? (
              // @ts-ignore
              <iframe
                src={previewPdf.blobUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="Bill PDF Preview"
              />
            ) : (
              <View style={styles.previewNativeFallback}>
                <Ionicons name="document-text-outline" size={64} color={colors.primary} />
                <Text style={[styles.previewNativeTitle, { color: colors.text }]}>
                  PDF Bill Ready
                </Text>
                <Text style={[styles.previewNativeSub, { color: colors.textSecondary }]}>
                  {previewPdf?.filename}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <Button
                    title="Print Bill"
                    icon="print-outline"
                    variant="primary"
                    onPress={() => previewPdf && printPdfDocument(previewPdf)}
                  />
                  <Button
                    title="Share / Save"
                    icon="share-social-outline"
                    variant="outline"
                    onPress={() => previewPdf && sharePdfDocument(previewPdf)}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  metricsCard: {
    padding: 14,
    borderWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 32,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  card: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
  },
  viewCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  viewCustomerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  volPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  volPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalAmountVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  billCard: {
    padding: 16,
    gap: 14,
  },
  billCardHeader: {
    marginBottom: 2,
  },
  billHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  billCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  billCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  billNoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  billNoText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  billBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridBtnCol: {
    width: '48.5%',
  },
  shareTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  shareTextLabel: {
    flex: 1,
    fontSize: 12,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  shareSub: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  previewModalScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  previewModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  previewModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  previewModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewCloseBtn: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 4,
  },
  previewBtnTextWhite: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewModalBody: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewNativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewNativeTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  previewNativeSub: {
    fontSize: 13,
    marginTop: 4,
  },
});
