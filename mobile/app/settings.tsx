import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  getDatabaseStats,
  DatabaseStats,
  getSetting,
  setSetting,
} from '../services/settingsService';
import { exportBackup, validateBackupContent, restoreBackup } from '../services/backupService';
import { seedSampleTestData, clearAllBusinessData } from '../services/testDataService';
import {
  getBillProductMapping,
  saveBillProductMapping,
  BILL_ROW_DEFINITIONS,
  BillProductMapping,
  BillRowSlot,
} from '../services/billMappingService';
import { getBottleSizes } from '../services/bottleSizeService';
import { BottleSize } from '../types/database';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();

  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [weekStart, setWeekStart] = useState<'monday' | 'sunday'>('monday');
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [billMapping, setBillMapping] = useState<BillProductMapping>({
    row_1_20l: null,
    row_2_half_l: null,
    row_3_1l: null,
    row_4_bisleri: null,
  });
  const [allBottleSizes, setAllBottleSizes] = useState<BottleSize[]>([]);
  const [activeSlot, setActiveSlot] = useState<{ slot: BillRowSlot; label: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const s = await getDatabaseStats();
      setStats(s);

      const ws = await getSetting('week_start', 'monday');
      setWeekStart(ws === 'sunday' ? 'sunday' : 'monday');

      const pe = await getSetting('pricing_enabled', 'false');
      setPricingEnabled(pe === 'true');

      const mapping = await getBillProductMapping();
      setBillMapping(mapping);

      const sizes = await getBottleSizes(false);
      setAllBottleSizes(sizes);
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleTogglePricing = async (val: boolean) => {
    setPricingEnabled(val);
    await setSetting('pricing_enabled', val ? 'true' : 'false');
  };

  const handleToggleWeekStart = async () => {
    const nextVal = weekStart === 'monday' ? 'sunday' : 'monday';
    setWeekStart(nextVal);
    await setSetting('week_start', nextVal);
  };

  const handleSelectMapping = async (slot: BillRowSlot, bottleSizeId: number | null) => {
    const updated: BillProductMapping = {
      ...billMapping,
      [slot]: bottleSizeId,
    };
    setBillMapping(updated);
    await saveBillProductMapping(updated);
    setActiveSlot(null);
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await exportBackup();
      Alert.alert(
        'Backup Exported',
        `Successfully saved backup to ${res.filename}. You can now share or store it in your files.`
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export backup file.');
    } finally {
      setExporting(false);
    }
  };

  const handleSeedDevData = () => {
    const executeSeed = async () => {
      try {
        const res = await seedSampleTestData();
        if (Platform.OS === 'web') {
          window.alert(
            `Test Data Loaded: Created ${res.customersCreated} sample customers and ${res.deliveriesCreated} deliveries.`
          );
        } else {
          Alert.alert(
            'Test Data Loaded',
            `Created ${res.customersCreated} sample customers and ${res.deliveriesCreated} deliveries.`
          );
        }
        loadData();
      } catch (err: any) {
        if (Platform.OS === 'web') {
          window.alert('Error: ' + (err?.message || 'Failed to generate test data'));
        } else {
          Alert.alert('Error', err?.message || 'Failed to generate test data');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'This will populate sample customers and deliveries across the past 7 days for testing. Real business data should not be overwritten. Proceed?'
      );
      if (confirmed) {
        executeSeed();
      }
      return;
    }

    Alert.alert(
      'Load Sample Test Data',
      'This will populate sample customers and deliveries across the past 7 days for testing. Real business data should not be overwritten. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Test Data',
          onPress: executeSeed,
        },
      ]
    );
  };

  const handleClearData = () => {
    const executePurge = async () => {
      try {
        await clearAllBusinessData();
        if (Platform.OS === 'web') {
          window.alert('All business delivery and customer records have been cleared.');
        } else {
          Alert.alert('Database Cleaned', 'All business delivery and customer records have been cleared.');
        }
        loadData();
      } catch (err: any) {
        if (Platform.OS === 'web') {
          window.alert('Error: ' + (err?.message || 'Failed to clear data'));
        } else {
          Alert.alert('Error', err?.message || 'Failed to clear data');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'WARNING: This will permanently delete all deliveries, customers, and custom rates from local SQLite storage. This action cannot be undone.\n\nDo you want to proceed?'
      );
      if (confirmed) {
        executePurge();
      }
      return;
    }

    Alert.alert(
      'Reset All Business Data',
      'WARNING: This will permanently delete all deliveries and customers from local SQLite storage. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Reset',
          style: 'destructive',
          onPress: executePurge,
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header title="Settings" subtitle="WaterTrack configuration & tools" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Products & Inventory Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Products & Sizes</Text>

          <Card
            onPress={() => router.push('/bottle-sizes')}
            style={styles.navRowCard}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Manage Bottle Sizes</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Configure jar volumes, bottle sizes & default prices
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </View>

        {/* CASH / CREDIT Official Bill Mapping */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            CASH / CREDIT Bill Mapping
          </Text>
          <Text style={[styles.sectionHelper, { color: colors.textSecondary }]}>
            Map your inventory bottle sizes to the 4 fixed rows on the official bill template.
          </Text>

          <Card style={styles.card}>
            {BILL_ROW_DEFINITIONS.map((def, idx) => {
              const mappedId = billMapping[def.slot];
              const mappedBottle = allBottleSizes.find((b) => b.id === mappedId);
              return (
                <React.Fragment key={def.slot}>
                  {idx > 0 && (
                    <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                  )}
                  <TouchableOpacity
                    style={styles.billMappingRow}
                    onPress={() => setActiveSlot({ slot: def.slot, label: def.label })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.billMappingLeft}>
                      <View style={[styles.slotBadge, { backgroundColor: `${colors.primary}15` }]}>
                        <Text style={[styles.slotBadgeText, { color: colors.primary }]}>
                          Row {def.slNo}
                        </Text>
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>{def.label}</Text>
                        <Text
                          style={[
                            styles.rowSubtitle,
                            { color: mappedBottle ? colors.primary : colors.textMuted },
                          ]}
                        >
                          {mappedBottle
                            ? `Mapped: ${mappedBottle.name}${
                                mappedBottle.volume_ml
                                  ? ` (${
                                      mappedBottle.volume_ml >= 1000
                                        ? `${mappedBottle.volume_ml / 1000}L`
                                        : `${mappedBottle.volume_ml}mL`
                                    })`
                                  : ''
                              }`
                            : 'Auto-detect or Unmapped'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </Card>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>

          <Card style={styles.card}>
            {/* Theme Toggle */}
            <View style={styles.settingItemRow}>
              <View style={styles.settingItemLeft}>
                <Ionicons
                  name={isDark ? 'moon-outline' : 'sunny-outline'}
                  size={20}
                  color={colors.primary}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Dark Mode</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    Toggle application visual theme
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            {/* Week Start Day */}
            <TouchableOpacity
              onPress={handleToggleWeekStart}
              style={styles.settingItemRow}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Week Starts On</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    Used for weekly analytics calculations
                  </Text>
                </View>
              </View>
              <View style={[styles.badgePill, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {weekStart === 'monday' ? 'Monday' : 'Sunday'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            {/* Optional Pricing */}
            <View style={styles.settingItemRow}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Show Product Pricing</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    Track optional monetary line totals
                  </Text>
                </View>
              </View>
              <Switch
                value={pricingEnabled}
                onValueChange={handleTogglePricing}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
          </Card>
        </View>

        {/* Database & Storage Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Database & Storage</Text>

          <Card style={styles.card}>
            <View style={styles.dbStatsGrid}>
              <View style={styles.dbStatItem}>
                <Text style={[styles.dbStatValue, { color: colors.text }]}>
                  {stats?.customerCount ?? 0}
                </Text>
                <Text style={[styles.dbStatLabel, { color: colors.textSecondary }]}>
                  Customers
                </Text>
              </View>

              <View style={styles.dbStatItem}>
                <Text style={[styles.dbStatValue, { color: colors.primary }]}>
                  {stats?.deliveryCount ?? 0}
                </Text>
                <Text style={[styles.dbStatLabel, { color: colors.textSecondary }]}>
                  Deliveries
                </Text>
              </View>

              <View style={styles.dbStatItem}>
                <Text style={[styles.dbStatValue, { color: colors.text }]}>
                  {stats?.lineItemCount ?? 0}
                </Text>
                <Text style={[styles.dbStatLabel, { color: colors.textSecondary }]}>
                  Line Items
                </Text>
              </View>

              <View style={styles.dbStatItem}>
                <Text style={[styles.dbStatValue, { color: colors.text }]}>
                  {stats?.bottleSizeCount ?? 0}
                </Text>
                <Text style={[styles.dbStatLabel, { color: colors.textSecondary }]}>
                  Bottle Sizes
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <View style={styles.storageNoteRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
              <Text style={[styles.storageNoteText, { color: colors.textSecondary }]}>
                100% Offline SQLite database with foreign keys & WAL journaling.
              </Text>
            </View>
          </Card>
        </View>

        {/* Backup & Recovery Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Backup & Recovery</Text>

          <Card style={styles.card}>
            <Text style={[styles.backupNotice, { color: colors.textSecondary }]}>
              All data is stored directly on this device. Create periodic backups to ensure business
              records can be restored if the phone is replaced.
            </Text>

            <Button
              title="Export Full Backup (JSON)"
              icon="share-outline"
              variant="primary"
              loading={exporting}
              disabled={exporting}
              onPress={handleExportBackup}
              style={{ marginTop: 8 }}
            />
          </Card>
        </View>

        {/* Development & Diagnostics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Developer Tools & Testing
          </Text>

          <Card style={styles.card}>
            <Text style={[styles.devNotice, { color: colors.textMuted }]}>
              Testing utilities to verify charts, reports, and empty states. Separated from
              production records.
            </Text>

            <View style={styles.devActionsRow}>
              <Button
                title="Seed Sample Data"
                icon="flask-outline"
                variant="secondary"
                onPress={handleSeedDevData}
                style={{ flex: 1, marginRight: 6 }}
                size="sm"
              />
              <Button
                title="Reset Database"
                icon="trash-bin-outline"
                variant="outline"
                onPress={handleClearData}
                style={{ flex: 1, marginLeft: 6 }}
                size="sm"
              />
            </View>
          </Card>
        </View>

        {/* About App */}
        <View style={styles.aboutCard}>
          <Text style={[styles.aboutTitle, { color: colors.text }]}>WaterTrack v1.0.0</Text>
          <Text style={[styles.aboutSub, { color: colors.textMuted }]}>
            Offline Water Bottle Distribution Management System
          </Text>
          <Text style={[styles.aboutSub, { color: colors.textMuted, marginTop: 2 }]}>
            Android-first React Native & SQLite Architecture
          </Text>
        </View>
      </ScrollView>

      {/* Mapping Selection Modal */}
      <Modal
        visible={activeSlot !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveSlot(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Map Official Bill Row
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.primary }]}>
                  {activeSlot?.label}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveSlot(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      activeSlot && billMapping[activeSlot.slot] === null
                        ? `${colors.primary}15`
                        : colors.inputBg,
                  },
                ]}
                onPress={() => activeSlot && handleSelectMapping(activeSlot.slot, null)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Auto-detect / Default
                  </Text>
                  <Text style={[styles.optionSub, { color: colors.textMuted }]}>
                    Use volume/naming rules automatically
                  </Text>
                </View>
                {activeSlot && billMapping[activeSlot.slot] === null && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>

              {allBottleSizes.map((size) => {
                const isSelected = activeSlot && billMapping[activeSlot.slot] === size.id;
                const volStr = size.volume_ml
                  ? size.volume_ml >= 1000
                    ? `${size.volume_ml / 1000} L`
                    : `${size.volume_ml} mL`
                  : '';
                const rateStr =
                  size.default_unit_price != null
                    ? ` • Rate: ₹${size.default_unit_price.toFixed(2)}`
                    : '';
                return (
                  <TouchableOpacity
                    key={size.id}
                    style={[
                      styles.modalOption,
                      {
                        backgroundColor: isSelected
                          ? `${colors.primary}15`
                          : colors.inputBg,
                      },
                    ]}
                    onPress={() => activeSlot && handleSelectMapping(activeSlot.slot, size.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: colors.text }]}>
                        {size.name}
                      </Text>
                      <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                        {volStr ? `${volStr}${rateStr}` : rateStr.replace(' • ', '')}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setActiveSlot(null)}
              style={{ marginTop: 12 }}
            />
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
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  navRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
  },
  dbStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  dbStatItem: {
    alignItems: 'center',
  },
  dbStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  dbStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  storageNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storageNoteText: {
    fontSize: 12,
    flex: 1,
  },
  backupNotice: {
    fontSize: 13,
    lineHeight: 18,
  },
  devNotice: {
    fontSize: 12,
    lineHeight: 16,
  },
  devActionsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  aboutCard: {
    alignItems: 'center',
    marginTop: 10,
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  aboutSub: {
    fontSize: 12,
  },
  sectionHelper: {
    fontSize: 12,
    marginLeft: 4,
    marginBottom: 4,
    lineHeight: 16,
  },
  billMappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  billMappingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  slotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalList: {
    maxHeight: 340,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
