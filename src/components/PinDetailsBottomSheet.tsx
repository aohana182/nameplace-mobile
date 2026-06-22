import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';
import { database } from '../model/database';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { Trash2, Edit3, X, Check, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const PALETTE_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#059669', // Green
  '#D97706', // Orange
  '#DC2626', // Red
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#4B5563', // Gray
];

interface PinDetailsBottomSheetProps {
  pin: Pin;
  onClose: () => void;
  allTags: Tag[];
  pinTags: Tag[];
}

export const PinDetailsBottomSheet = ({ pin, onClose, allTags, pinTags }: PinDetailsBottomSheetProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(pin.name);
  const [description, setDescription] = useState(pin.description || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PALETTE_COLORS[0]);

  useEffect(() => {
    setName(pin.name);
    setDescription(pin.description || '');
  }, [pin]);

  useEffect(() => {
    if (pinTags) {
      setSelectedTagIds(pinTags.map(t => t.id));
    }
  }, [pinTags, isEditing]);

  const handleUpdate = async () => {
    if (!name.trim()) return;

    try {
      await database.write(async () => {
        await pin.update((p: Pin) => {
          p.name = name.trim();
          p.description = description.trim();
        });

        const currentRelations = await database.get<PinTag>('pin_tags')
          .query(Q.where('pin_id', pin.id))
          .fetch();

        const relationsToDelete = currentRelations.filter(r => !selectedTagIds.includes(r.tag.id));
        const currentTagIds = currentRelations.map(r => r.tag.id);
        const tagIdsToAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));

        const deletes = relationsToDelete.map(r => r.prepareDestroyPermanently());

        const pinTagsCollection = database.get<PinTag>('pin_tags');
        const creates: PinTag[] = [];
        for (const tagId of tagIdsToAdd) {
          const tagRecord = allTags.find(t => t.id === tagId);
          if (!tagRecord) continue;
          creates.push(pinTagsCollection.prepareCreate((pt: PinTag) => {
            pt.pin.set(pin);
            pt.tag.set(tagRecord);
          }));
        }

        await database.batch(...deletes, ...creates);
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
    } catch {
      Alert.alert('Update Failed', 'Could not save changes. Please try again.');
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete Pin', 'Are you sure you want to remove this connection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              const relations = await database.get<PinTag>('pin_tags')
                .query(Q.where('pin_id', pin.id))
                .fetch();

              const deletes = relations.map(r => r.prepareDestroyPermanently());
              await database.batch(...deletes);
              await pin.destroyPermanently();
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
          } catch {
            Alert.alert('Delete Failed', 'Could not delete this connection. Please try again.');
          }
        },
      },
    ]);
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.header}>
                {isEditing ? (
                  <TextInput
                    style={styles.titleInput}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.title}>{pin.name}</Text>
                )}
                <View style={styles.actions}>
                  {isEditing ? (
                    <>
                      <TouchableOpacity onPress={handleUpdate} activeOpacity={0.8} style={[styles.actionButton, { backgroundColor: '#ECFDF5' }]}>
                        <Check size={20} color="#059669" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setIsEditing(false)} activeOpacity={0.8} style={[styles.actionButton, { backgroundColor: '#F1F5F9' }]}>
                        <X size={20} color="#475569" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.8} style={[styles.actionButton, { backgroundColor: '#EFF6FF' }]}>
                        <Edit3 size={20} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleDelete} activeOpacity={0.8} style={[styles.actionButton, { backgroundColor: '#FEF2F2' }]}>
                        <Trash2 size={20} color="#DC2626" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[styles.actionButton, { backgroundColor: '#F1F5F9' }]}>
                        <X size={20} color="#475569" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {isEditing ? (
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add notes about your connection..."
                  multiline
                  numberOfLines={4}
                />
              ) : (
                <Text style={styles.description}>{pin.description || 'No notes added yet.'}</Text>
              )}

              <View style={styles.tagsSection}>
                <View style={styles.tagsHeader}>
                  <Text style={styles.label}>{isEditing ? 'Edit Tags' : 'Tags'}</Text>
                  {isEditing && (
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
                  )}
                </View>

                {isEditing && showTagCreator && (
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
                  {isEditing ? (
                    allTags.map(tag => {
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
                    })
                  ) : pinTags.length > 0 ? (
                    pinTags.map(tag => (
                      <View
                        key={tag.id}
                        style={[styles.tagBadgeView, { backgroundColor: tag.color + '1A', borderColor: tag.color }]}
                      >
                        <Text style={[styles.tagBadgeText, { color: tag.color }]}>{tag.name}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noTagsText}>No tags attached to this pin.</Text>
                  )}
                </View>
              </View>

              {!isEditing && (
                <Text style={styles.timestamp}>
                  Added on {new Date(pin.createdAt).toLocaleDateString()}
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
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
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  title: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 26,
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.5,
  },
  titleInput: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 22,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  description: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#334155',
    lineHeight: 26,
    marginBottom: 28,
  },
  descriptionInput: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#0F172A',
    lineHeight: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tagsSection: {
    marginBottom: 28,
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
  tagBadgeView: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  noTagsText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  timestamp: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    color: '#94A3B8',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
    marginTop: 12,
  },
});

const enhance = withObservables(['pin'], ({ pin }) => ({
  pin: pin.observe(),
  allTags: database.get<Tag>('tags').query().observe(),
  pinTags: database.get<Tag>('tags').query(
    Q.on('pin_tags', 'pin_id', pin.id)
  ).observe(),
}));

export default enhance(PinDetailsBottomSheet);
