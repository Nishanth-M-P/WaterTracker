import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { GeneratedPdfResult } from '../../services/pdfService';
import { CustomerStatementData } from '../../services/reportingService';

interface CustomerStatementModalProps {
  visible: boolean;
  onClose: () => void;
  statementData: CustomerStatementData | null;
  pdfResult: GeneratedPdfResult | null;
  onPrint: () => void;
  onShare: () => void;
  isLoading?: boolean;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  visible,
  onClose,
  statementData,
  pdfResult,
  onPrint,
  onShare,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 520;
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.15, 1.8));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.15, 0.6));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  const previewHtml = pdfResult?.html || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Header Toolbar */}
        {isNarrow ? (
          <View
            style={[
              styles.mobileHeaderContainer,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {/* Top Row: Close Button & Title */}
            <View style={styles.mobileHeaderTop}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.iconBtn,
                  { backgroundColor: isDark ? '#334155' : '#f1f5f9' },
                ]}
                accessibilityLabel="Close statement"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.titleColumn}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  Customer Statement
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {statementData?.customer.name || 'Client'} • {statementData?.periodLabel || 'All Time'}
                </Text>
              </View>
            </View>

            {/* Bottom Row: Actions Bar */}
            <View style={styles.mobileActionsRow}>
              {/* Zoom Controls */}
              <View
                style={[
                  styles.zoomGroup,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border },
                ]}
              >
                <TouchableOpacity onPress={handleZoomOut} style={styles.zoomBtn} accessibilityLabel="Zoom Out">
                  <Ionicons name="remove" size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResetZoom} style={styles.zoomLevelBtn} accessibilityLabel="Reset Zoom">
                  <Text style={[styles.zoomText, { color: colors.text }]}>{Math.round(zoomLevel * 100)}%</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleZoomIn} style={styles.zoomBtn} accessibilityLabel="Zoom In">
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Print Statement */}
              <TouchableOpacity
                onPress={onPrint}
                style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: colors.border }]}
                accessibilityLabel="Print Statement"
              >
                <Ionicons name="print-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Print</Text>
              </TouchableOpacity>

              {/* Share / Export */}
              <TouchableOpacity
                onPress={onShare}
                style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
                accessibilityLabel="Share PDF"
              >
                <Ionicons name="share-social-outline" size={16} color="#ffffff" />
                <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Share PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.iconBtn,
                  { backgroundColor: isDark ? '#334155' : '#f1f5f9' },
                ]}
                accessibilityLabel="Close statement"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.titleColumn}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  Customer Statement: {statementData?.customer.name}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  Ref: {statementData?.statementReference || 'CDS'} • Period: {statementData?.periodLabel || 'All Time'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.headerActions}>
              {/* Zoom Controls */}
              <View
                style={[
                  styles.zoomGroup,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border },
                ]}
              >
                <TouchableOpacity onPress={handleZoomOut} style={styles.zoomBtn} accessibilityLabel="Zoom Out">
                  <Ionicons name="remove" size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResetZoom} style={styles.zoomLevelBtn} accessibilityLabel="Reset Zoom">
                  <Text style={[styles.zoomText, { color: colors.text }]}>{Math.round(zoomLevel * 100)}%</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleZoomIn} style={styles.zoomBtn} accessibilityLabel="Zoom In">
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Print Statement */}
              <TouchableOpacity
                onPress={onPrint}
                style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: colors.border }]}
                accessibilityLabel="Print Statement"
              >
                <Ionicons name="print-outline" size={17} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Print</Text>
              </TouchableOpacity>

              {/* Share / Export */}
              <TouchableOpacity
                onPress={onShare}
                style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
                accessibilityLabel="Share PDF"
              >
                <Ionicons name="share-social-outline" size={17} color="#ffffff" />
                <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Share PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Content Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Compiling customer delivery statement...
            </Text>
          </View>
        ) : Platform.OS === 'web' && previewHtml ? (
          <View style={styles.webPreviewWrapper}>
            <View
              style={[
                styles.webDocContainer,
                {
                  flex: 1,
                  height: '100%',
                  transform: [{ scale: zoomLevel }],
                  transformOrigin: 'top center',
                },
              ]}
            >
              {React.createElement('iframe', {
                srcDoc: previewHtml,
                title: 'WaterTrack Customer Delivery Statement',
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'transparent',
                },
              })}
            </View>
          </View>
        ) : (
          /* Native fallback document view */
          <ScrollView
            style={styles.nativeScroll}
            contentContainerStyle={styles.nativeContent}
            showsVerticalScrollIndicator={true}
          >
            {statementData && (
              <View
                style={[
                  styles.nativeDocumentSheet,
                  {
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    transform: [{ scale: zoomLevel }],
                    transformOrigin: 'top center',
                  },
                ]}
              >
                {/* Master Header */}
                <View style={styles.docHeader}>
                  <Text style={styles.bizName}>CHANDAN GOWDA. M. K</Text>
                  <Text style={styles.bizDesc}>MINERAL WATER DEALERS</Text>
                  <Text style={styles.bizAddress}>#12, 2ND Cross, Janatha Colony, Mysore Road, Bengaluru- 560 026</Text>
                  <Text style={styles.bizPhone}>Phone: 9110837787</Text>
                </View>

                {/* Statement Title */}
                <View style={styles.docTitleBar}>
                  <Text style={styles.docTitle}>CUSTOMER DELIVERY STATEMENT</Text>
                </View>

                {/* Customer & Document Metadata Box */}
                <View style={styles.custMetaBox}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.custName}>M/s. {statementData.customer.name}</Text>
                    <Text style={styles.custInfoLine}>Type: {statementData.customer.customerType}</Text>
                    <Text style={styles.custInfoLine}>
                      Address: {statementData.customer.address || 'Address not specified'}
                    </Text>
                    {statementData.customer.phone && (
                      <Text style={styles.custInfoLine}>Phone: {statementData.customer.phone}</Text>
                    )}
                  </View>
                  <View style={{ flex: 0.9, alignItems: 'flex-end' }}>
                    <Text style={styles.metaLine}>
                      <Text style={{ fontWeight: '700' }}>Ref:</Text> {statementData.statementReference}
                    </Text>
                    <Text style={styles.metaLine}>
                      <Text style={{ fontWeight: '700' }}>Period:</Text> {statementData.periodLabel}
                    </Text>
                    <Text style={styles.metaLine}>
                      <Text style={{ fontWeight: '700' }}>Date:</Text> {statementData.generatedAt}
                    </Text>
                  </View>
                </View>

                {/* Horizontal Scroll Table for Native */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={{ minWidth: 540, flexDirection: 'column' }}
                >
                  {/* Table Header */}
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, { width: 28, textAlign: 'center' }]}>SL</Text>
                    <Text style={[styles.th, { width: 78 }]}>Date</Text>
                    <Text style={[styles.th, { width: 68 }]}>Ref No</Text>
                    <Text style={[styles.th, { flex: 1.5 }]}>Product</Text>
                    <Text style={[styles.th, { width: 44, textAlign: 'center' }]}>Vol</Text>
                    <Text style={[styles.th, { width: 38, textAlign: 'center' }]}>Qty</Text>
                    <Text style={[styles.th, { width: 56, textAlign: 'right' }]}>Rate</Text>
                    <Text style={[styles.th, { width: 68, textAlign: 'right' }]}>Amount</Text>
                  </View>

                  {/* Rows */}
                  {statementData.deliveries.length === 0 ? (
                    <View style={styles.emptyTableState}>
                      <Text style={styles.emptyTableText}>
                        No delivery records found for this customer during the selected period.
                      </Text>
                    </View>
                  ) : (
                    statementData.deliveries.map((del, dIdx) => {
                      const dateDisplay = del.deliveryDate.split('-').reverse().join('/');
                      return (
                        <View key={`del-${del.deliveryId}`}>
                          {del.items.map((item, iIdx) => (
                            <View
                              key={`item-${item.id}`}
                              style={[
                                styles.tableRow,
                                (dIdx + iIdx) % 2 === 1 && { backgroundColor: '#f8fafc' },
                              ]}
                            >
                              <Text style={[styles.td, { width: 28, textAlign: 'center', color: '#64748b' }]}>
                                {dIdx + 1}.{iIdx + 1}
                              </Text>
                              <Text style={[styles.td, { width: 78, fontSize: 8.5 }]}>
                                {iIdx === 0 ? dateDisplay : ' " '}
                              </Text>
                              <Text style={[styles.td, { width: 68, fontWeight: '700', color: '#0f2c59', fontSize: 8.5 }]}>
                                {iIdx === 0 ? del.billNumber : ' " '}
                              </Text>
                              <Text style={[styles.td, { flex: 1.5, fontWeight: '600', color: '#0f172a' }]} numberOfLines={1}>
                                {item.productName}
                              </Text>
                              <Text style={[styles.td, { width: 44, textAlign: 'center', color: '#475569', fontSize: 8.5 }]}>
                                {item.volumeDisplay}
                              </Text>
                              <Text style={[styles.td, { width: 38, textAlign: 'center', fontWeight: '700' }]}>
                                {item.quantity}
                              </Text>
                              <Text style={[styles.td, { width: 56, textAlign: 'right', fontSize: 9 }]}>
                                ₹{item.unitPrice.toFixed(2)}
                              </Text>
                              <Text style={[styles.td, { width: 68, textAlign: 'right', fontWeight: '700', color: '#0f2c59' }]}>
                                ₹{item.lineTotal.toFixed(2)}
                              </Text>
                            </View>
                          ))}

                          {/* Subtotal row */}
                          <View style={styles.deliverySubtotalRow}>
                            <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: '700', color: '#334155', paddingRight: 6 }]}>
                              Subtotal ({del.billNumber}):
                            </Text>
                            <Text style={[styles.td, { width: 38, textAlign: 'center', fontWeight: '800', color: '#0f172a' }]}>
                              ${del.deliveryBottles}
                            </Text>
                            <View style={{ width: 56 }} />
                            <Text style={[styles.td, { width: 68, textAlign: 'right', fontWeight: '800', color: '#0f2c59' }]}>
                              ₹{del.deliveryAmount.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Grand Total Row */}
                  <View style={styles.totalsMatrixRow}>
                    <Text style={[styles.td, { flex: 1, fontWeight: '800', color: '#0f172a', textAlign: 'right', paddingRight: 6 }]}>
                      STATEMENT GRAND TOTAL ({statementData.totalDeliveries} Deliveries):
                    </Text>
                    <Text style={[styles.td, { width: 38, textAlign: 'center', fontWeight: '900', color: '#0f172a' }]}>
                      {statementData.totalBottles}
                    </Text>
                    <View style={{ width: 56 }} />
                    <Text style={[styles.td, { width: 68, textAlign: 'right', fontWeight: '900', color: '#0f2c59' }]}>
                      ₹{statementData.grandTotalAmount.toFixed(2)}
                    </Text>
                  </View>
                </ScrollView>

                {/* Final Customer Totals Summary Card */}
                <View style={styles.grandSummaryBox}>
                  <Text style={styles.grandSummaryTitle}>Customer Account Statement Summary</Text>
                  <View style={styles.summaryStatsRow}>
                    <View style={styles.summaryStatItem}>
                      <Text style={styles.summaryStatLbl}>Deliveries</Text>
                      <Text style={styles.summaryStatVal}>{statementData.totalDeliveries}</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <Text style={styles.summaryStatLbl}>Total Bottles</Text>
                      <Text style={styles.summaryStatVal}>{statementData.totalBottles}</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <Text style={styles.summaryStatLbl}>Water Volume</Text>
                      <Text style={styles.summaryStatVal}>{statementData.totalVolumeLitres.toFixed(1)} L</Text>
                    </View>
                    <View style={[styles.summaryStatItem, { alignItems: 'flex-end' }]}>
                      <Text style={styles.summaryStatLbl}>Grand Total</Text>
                      <Text style={[styles.summaryStatVal, { color: '#0f2c59', fontWeight: '900', fontSize: 13.5 }]}>
                        ₹{statementData.grandTotalAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Bottle breakdown */}
                  {statementData.bottleTotals.length > 0 && (
                    <View style={styles.bottleTotalsWrap}>
                      {statementData.bottleTotals.map((b) => (
                        <Text key={b.bottleSizeId} style={styles.bottlePillText}>
                          <Text style={{ fontWeight: '700' }}>{b.name}:</Text> {b.quantity} bottles (₹{b.amount.toFixed(2)})
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.wordsRow}>
                    <Text style={styles.wordsLabel}>Amount in Words:</Text>
                    <Text style={styles.wordsText}>{statementData.grandTotalInWords}</Text>
                  </View>
                </View>

                {/* Authorised Signatory */}
                <View style={styles.signatorySection}>
                  <Text style={styles.watermarkText}>
                    WaterTrack Accounting &bull; Generated: {statementData.generatedAt}
                  </Text>
                  <View style={styles.signatoryLine}>
                    <Text style={styles.signatoryTitle}>Authorised Signatory</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mobileHeaderContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  mobileHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    height: 34,
  },
  zoomBtn: {
    paddingHorizontal: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLevelBtn: {
    paddingHorizontal: 6,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
  },
  actionBtnSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  actionBtnPrimary: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  webPreviewWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    overflow: 'auto' as any,
  },
  webDocContainer: {
    width: '100%',
    maxWidth: 880,
  },
  nativeScroll: {
    flex: 1,
  },
  nativeContent: {
    alignItems: 'center',
    padding: 14,
    paddingBottom: 40,
  },
  nativeDocumentSheet: {
    width: '100%',
    maxWidth: 800,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  docHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0f2c59',
    paddingBottom: 8,
    marginBottom: 10,
  },
  bizName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f2c59',
    letterSpacing: 0.5,
  },
  bizDesc: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  bizAddress: {
    fontSize: 8.5,
    color: '#334155',
    marginTop: 2,
  },
  bizPhone: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f2c59',
    marginTop: 2,
  },
  docTitleBar: {
    backgroundColor: '#0f2c59',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  docTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  custMetaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  custName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  custInfoLine: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 1,
  },
  metaLine: {
    fontSize: 8.5,
    color: '#334155',
    marginBottom: 2,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderBottomWidth: 1.5,
    borderColor: '#0f2c59',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  deliverySubtotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  td: {
    fontSize: 9.5,
    color: '#1e293b',
  },
  totalsMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#0f2c59',
  },
  emptyTableState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  grandSummaryBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#0f2c59',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
  },
  grandSummaryTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f2c59',
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryStatItem: {
    flex: 1,
  },
  summaryStatLbl: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryStatVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  bottleTotalsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    marginBottom: 4,
  },
  bottlePillText: {
    fontSize: 8.5,
    color: '#334155',
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
    marginTop: 4,
  },
  wordsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 4,
  },
  wordsText: {
    fontSize: 9,
    color: '#0f2c59',
    fontWeight: '700',
    flex: 1,
  },
  signatorySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    paddingTop: 6,
  },
  watermarkText: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  signatoryLine: {
    width: 150,
    borderTopWidth: 1.5,
    borderTopColor: '#0f172a',
    paddingTop: 4,
    alignItems: 'center',
  },
  signatoryTitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
});
