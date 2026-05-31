import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, LongPressEvent } from 'react-native-maps';
import { database } from '../model/database';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import Pin from '../model/Pin';
import { requestLocationPermissions, getCurrentLocation } from '../services/LocationService';
import AddPinBottomSheet from '../components/AddPinBottomSheet';
import PinDetailsBottomSheet from '../components/PinDetailsBottomSheet';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const MapScreen = ({ pins }: { pins: Pin[] }) => {
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePin, setActivePin] = useState<Pin | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await requestLocationPermissions();
        if (isMapReady) {
          const loc = await getCurrentLocation();
          mapRef.current?.animateToRegion({
            ...loc,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 2000);
        }
      } catch (e) {
        console.warn('Location init failed', e);
      }
    };
    init();
  }, [isMapReady]);

  const handleLongPress = (event: LongPressEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedLocation(event.nativeEvent.coordinate);
  };

  const centerOnMe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const loc = await getCurrentLocation();
      mapRef.current?.animateToRegion({
        ...loc,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (e) {
      Alert.alert('Error', 'Could not get current location');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 0,
          longitude: 0,
          latitudeDelta: 100,
          longitudeDelta: 100,
        }}
        onMapReady={() => setIsMapReady(true)}
        onLongPress={handleLongPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            onPress={() => {
              Haptics.selectionAsync();
              setActivePin(pin);
            }}
          >
            <MapPin size={32} color="#3B82F6" fill="#3B82F6" />
          </Marker>
        ))}
        {selectedLocation && (
          <Marker coordinate={selectedLocation}>
            <MapPin size={32} color="#10B981" fill="#10B981" />
          </Marker>
        )}
      </MapView>

      <TouchableOpacity style={styles.locationButton} onPress={centerOnMe}>
        <Navigation size={24} color="#3B82F6" />
      </TouchableOpacity>

      {selectedLocation && (
        <AddPinBottomSheet
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {activePin && (
        <PinDetailsBottomSheet
          pin={activePin}
          onClose={() => setActivePin(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  locationButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

const enhance = withObservables([], () => ({
  pins: database.get<Pin>('pins').query(),
}));

export default enhance(MapScreen);
