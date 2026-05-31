import React, { useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { database } from '../model/database';
import Pin from '../model/Pin';
import * as Haptics from 'expo-haptics';

interface AddPinBottomSheetProps {
  location: { latitude: number; longitude: number } | null;
  onClose: () => void;
}

const AddPinBottomSheet = ({ location, onClose }: AddPinBottomSheetProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ['25%', '50%'], []);

  const handleSave = async () => {
    if (!location || !name) return;

    await database.write(async () => {
      await database.get<Pin>('pins').create((pin: Pin) => {
        pin.name = name;
        pin.description = description;
        pin.lat = location.latitude;
        pin.lng = location.longitude;
      });
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName('');
    setDescription('');
    onClose();
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

  if (!location) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.contentContainer}>
        <Text style={styles.title}>Add New Connection</Text>
        <TextInput
          style={styles.input}
          placeholder="Who did you meet?"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Notes (e.g., The barista with the red hat)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save Pin</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontFamily: 'RobotoSlab_700Bold',
    fontSize: 20,
    marginBottom: 20,
    color: '#1a1a1a',
  },
  input: {
    fontFamily: 'Roboto_400Regular',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    color: 'white',
    fontSize: 16,
  },
});

export default AddPinBottomSheet;
