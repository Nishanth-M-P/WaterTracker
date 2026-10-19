import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  formatLocalDate,
  parseLocalDate,
  getTodayDate,
  getYesterdayDate,
  getThisWeekRange,
  getLastWeekRange,
  getThisMonthRange,
  getLastMonthRange,
  getDayBeforeYesterdayDate,
} from '../../services/reportingService';
import { Button } from '../common/Button';

export type PresetRangeType =
  | 'today'
  | 'yesterday'
  | 'day_before_yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onRangeChange: (startDate: string, endDate: string, preset?: PresetRangeType) => void;
  activePreset?: PresetRangeType;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onRangeChange,
  activePreset = 'today',
}) => {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetRangeType>(activePreset);

  // Calendar modal state
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
    setSelectedPreset(id);
    if (id === 'today') {
      const today = getTodayDate();
      onRangeChange(today, today, 'today');
    } else if (id === 'yesterday') {
      const yest = getYesterdayDate();
      onRangeChange(yest, yest, 'yesterday');
    } else if (id === 'day_before_yesterday') {
      const dby = getDayBeforeYesterdayDate();
      onRangeChange(dby, dby, 'day_before_yesterday');
    } else if (id === 'this_week') {
      const w = getThisWeekRange('monday');
      onRangeChange(w.start, w.end, 'this_week');
    } else if (id === 'last_week') {
      const w = getLastWeekRange('monday');
      onRangeChange(w.start, w.end, 'last_week');
    } else if (id === 'this_month') {
      const m = getThisMonthRange();
      onRangeChange(m.start, m.end, 'this_month');
    } else if (id === 'last_month') {
      const m = getLastMonthRange();
      onRangeChange(m.start, m.end, 'last_month');
    } else if (id === 'custom') {
      setTempStart(startDate);
      setTempEnd(endDate);
      setViewDate(parseLocalDate(startDate));
      setModalVisible(true);
    }
  };

  // Calendar logic (Monday first: Mon=0, Tue=1, ..., Sun=6)
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayPress = (dayNum: number) => {
    const selected = formatLocalDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum));

    if (!tempStart || (tempStart && tempEnd && tempStart !== tempEnd)) {
      // Start a new selection
      setTempStart(selected);
      setTempEnd(selected);
    } else if (tempStart && tempStart === tempEnd) {
      if (selected < tempStart) {
        // If chosen date is earlier than start, reset start to chosen date
        setTempStart(selected);
        setTempEnd(selected);
      } else {
        // Complete the range
        setTempEnd(selected);
      }
    }
  };

  const handleApplyCustom = () => {
    if (tempEnd < tempStart) {
      setTempEnd(tempStart);
      onRangeChange(tempStart, tempStart, 'custom');
    } else {
      onRangeChange(tempStart, tempEnd, 'custom');
    }
    setModalVisible(false);
  };

  // Render calendar days
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <View style={styles.container}>
      {/* Presets Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsList}
      >
        {presets.map((preset) => {
          const isActive = selectedPreset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.7}
              onPress={() => handleSelectPreset(preset.id)}
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
                  styles.presetText,
                  {
                    color: isActive ? '#ffffff' : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected Range Display Bar */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setTempStart(startDate);
          setTempEnd(endDate);
          setViewDate(parseLocalDate(startDate));
          setModalVisible(true);
        }}
        style={[
          styles.rangeDisplayBar,
          {
            backgroundColor: isDark ? '#1e293b' : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.rangeTextRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[styles.rangeLabel, { color: colors.text }]}>
            {startDate === endDate ? startDate : `${startDate}  ➔  ${endDate}`}
          </Text>
        </View>
        <View style={styles.editDatePill}>
          <Text style={[styles.editDateText, { color: colors.primary }]}>Change Date</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
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
            {/* Calendar Header */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.calMonthTitle, { color: colors.text }]}>
                {monthNames[month]} {year}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels (Mon first) */}
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
                const dateStr = formatLocalDate(new Date(year, month, dayNum));
                const isStart = tempStart === dateStr;
                const isEnd = tempEnd === dateStr;
                const inRange = tempStart && tempEnd && dateStr > tempStart && dateStr < tempEnd;
                const isSelected = isStart || isEnd;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    activeOpacity={0.7}
                    onPress={() => handleDayPress(dayNum)}
                    style={[
                      styles.dayCell,
                      inRange && { backgroundColor: isDark ? '#0c4a6e' : colors.primaryLight },
                      isSelected && {
                        backgroundColor: colors.primary,
                        borderRadius: 18,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: isSelected
                            ? '#ffffff'
                            : inRange
                            ? colors.primaryDark
                            : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Range Confirmation Banner */}
            <View
              style={[
                styles.rangeSummaryBanner,
                { backgroundColor: isDark ? '#334155' : colors.inputBg },
              ]}
            >
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                Selected: <Text style={{ color: colors.text, fontWeight: '700' }}>{tempStart}</Text>
                {tempStart !== tempEnd && (
                  <> to <Text style={{ color: colors.text, fontWeight: '700' }}>{tempEnd}</Text></>
                )}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Apply Range"
                variant="primary"
                onPress={handleApplyCustom}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  presetsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 13,
  },
  rangeDisplayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  rangeTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  editDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editDateText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekLabelText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDayCell: {
    width: '14.28%',
    height: 40,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  dayText: {
    fontSize: 14,
  },
  rangeSummaryBanner: {
    marginTop: 16,
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
