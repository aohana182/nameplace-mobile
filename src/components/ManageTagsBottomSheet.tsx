import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../model/database';
import Tag from '../model/Tag';
import withObservables from '@nozbe/with-observables';
import * as Haptics from 'expo-haptics';
import { Plus, Check, X, Edit3, Trash2 } from 'lucide-react-native';
import { PALETTE_COLORS } from '../constants/tagColors';
import { BottomSheetOverlay } from './BottomSheetOverlay';

interface ManageTagsBottomSheetProps {
  onClose: () => void;
  tags: Tag[];
}

export const ManageTagsBottomSheet = ({ onClose, tags }: ManageTagsBottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PALETTE_COLORS[0]);

  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE_COLORS[0]);

  const startEdit = (tag: Tag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = async (tag: Tag) => {
    if (!editName.trim()) return;
    try {
      await database.write(async () => {
        await tag.update((t: Tag) => {
          t.name = editName.trim();
          t.color = editColor;
        });
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingId(null);
    } catch {
      Alert.alert('Update Failed', 'Could not update tag. Please try again.');
    }
  };

  const handleDelete = (tag: Tag) => {
    Alert.alert(
      'Delete Tag',
      `Delete "${tag.name}"? It will be removed from any pins that have it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                const relations = await tag.pinTags.fetch();
                await database.batch([
                  ...relations.map(r => r.prepareDestroyPermanently()),
                  tag.prepareDestroyPermanently(),
                ]);
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Delete Failed', 'Could not delete tag. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await database.write(async () => {
        await database.get<Tag>('tags').create((t: Tag) => {
          t.name = newName.trim();
          t.color = newColor;
          t.isSystem = false;
        });
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNewName('');
      setNewColor(PALETTE_COLORS[0]);
      setShowCreator(false);
    } catch {
      Alert.alert('Create Failed', 'Could not create tag. Please try again.');
    }
  };

  const renderColorPalette = (selected: string, onSelect: (color: string) => void) => (
    <View style={styles.colorPalette}>
      {PALETTE_COLORS.map(color => (
        <TouchableOpacity
          key={color}
          activeOpacity={0.8}
          style={[
            styles.colorOption,
            { backgroundColor: color },
            selected === color && styles.selectedColorOption,
          ]}
          onPress={() => onSelect(color)}
        >
          {selected === color && <Check size={14} color="white" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <BottomSheetOverlay onClose={onClose}>
        <KeyboardAvoidingView
          // See AddPinBottomSheet.tsx for why this is 'padding' on Android too:
          // adjustResize doesn't reliably resize the window once edge-to-edge is enabled.
          behavior="padding"
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={[styles.contentContainer, { paddingBottom: 48 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>Manage Tags</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeButton}>
                  <X size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {tags.map(tag => (
                <View key={tag.id} style={styles.tagRow}>
                  {editingId === tag.id ? (
                    <View style={styles.editingBlock}>
                      <TextInput
                        style={styles.input}
                        value={editName}
                        onChangeText={setEditName}
                        autoFocus
                      />
                      {renderColorPalette(editColor, setEditColor)}
                      <View style={styles.rowActions}>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: '#2563EB' }]}
                          activeOpacity={0.8}
                          onPress={() => saveEdit(tag)}
                        >
                          <Text style={styles.buttonTextSmall}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: '#E2E8F0' }]}
                          activeOpacity={0.8}
                          onPress={() => setEditingId(null)}
                        >
                          <Text style={[styles.buttonTextSmall, { color: '#475569' }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.tagRowContent}>
                      <View style={[styles.swatch, { backgroundColor: tag.color }]} />
                      <Text style={styles.tagName} numberOfLines={1}>{tag.name}</Text>
                      {tag.isSystem && <Text style={styles.systemBadge}>System</Text>}
                      <TouchableOpacity
                        testID={`edit-tag-${tag.id}`}
                        style={styles.iconButton}
                        activeOpacity={0.7}
                        onPress={() => startEdit(tag)}
                      >
                        <Edit3 size={18} color="#64748B" />
                      </TouchableOpacity>
                      {!tag.isSystem && (
                        <TouchableOpacity
                          testID={`delete-tag-${tag.id}`}
                          style={styles.iconButton}
                          activeOpacity={0.7}
                          onPress={() => handleDelete(tag)}
                        >
                          <Trash2 size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {showCreator ? (
                <View style={styles.tagCreatorPanel}>
                  <TextInput
                    style={styles.input}
                    placeholder="New tag name"
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                  />
                  {renderColorPalette(newColor, setNewColor)}
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: '#2563EB' }]}
                      activeOpacity={0.8}
                      onPress={handleCreate}
                    >
                      <Text style={styles.buttonTextSmall}>Create</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: '#E2E8F0' }]}
                      activeOpacity={0.8}
                      onPress={() => setShowCreator(false)}
                    >
                      <Text style={[styles.buttonTextSmall, { color: '#475569' }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowCreator(true);
                  }}
                >
                  <Plus size={18} color="#2563EB" />
                  <Text style={styles.addButtonText}>New Tag</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
    </BottomSheetOverlay>
  );
};

const styles = StyleSheet.create({
  sheetWrapper: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  closeButton: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagRow: {
    marginBottom: 12,
  },
  tagRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 56,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  tagName: {
    flex: 1,
    fontFamily: 'Roboto_700Bold',
    fontSize: 15,
    color: '#0F172A',
  },
  systemBadge: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginRight: 8,
  },
  iconButton: {
    // Material's 48dp minimum touch target (was 40).
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editingBlock: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  input: {
    fontFamily: 'Roboto_400Regular',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 46,
    marginBottom: 16,
    color: '#0F172A',
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedColorOption: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonTextSmall: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  tagCreatorPanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    marginTop: 4,
  },
  addButtonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#2563EB',
  },
});

const enhance = withObservables([], () => ({
  tags: database.get<Tag>('tags').query(),
}));

export default enhance(ManageTagsBottomSheet);
