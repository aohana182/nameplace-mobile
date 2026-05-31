import React, { useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Pin from '../model/Pin';
import { database } from '../model/database';
import { Trash2, Edit3, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface PinDetailsBottomSheetProps {
  pin: Pin | null;
  onClose: () => void;
}

const PinDetailsBottomSheet = ({ pin, onClose }: PinDetailsBottomSheetProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(pin?.name || '');
  const [description, setDescription] = useState(pin?.description || '');
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ['30%', '60%'], []);

  const handleUpdate = async () => {
    if (!pin) return;
    await database.write(async () => {
      await pin.update((p: Pin) => {
        p.name = name;
        p.description = description;
      });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!pin) return;
    Alert.alert('Delete Pin', 'Are you sure you want to remove this connection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await pin.markAsDeleted();
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onClose();
        },
      },
    ]);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  if (!pin) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.contentContainer}>
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
                <TouchableOpacity onPress={handleUpdate} style={styles.actionButton}>
                  <Check size={20} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.actionButton}>
                  <X size={20} color="#EF4444" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionButton}>
                  <Edit3 size={20} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                  <Trash2 size={20} color="#EF4444" />
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
            multiline
          />
        ) : (
          <Text style={styles.description}>{pin.description || 'No notes added yet.'}</Text>
        )}
        
        <Text style={styles.timestamp}>
          Added on {new Date(pin.createdAt).toLocaleDateString()}
        </Text>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 24,
    color: '#1a1a1a',
    flex: 1,
  },
  titleInput: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 24,
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
    flex: 1,
    minHeight: 44, // 44pt touch target
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 44, // 44pt touch target
    minWidth: 44, // 44pt touch target
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
  },
  description: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 20,
  },
  descriptionInput: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  timestamp: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default PinDetailsBottomSheet;
