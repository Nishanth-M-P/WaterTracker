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
import { ConsolidatedReportData } from '../../services/reportingService';

interface PdfPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  reportData: ConsolidatedReportData | null;
  pdfResult: GeneratedPdfResult | null;
  onPrint: () => void;
  onShare: () => void;
  onExportCsv: () => void;
  isLoading?: boolean;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  visible,
  onClose,
  reportData,
  pdfResult,
  onPrint,
  onShare,
  onExportCsv,
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

  const displayBottleSizes = reportData?.bottleSizes || [];

  // Render modal
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
        {/* Top Navigation & Action Toolbar */}
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
                accessibilityLabel="Close preview"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.titleColumn}>
                <Text style={[styles.headerTitle, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>
                  Water Distribution Statement
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                  {reportData?.periodLabel || 'Consolidated Report'} • Ref: {reportData?.reportReference || 'WT'}
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

              {/* Print */}
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
                <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Share</Text>
              </TouchableOpacity>

              {/* CSV Export */}
              <TouchableOpacity
                onPress={onExportCsv}
                style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: colors.border }]}
                accessibilityLabel="Download CSV"
              >
                <Ionicons name="grid-outline" size={15} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>CSV</Text>
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
                accessibilityLabel="Close preview"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.titleColumn}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  Water Distribution Statement
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {reportData?.periodLabel || 'Consolidated Report'} • Ref: {reportData?.reportReference || 'WT'}
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

              {/* Print */}
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

              {/* CSV Export */}
              <TouchableOpacity
                onPress={onExportCsv}
                style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: colors.border }]}
                accessibilityLabel="Download CSV"
              >
                <Ionicons name="grid-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>CSV</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Content Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Compiling official distribution statement...
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
                title: 'WaterTrack Consolidated Statement Preview',
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
            {reportData && (
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
                {/* Master Template Business Header */}
                <View style={styles.docHeader}>
                  <Text style={styles.bizName}>CHANDAN GOWDA. M. K</Text>
                  <Text style={styles.bizDesc}>MINERAL WATER DEALERS</Text>
                  <Text style={styles.bizAddress}>#12, 2ND Cross, Janatha Colony, Mysore Road, Bengaluru- 560 026</Text>
                  <Text style={styles.bizPhone}>Phone: 9110837787</Text>
                </View>

                {/* Report Title Bar */}
                <View style={styles.docTitleBar}>
                  <Text style={styles.docTitle}>WATER DISTRIBUTION STATEMENT</Text>
                  <View style={styles.docMetaRow}>
                    <Text style={styles.docMetaText}>
                      <Text style={{ fontWeight: '700' }}>Period:</Text> {reportData.periodLabel}
                    </Text>
                    <Text style={styles.docMetaText}>
                      <Text style={{ fontWeight: '700' }}>Ref:</Text> {reportData.reportReference}
                    </Text>
                  </View>
                </View>

                {/* Horizontal Scroll Container for Matrix Table */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={styles.nativeTableScrollContent}
                  style={styles.nativeTableScroll}
                >
                  <View style={{ minWidth: 540 }}>
                    {/* Matrix Delivery Table Header */}
                    <View style={styles.tableHead}>
                      <Text style={[styles.th, { width: 28, textAlign: 'center' }]}>SL</Text>
                      <Text style={[styles.th, { width: 68 }]}>Bill No</Text>
                      <Text style={[styles.th, { flex: 1.5 }]}>Customer / Location</Text>
                      {displayBottleSizes.map((b) => (
                        <Text key={b.id} style={[styles.th, { width: 44, textAlign: 'center' }]} numberOfLines={1}>
                          {b.name}
                        </Text>
                      ))}
                      <Text style={[styles.th, { width: 38, textAlign: 'right' }]}>Qty</Text>
                      <Text style={[styles.th, { width: 62, textAlign: 'right' }]}>Amount</Text>
                    </View>

                    {/* Deliveries Rows */}
                    {reportData.deliveries.length === 0 ? (
                      <View style={styles.emptyTableState}>
                        <Text style={styles.emptyTableText}>No delivery records found for this period.</Text>
                      </View>
                    ) : (
                      reportData.deliveries.map((del, dIdx) => {
                        const isAlt = dIdx % 2 === 1;
                        const dateFormatted = del.deliveryDate.split('-').reverse().join('/');
                        const timePart = del.deliveredAt ? del.deliveredAt.split('T')[1]?.substring(0, 5) || '' : '';

                        return (
                          <View
                            key={`del-${del.deliveryId}`}
                            style={[
                              styles.tableRow,
                              isAlt && { backgroundColor: '#f8fafc' },
                            ]}
                          >
                            <Text style={[styles.td, { width: 28, textAlign: 'center', color: '#64748b' }]}>
                              {dIdx + 1}
                            </Text>
                            <View style={{ width: 68 }}>
                              <Text style={[styles.td, { fontWeight: '700', color: '#0f2c59', fontSize: 9 }]}>
                                {del.billNumber}
                              </Text>
                              <Text style={{ fontSize: 7.5, color: '#64748b' }}>
                                {dateFormatted}{timePart ? ` ${timePart}` : ''}
                              </Text>
                            </View>
                            <View style={{ flex: 1.5 }}>
                              <Text style={[styles.td, { fontWeight: '700', color: '#0f172a' }]} numberOfLines={1}>
                                {del.customerName}
                              </Text>
                              {del.deliveryLocation ? (
                                <Text style={{ fontSize: 8, color: '#475569' }} numberOfLines={1}>
                                  {del.deliveryLocation}
                                </Text>
                              ) : null}
                            </View>
                            {displayBottleSizes.map((b) => {
                              const q = del.quantitiesByBottleId[b.id] || 0;
                              return (
                                <Text
                                  key={`qty-${del.deliveryId}-${b.id}`}
                                  style={[
                                    styles.td,
                                    {
                                      width: 44,
                                      textAlign: 'center',
                                      fontWeight: q > 0 ? '700' : '400',
                                      color: q > 0 ? '#0f172a' : '#cbd5e1',
                                    },
                                  ]}
                                >
                                  {q > 0 ? q : '—'}
                                </Text>
                              );
                            })}
                            <Text style={[styles.td, { width: 38, textAlign: 'right', fontWeight: '800' }]}>
                              {del.totalBottles}
                            </Text>
                            <Text style={[styles.td, { width: 62, textAlign: 'right', fontWeight: '800', color: '#0f2c59' }]}>
                              ₹{del.totalAmount.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })
                    )}

                    {/* Column Totals Row */}
                    {reportData.deliveries.length > 0 && (
                      <View style={styles.totalsMatrixRow}>
                        <Text style={[styles.td, { flex: 1, fontWeight: '800', color: '#0f172a', textAlign: 'right', paddingRight: 6 }]}>
                          TOTALS ({reportData.totalDeliveries} Del, {reportData.uniqueCustomerCount} Cust)
                        </Text>
                        {displayBottleSizes.map((b) => {
                          const tot = reportData.productTotals[b.id]?.quantity || 0;
                          return (
                            <Text
                              key={`tot-${b.id}`}
                              style={[styles.td, { width: 44, textAlign: 'center', fontWeight: '800', color: '#0f172a' }]}
                            >
                              {tot > 0 ? tot : '—'}
                            </Text>
                          );
                        })}
                        <Text style={[styles.td, { width: 38, textAlign: 'right', fontWeight: '900', color: '#0f172a' }]}>
                          {reportData.totalBottles}
                        </Text>
                        <Text style={[styles.td, { width: 62, textAlign: 'right', fontWeight: '900', color: '#0f2c59' }]}>
                          ₹{reportData.grandTotalAmount.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                {/* Grand Total Summary Box */}
                {reportData && (
                  <View style={styles.grandSummaryBox}>
                    <Text style={styles.grandSummaryTitle}>Grand Total Summary</Text>
                    <View style={styles.summaryStatsRow}>
                      <View style={styles.summaryStatItem}>
                        <Text style={styles.summaryStatLbl}>Customers</Text>
                        <Text style={styles.summaryStatVal}>{reportData.uniqueCustomerCount}</Text>
                      </View>
                      <View style={styles.summaryStatItem}>
                        <Text style={styles.summaryStatLbl}>Deliveries</Text>
                        <Text style={styles.summaryStatVal}>{reportData.totalDeliveries}</Text>
                      </View>
                      <View style={styles.summaryStatItem}>
                        <Text style={styles.summaryStatLbl}>Containers</Text>
                        <Text style={styles.summaryStatVal}>{reportData.totalBottles}</Text>
                      </View>
                      <View style={styles.summaryStatItem}>
                        <Text style={styles.summaryStatLbl}>Total Volume</Text>
                        <Text style={styles.summaryStatVal}>{reportData.totalVolumeLitres.toFixed(1)} L</Text>
                      </View>
                      <View style={[styles.summaryStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={styles.summaryStatLbl}>Grand Total</Text>
                        <Text style={[styles.summaryStatVal, { color: '#0f172a', fontWeight: '900' }]}>
                          ₹{reportData.grandTotalAmount.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.wordsRow}>
                      <Text style={styles.wordsLabel}>Amount in Words:</Text>
                      <Text style={styles.wordsText}>{reportData.grandTotalInWords}</Text>
                    </View>
                  </View>
                )}

                {/* Signatory */}
                <View style={styles.signatorySection}>
                  <Text style={styles.watermarkText}>
                    WaterTrack Offline Distribution Accounting System
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
  nativeTableScroll: {
    width: '100%',
    marginVertical: 4,
  },
  nativeTableScrollContent: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 200,
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
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
  },
  webScrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
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
    padding: 16,
    paddingBottom: 40,
  },
  nativeDocumentSheet: {
    width: '100%',
    maxWidth: 800,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  docHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 10,
    marginBottom: 12,
  },
  bizName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  bizDesc: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  bizAddress: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  bizPhone: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 3,
  },
  docTitleBar: {
    backgroundColor: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  docTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  docMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  docMetaText: {
    color: '#f8fafc',
    fontSize: 9.5,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderBottomWidth: 1.5,
    borderColor: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  customerBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  td: {
    fontSize: 10.5,
    color: '#1e293b',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
  subtotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  subtotalVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalsMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
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
    borderColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    marginTop: 14,
  },
  grandSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryStatItem: {
    flex: 1,
  },
  summaryStatLbl: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryStatVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
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
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 4,
  },
  wordsText: {
    fontSize: 9.5,
    color: '#1e293b',
    fontWeight: '700',
    flex: 1,
  },
  signatorySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    paddingTop: 8,
  },
  watermarkText: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  signatoryLine: {
    width: 160,
    borderTopWidth: 1.5,
    borderTopColor: '#0f172a',
    paddingTop: 4,
    alignItems: 'center',
  },
  signatoryTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
});
