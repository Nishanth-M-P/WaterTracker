import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  formatLocalDate,
  parseLocalDate,
  getTodayDate,
  getYesterdayDate,
  getDayBeforeYesterdayDate,
  getThisWeekRange,
  getThisMonthRange,
  getWeekRangeForDate,
  getMonthRangeForYearMonth,
  formatDisplayDate,
} from '../../services/reportingService';
import { PresetRangeType } from '../calendar/DateRangePicker';

interface DeliveryReportToolbarProps {
  startDate: string;
  endDate: string;
  activePreset: PresetRangeType;
  onRangeChange: (start: string, end: string, preset?: PresetRangeType) => void;
  onPreviewPdf: () => void;
  onPrint: () => void;
  onSharePdf: () => void;
  onExportCsv: () => void;
  isGenerating?: boolean;
  recordCount: number;
}

export const DeliveryReportToolbar: React.FC<DeliveryReportToolbarProps> = ({
  startDate,
  endDate,
  activePreset,
  onRangeChange,
  onPreviewPdf,
  onPrint,
  onSharePdf,
  onExportCsv,
  isGenerating = false,
  recordCount,
}) => {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 500;

  // Custom calendar modal state
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseLocalDate(startDate || getTodayDate()));
  const [tempStart, setTempStart] = useState<string>(startDate || getTodayDate());
  const [tempEnd, setTempEnd] = useState<string>(endDate || getTodayDate());

  const presets: { id: PresetRangeType; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'day_before_yesterday', label: 'Day Before Yesterday' },
    { id: 'this_week', label: 'Weekly' },
    { id: 'this_month', label: 'Monthly' },
    { id: 'custom', label: 'Custom Date' },
  ];

  const handleSelectPreset = (id: PresetRangeType) => {
    if (id === 'today') {
      const today = getTodayDate();
      onRangeChange(today, today, 'today');
    } else if (id === 'yesterday') {
      const yest = getYesterdayDate();
      onRangeChange(yest, yest, 'yesterday');
    } else if (id === 'day_before_yesterday') {
      const dby = getDayBeforeYesterdayDate();
      onRangeChange(dby, dby, 'day_before_yesterday');
    } else if (id === 'this_week' || id === 'last_week') {
      const w = getThisWeekRange('monday');
      onRangeChange(w.start, w.end, 'this_week');
    } else if (id === 'this_month' || id === 'last_month') {
      const m = getThisMonthRange();
      onRangeChange(m.start, m.end, 'this_month');
    } else if (id === 'custom') {
      setTempStart(startDate);
      setTempEnd(endDate);
      setViewDate(parseLocalDate(startDate));
      setCalendarModalVisible(true);
    }
  };

  // Week navigation
  const handlePrevWeek = () => {
    const curr = parseLocalDate(startDate);
    curr.setDate(curr.getDate() - 7);
    const w = getWeekRangeForDate(curr, 'monday');
    onRangeChange(w.start, w.end, 'this_week');
  };

  const handleNextWeek = () => {
    const curr = parseLocalDate(startDate);
    curr.setDate(curr.getDate() + 7);
    const w = getWeekRangeForDate(curr, 'monday');
    onRangeChange(w.start, w.end, 'this_week');
  };

  // Month navigation
  const handlePrevMonth = () => {
    const curr = parseLocalDate(startDate);
    const prev = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
    const m = getMonthRangeForYearMonth(prev.getFullYear(), prev.getMonth());
    onRangeChange(m.start, m.end, 'this_month');
  };

  const handleNextMonth = () => {
    const curr = parseLocalDate(startDate);
    const next = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
    const m = getMonthRangeForYearMonth(next.getFullYear(), next.getMonth());
    onRangeChange(m.start, m.end, 'this_month');
  };

  // Calendar Day Selection Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const handleDayPress = (dayNum: number) => {
    const selected = formatLocalDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum));

    if (!tempStart || (tempStart && tempEnd && tempStart !== tempEnd)) {
      setTempStart(selected);
      setTempEnd(selected);
    } else if (tempStart && tempStart === tempEnd) {
      if (selected < tempStart) {
        setTempStart(selected);
        setTempEnd(selected);
      } else {
        setTempEnd(selected);
      }
    }
  };

  const handleApplyCustomRange = () => {
    if (tempEnd < tempStart) {
      onRangeChange(tempStart, tempStart, 'custom');
    } else {
      onRangeChange(tempStart, tempEnd, 'custom');
    }
    setCalendarModalVisible(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const calYear = viewDate.getFullYear();
  const calMonth = viewDate.getMonth();
  const totalDays = daysInMonth(calYear, calMonth);
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Determine current period display text
  const isWeekly = activePreset === 'this_week' || activePreset === 'last_week';
  const isMonthly = activePreset === 'this_month' || activePreset === 'last_month';
  const isCustom = activePreset === 'custom';

  let periodNavLabel = '';
  if (isWeekly) {
    periodNavLabel = `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
  } else if (isMonthly) {
    const d = parseLocalDate(startDate);
    periodNavLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  } else if (isCustom) {
    periodNavLabel = startDate === endDate ? formatDisplayDate(startDate) : `${formatDisplayDate(startDate)} ➔ ${formatDisplayDate(endDate)}`;
  } else {
    periodNavLabel = formatDisplayDate(startDate);
  }

  return (
    <View style={styles.container}>
      {/* 1. Preset Filter Pills Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsList}
      >
        {presets.map((preset) => {
          const isActive =
            activePreset === preset.id ||
            (preset.id === 'this_week' && activePreset === 'last_week') ||
            (preset.id === 'this_month' && activePreset === 'last_month');

          return (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.7}
              onPress={() => handleSelectPreset(preset.id)}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isActive ? colors.primary : isDark ? '#1e293b' : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color: isActive ? '#ffffff' : colors.textSecondary,
                    fontWeight: isActive ? '700' : '600',
                  },
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. Interactive Period Navigator Row */}
      <View
        style={[
          styles.periodNavigatorBar,
          {
            backgroundColor: isDark ? '#1e293b' : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {isWeekly ? (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handlePrevWeek} style={styles.navArrowBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
              <Text style={[styles.navArrowText, { color: colors.primary }]}>Prev Week</Text>
            </TouchableOpacity>

            <View style={styles.navCenter}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.navCenterText, { color: colors.text }]} numberOfLines={1}>
                {periodNavLabel}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextWeek} style={styles.navArrowBtn}>
              <Text style={[styles.navArrowText, { color: colors.primary }]}>Next Week</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : isMonthly ? (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
              <Text style={[styles.navArrowText, { color: colors.primary }]}>Prev Month</Text>
            </TouchableOpacity>

            <View style={styles.navCenter}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.navCenterText, { color: colors.text }]} numberOfLines={1}>
                {periodNavLabel}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
              <Text style={[styles.navArrowText, { color: colors.primary }]}>Next Month</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setTempStart(startDate);
              setTempEnd(endDate);
              setViewDate(parseLocalDate(startDate));
              setCalendarModalVisible(true);
            }}
            style={styles.dateDisplayRow}
          >
            <View style={styles.dateLabelRow}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.dateDisplayText, { color: colors.text }]}>
                {periodNavLabel}
              </Text>
            </View>

            <View style={styles.changeDatePill}>
              <Text style={[styles.changeDateText, { color: colors.primary }]}>
                {isCustom ? 'Change Range' : 'Calendar'}
              </Text>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Official Report Action Toolbar Buttons */}
      {isMobile ? (
        <View style={styles.reportActionsMobile}>
          <View style={styles.reportActionsMobileRow}>
            {/* Preview PDF */}
            <TouchableOpacity
              onPress={onPreviewPdf}
              disabled={isGenerating}
              activeOpacity={0.8}
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary, flex: 1, height: 42 }]}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="document-text-outline" size={17} color="#ffffff" />
              )}
              <Text style={styles.primaryActionText}>Preview PDF</Text>
            </TouchableOpacity>

            {/* Export / Share PDF */}
            <TouchableOpacity
              onPress={onSharePdf}
              disabled={isGenerating}
              activeOpacity={0.7}
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, height: 42 },
              ]}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Share PDF</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reportActionsMobileRow}>
            {/* Print */}
            <TouchableOpacity
              onPress={onPrint}
              disabled={isGenerating}
              activeOpacity={0.7}
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, height: 40 },
              ]}
            >
              <Ionicons name="print-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Print</Text>
            </TouchableOpacity>

            {/* Export CSV */}
            <TouchableOpacity
              onPress={onExportCsv}
              disabled={isGenerating}
              activeOpacity={0.7}
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, height: 40 },
              ]}
            >
              <Ionicons name="download-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>CSV Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.reportActionsRow}>
          {/* Preview PDF */}
          <TouchableOpacity
            onPress={onPreviewPdf}
            disabled={isGenerating}
            activeOpacity={0.8}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="document-text-outline" size={17} color="#ffffff" />
            )}
            <Text style={styles.primaryActionText}>Preview PDF</Text>
          </TouchableOpacity>

          {/* Print */}
          <TouchableOpacity
            onPress={onPrint}
            disabled={isGenerating}
            activeOpacity={0.7}
            style={[
              styles.secondaryActionBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="print-outline" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Print</Text>
          </TouchableOpacity>

          {/* Export / Share PDF */}
          <TouchableOpacity
            onPress={onSharePdf}
            disabled={isGenerating}
            activeOpacity={0.7}
            style={[
              styles.secondaryActionBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Share PDF</Text>
          </TouchableOpacity>

          {/* Export CSV */}
          <TouchableOpacity
            onPress={onExportCsv}
            disabled={isGenerating}
            activeOpacity={0.7}
            style={[
              styles.secondaryActionBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="download-outline" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Calendar Picker Modal */}
      <Modal
        visible={calendarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarModalVisible(false)}
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
            {/* Header */}
            <View style={styles.calHeader}>
              <TouchableOpacity
                onPress={() => setViewDate(new Date(calYear, calMonth - 1, 1))}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.calMonthTitle, { color: colors.text }]}>
                {monthNames[calMonth]} {calYear}
              </Text>
              <TouchableOpacity
                onPress={() => setViewDate(new Date(calYear, calMonth + 1, 1))}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekLabelsRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <Text key={day} style={[styles.weekLabelText, { color: colors.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.daysGrid}>
              {Array.from({ length: startOffset }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.emptyDayCell} />
              ))}

              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const dStr = formatLocalDate(new Date(calYear, calMonth, day));
                const isStart = dStr === tempStart;
                const isEnd = dStr === tempEnd;
                const inRange = tempStart && tempEnd && dStr >= tempStart && dStr <= tempEnd;

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    onPress={() => handleDayPress(day)}
                    style={[
                      styles.dayCell,
                      inRange && {
                        backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe',
                      },
                      (isStart || isEnd) && {
                        backgroundColor: colors.primary,
                        borderRadius: 20,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.text },
                        inRange && { color: colors.primary, fontWeight: '700' },
                        (isStart || isEnd) && { color: '#ffffff', fontWeight: '800' },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Range Display in Modal */}
            <View style={[styles.modalSelectionSummary, { borderColor: colors.borderLight }]}>
              <Text style={[styles.selectionLabel, { color: colors.textSecondary }]}>
                Selected: <Text style={{ color: colors.text, fontWeight: '700' }}>{tempStart}</Text>
                {tempEnd && tempEnd !== tempStart ? (
                  <>
                    {' ➔ '}
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{tempEnd}</Text>
                  </>
                ) : null}
              </Text>
            </View>

            {/* Footer Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setCalendarModalVisible(false)}
                style={[styles.modalFooterBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalFooterBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApplyCustomRange}
                style={[
                  styles.modalFooterBtn,
                  styles.modalApplyBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.modalFooterBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                  Apply Range
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  presetsList: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 12.5,
  },
  periodNavigatorBar: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navArrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  navArrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  navCenterText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  dateDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateDisplayText: {
    fontSize: 13,
    fontWeight: '700',
  },
  changeDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportActionsMobile: {
    paddingHorizontal: 16,
    gap: 8,
  },
  reportActionsMobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    padding: 6,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekLabelsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDayCell: {
    width: `${100 / 7}%`,
    height: 38,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalSelectionSummary: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  selectionLabel: {
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalFooterBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalApplyBtn: {
    borderWidth: 0,
  },
  modalFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
