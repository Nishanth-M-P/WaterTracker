import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  getBottleSizes,
  createBottleSize,
  updateBottleSize,
  toggleBottleSizeActive,
  deleteBottleSizeSafe,
} from '../services/bottleSizeService';
import { BottleSize } from '../types/database';
import { Ionicons } from '@expo/vector-icons';
import { confirmAction, showAlert } from '../utils/dialog';

export default function BottleSizesScreen() {
  const { colors, isDark } = useTheme();

  const [sizes, setSizes] = useState<BottleSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSize, setEditingSize] = useState<BottleSize | null>(null);
  const [formName, setFormName] = useState('');
  const [formVolume, setFormVolume] = useState('');
  const [formVolumeUnit, setFormVolumeUnit] = useState<'L' | 'mL'>('L');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSizes = useCallback(async () => {
    try {
      const data = await getBottleSizes(false);
      setSizes(data);
    } catch (err) {
      console.error('Failed to load bottle sizes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSizes();
    }, [loadSizes])
  );

  const openAddModal = () => {
    setEditingSize(null);
    setFormName('');
    setFormVolume('');
    setFormVolumeUnit('L');
    setFormPrice('');
    setFormDescription('');
    setModalVisible(true);
  };

  const openEditModal = (item: BottleSize) => {
    setEditingSize(item);
    setFormName(item.name);
    const unit = (item.volume_unit === 'mL' ? 'mL' : 'L') as 'L' | 'mL';
    setFormVolumeUnit(unit);
    if (item.volume_ml) {
      if (unit === 'mL') {
        setFormVolume(String(item.volume_ml));
      } else {
        setFormVolume(String(item.volume_ml / 1000));
      }
    } else {
      setFormVolume('');
    }
    setFormPrice(item.default_unit_price !== null ? String(item.default_unit_price) : '');
    setFormDescription(item.description || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const cleanName = formName.trim();
    if (!cleanName) {
      Alert.alert('Required', 'Please enter a bottle size or product name.');
      return;
    }

    let volMl: number | null = null;
    if (formVolume.trim()) {
      const rawVol = parseFloat(formVolume.replace(/[^0-9.]/g, ''));
      if (!isNaN(rawVol) && rawVol > 0) {
        volMl = formVolumeUnit === 'L' ? Math.round(rawVol * 1000) : Math.round(rawVol);
      }
    }

    let price: number | null = null;
    if (formPrice.trim()) {
      const rawPrice = parseFloat(formPrice.replace(/[^0-9.]/g, ''));
      if (!isNaN(rawPrice) && rawPrice >= 0) {
        price = rawPrice;
      }
    }

    setSaving(true);
    try {
      if (editingSize) {
        await updateBottleSize(editingSize.id, {
          name: cleanName,
          volume_ml: volMl,
          volume_unit: formVolumeUnit,
          description: formDescription.trim() || null,
          default_unit_price: price,
        });
      } else {
        await createBottleSize({
          name: cleanName,
          volume_ml: volMl,
          volume_unit: formVolumeUnit,
          description: formDescription.trim() || null,
          default_unit_price: price,
        });
      }
      setModalVisible(false);
      loadSizes();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: BottleSize) => {
    try {
      await toggleBottleSizeActive(item.id, item.is_active === 0);
      loadSizes();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (item: BottleSize) => {
    confirmAction({
      title: 'Remove Bottle Size',
      message: `Are you sure you want to delete "${item.name}"? If used in past deliveries, it will be safely deactivated to preserve past records.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await deleteBottleSizeSafe(item.id);
          if (res.deactivatedInstead) {
            showAlert('Deactivated', res.reason);
          } else {
            showAlert('Deleted', `"${item.name}" was permanently removed.`);
          }
          loadSizes();
        } catch (err: any) {
          showAlert('Error', err?.message || 'Failed to remove bottle size');
        }
      },
    });
  };

  const filteredSizes = sizes.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? item.is_active === 1
        : item.is_active === 0;
    return matchesQuery && matchesStatus;
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        title="Manage Bottle Sizes"
        subtitle="Configure products and default pricing"
        showBack
        rightAction={{
          icon: 'add-circle',
          onPress: openAddModal,
        }}
      />

      {/* Search & Filter Bar */}
      <View style={styles.topFilterBar}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            id="bottle-sizes-search-input"
            nativeID="bottle-sizes-search-input"
            aria-label="Search products and sizes"
            autoComplete="off"
            placeholder="Search products & sizes..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterPillsRow}>
          {(['all', 'active', 'inactive'] as const).map((st) => {
            const isSelected = filterStatus === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setFilterStatus(st)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isDark
                      ? '#334155'
                      : colors.inputBg,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {st === 'all' ? 'All Products' : st === 'active' ? 'Active Only' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Button
          title="Add New Bottle Size"
          icon="add-circle"
          variant="primary"
          onPress={openAddModal}
          style={{ marginBottom: 4 }}
        />

        {filteredSizes.map((item) => {
          const isL = item.volume_unit !== 'mL';
          const volDisplay = item.volume_ml
            ? isL
              ? `${(item.volume_ml / 1000).toString()} L (${item.volume_ml} mL)`
              : `${item.volume_ml} mL`
            : 'Unspecified volume';

          return (
            <Card key={item.id} style={styles.sizeCard}>
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.sizeName, { color: colors.text }]}>{item.name}</Text>
                    <Badge
                      label={item.is_active === 1 ? 'Active' : 'Inactive'}
                      type={item.is_active === 1 ? 'active' : 'inactive'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="water-outline" size={14} color={colors.primary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {volDisplay}
                    </Text>

                    <Text style={[styles.metaText, { color: colors.border }]}>•</Text>

                    <Text style={[styles.priceTagText, { color: colors.text }]}>
                      ₹{(item.default_unit_price || 0).toFixed(2)} / bottle
                    </Text>
                  </View>

                  {item.description ? (
                    <Text style={[styles.descText, { color: colors.textMuted }]}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  onPress={() => handleToggleActive(item)}
                  style={[
                    styles.toggleBtn,
                    { backgroundColor: isDark ? '#334155' : colors.inputBg },
                  ]}
                >
                  <Ionicons
                    name={item.is_active === 1 ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.toggleBtnText, { color: colors.textSecondary }]}>
                    {item.is_active === 1 ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: isDark ? '#334155' : colors.inputBg },
                    ]}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: isDark ? '#450a0a' : colors.dangerLight },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        })}

        {filteredSizes.length === 0 && (
          <Card style={{ padding: 24, alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }}>
              No bottle sizes match your filter.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
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
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingSize ? 'Edit Bottle Size & Pricing' : 'Add Bottle Size & Pricing'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Product / Bottle Name *
              </Text>
              <TextInput
                id="bottle-size-name-input"
                nativeID="bottle-size-name-input"
                aria-label="Product or Bottle Name"
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. 20L Water Jar, 1.5L Bottle"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Water Volume & Unit
              </Text>
              <View style={styles.volumeInputRow}>
                <TextInput
                  id="bottle-size-volume-input"
                  nativeID="bottle-size-volume-input"
                  aria-label="Water Volume"
                  value={formVolume}
                  onChangeText={setFormVolume}
                  placeholder={formVolumeUnit === 'L' ? 'e.g. 20 or 1.5' : 'e.g. 500 or 750'}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.modalInput,
                    {
                      flex: 1,
                      color: colors.text,
                      backgroundColor: isDark ? '#334155' : colors.inputBg,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View style={styles.unitToggleGroup}>
                  {(['L', 'mL'] as const).map((u) => {
                    const isSelected = formVolumeUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setFormVolumeUnit(u)}
                        style={[
                          styles.unitToggleBtn,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : isDark
                              ? '#334155'
                              : colors.inputBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitToggleText,
                            {
                              color: isSelected ? '#ffffff' : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Standard Rate per Bottle (₹)
              </Text>
              <TextInput
                id="bottle-size-price-input"
                nativeID="bottle-size-price-input"
                aria-label="Standard Rate per Bottle"
                value={formPrice}
                onChangeText={setFormPrice}
                placeholder="e.g. 40.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Description (Optional)
              </Text>
              <TextInput
                id="bottle-size-description-input"
                nativeID="bottle-size-description-input"
                aria-label="Product Description"
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="e.g. Commercial 20 litre dispenser jar"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#334155' : colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Product"
                variant="primary"
                loading={saving}
                disabled={saving || !formName.trim()}
                onPress={handleSave}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
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
    gap: 12,
    paddingBottom: 40,
  },
  sizeCard: {
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
  },
  cardDivider: {
    height: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  modalActionsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  topFilterBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  priceTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  descText: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  volumeInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  unitToggleGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#94a3b830',
  },
  unitToggleBtn: {
    paddingHorizontal: 14,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitToggleText: {
    fontSize: 13,
  },
});
