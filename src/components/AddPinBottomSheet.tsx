import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../model/database';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';
import withObservables from '@nozbe/with-observables';
import * as Haptics from 'expo-haptics';
import { Plus, Check, X } from 'lucide-react-native';
import { PALETTE_COLORS } from '../constants/tagColors';
import { BottomSheetOverlay } from './BottomSheetOverlay';

interface AddPinBottomSheetProps {
  location: { latitude: number; longitude: number } | null;
  onClose: () => void;
  tags: Tag[];
}

export const AddPinBottomSheet = ({ location, onClose, tags }: AddPinBottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PALETTE_COLORS[0]);

  const handleSave = async () => {
    if (!location || !name) return;

    const isValidCoord = (lat: number, lng: number) =>
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    if (!isValidCoord(location.latitude, location.longitude)) {
      Alert.alert('Invalid Location', 'Could not get a valid GPS fix. Please try again.');
      return;
    }

    try {
      await database.write(async () => {
        const newPin = await database.get<Pin>('pins').create((pin: Pin) => {
          pin.name = name;
          pin.description = description;
          pin.lat = location.latitude;
          pin.lng = location.longitude;
        });

        const pinTagsCollection = database.get<PinTag>('pin_tags');
        const relations: PinTag[] = [];
        for (const tagId of selectedTagIds) {
          const tagRecord = tags.find(t => t.id === tagId);
          if (!tagRecord) continue;
          relations.push(pinTagsCollection.prepareCreate((pt: PinTag) => {
            pt.pin.set(newPin);
            pt.tag.set(tagRecord);
          }));
        }

        await database.batch(relations);
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setDescription('');
      setSelectedTagIds([]);
      Keyboard.dismiss();
      onClose();
    } catch {
      Alert.alert('Save Failed', 'Could not save your connection. Please check device storage and try again.');
    }
  };

  const handleCreateCustomTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await database.write(async () => {
        await database.get<Tag>('tags').create((t: Tag) => {
          t.name = newTagName.trim();
          t.color = newTagColor;
          t.isSystem = false;
        });
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNewTagName('');
      setShowTagCreator(false);
    } catch {
      Alert.alert('Tag Creation Failed', 'Could not create tag. Please try again.');
    }
  };

  const toggleTagSelection = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  if (!location) return null;

  return (
    <BottomSheetOverlay onClose={onClose}>
        <KeyboardAvoidingView
          // 'padding' on both platforms: Android's adjustResize (set in AndroidManifest)
          // stops reliably resizing the window once edge-to-edge is enabled (gradle.properties
          // has edgeToEdgeEnabled=true) — the app's window covers the full screen, so the OS has
          // no boundary left to shrink and the keyboard just overlays content instead. This
          // KeyboardAvoidingView padding is what actually keeps focused inputs and the Save
          // button above the keyboard now.
          behavior="padding"
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.handle} />
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>Add Connection Pin</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeButton}>
                  <X size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Who did you meet?"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes (e.g. coffee preferences, where they work...)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <View style={styles.tagsHeader}>
                <Text style={styles.label}>Select Tags</Text>
                <TouchableOpacity
                  style={styles.addTagButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTagCreator(!showTagCreator);
                  }}
                >
                  <Plus size={16} color="#2563EB" />
                  <Text style={styles.addTagButtonText}>New Tag</Text>
                </TouchableOpacity>
              </View>

              {showTagCreator && (
                <View style={styles.tagCreatorPanel}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Custom tag name (e.g. Mentor)"
                    value={newTagName}
                    onChangeText={setNewTagName}
                  />
                  <View style={styles.colorPalette}>
                    {PALETTE_COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        activeOpacity={0.8}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          newTagColor === color && styles.selectedColorOption,
                        ]}
                        onPress={() => setNewTagColor(color)}
                      >
                        {newTagColor === color && <Check size={14} color="white" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.creatorActions}>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: '#2563EB' }]}
                      activeOpacity={0.8}
                      onPress={handleCreateCustomTag}
                    >
                      <Text style={styles.buttonTextSmall}>Create</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: '#E2E8F0' }]}
                      activeOpacity={0.8}
                      onPress={() => setShowTagCreator(false)}
                    >
                      <Text style={[styles.buttonTextSmall, { color: '#475569' }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.tagsContainer}>
                {tags.map(tag => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      activeOpacity={0.8}
                      style={[
                        styles.tagBadge,
                        isSelected
                          ? { backgroundColor: tag.color, borderColor: tag.color }
                          : { backgroundColor: 'white', borderColor: tag.color },
                      ]}
                      onPress={() => toggleTagSelection(tag.id)}
                    >
                      <Text
                        style={[
                          styles.tagBadgeText,
                          isSelected ? { color: 'white' } : { color: tag.color },
                        ]}
                      >
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Outside the ScrollView so the primary CTA is always reachable — with the
                keyboard open and a scroll position mid-form, a button living inside the
                scroll content can end up needing a scroll to even see, let alone tap. */}
            <View style={styles.stickyFooter}>
              <TouchableOpacity
                style={[styles.button, !name && styles.buttonDisabled]}
                activeOpacity={0.7}
                onPress={handleSave}
                disabled={!name}
              >
                <Text style={styles.buttonText}>Save Connection</Text>
              </TouchableOpacity>
            </View>
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
  scrollArea: {
    flexShrink: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  stickyFooter: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    fontFamily: 'Roboto_400Regular',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    fontSize: 16,
    color: '#0F172A',
    minHeight: 52,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  addTagButtonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#2563EB',
  },
  tagCreatorPanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tagInput: {
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
    marginBottom: 20,
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
  creatorActions: {
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  tagBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

const enhance = withObservables([], () => ({
  tags: database.get<Tag>('tags').query(),
}));

export default enhance(AddPinBottomSheet);
