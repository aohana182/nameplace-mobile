import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Text, ScrollView, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, LongPressEvent } from 'react-native-maps';
import { database } from '../model/database';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';
import { requestLocationPermissions, getCurrentLocation } from '../services/LocationService';
import AddPinBottomSheet from '../components/AddPinBottomSheet';
import PinDetailsBottomSheet from '../components/PinDetailsBottomSheet';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface MapScreenProps {
  pins: Pin[];
  tags: Tag[];
  pinTags: PinTag[];
  activeFilterTagIds: string[];
  toggleFilterTag: (tagId: string) => void;
  clearFilters: () => void;
}

const EnhancedMapScreen = ({
  pins,
  tags,
  pinTags,
  activeFilterTagIds,
  toggleFilterTag,
  clearFilters,
}: MapScreenProps) => {
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
          }, 1500);
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
      Alert.alert('Location Error', 'Could not get current GPS location. Please check your settings.');
    }
  };

  // Find the primary tag color for a specific pin
  const getPinColor = (pinId: string) => {
    const relations = pinTags.filter(pt => pt.pin.id === pinId);
    if (relations.length > 0) {
      // Return the color of the first tag associated with the pin
      const tag = tags.find(t => t.id === relations[0].tag.id);
      if (tag) return tag.color;
    }
    return '#3B82F6'; // Fallback to default primary Blue
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={{
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        onMapReady={() => setIsMapReady(true)}
        onLongPress={handleLongPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pins.map((pin) => {
          const pinColor = getPinColor(pin.id);
          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onPress={() => {
                Haptics.selectionAsync();
                setActivePin(pin);
              }}
            >
              <MapPin size={36} color={pinColor} fill={pinColor} />
            </Marker>
          );
        })}
        {selectedLocation && (
          <Marker coordinate={selectedLocation}>
            <MapPin size={36} color="#10B981" fill="#10B981" />
          </Marker>
        )}
      </MapView>

      {/* Horizontal Tag Filters */}
      <View style={[styles.filterContainer, { top: Platform.OS === 'ios' ? 60 : 35 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {activeFilterTagIds.length > 0 && (
            <TouchableOpacity 
              style={styles.clearBadge} 
              activeOpacity={0.8}
              onPress={clearFilters}
            >
              <Text style={styles.clearBadgeText}>Clear</Text>
            </TouchableOpacity>
          )}
          {tags.map((tag) => {
            const isSelected = activeFilterTagIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                activeOpacity={0.8}
                style={[
                  styles.filterBadge,
                  isSelected
                    ? { backgroundColor: tag.color, borderColor: tag.color }
                    : { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#E2E8F0' },
                ]}
                onPress={() => toggleFilterTag(tag.id)}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    isSelected ? styles.textWhite : { color: '#475569' },
                  ]}
                >
                  {tag.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity 
        style={styles.locationButton} 
        activeOpacity={0.8} 
        onPress={centerOnMe}
      >
        <Navigation size={22} color="#2563EB" />
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

const EnhancedMapScreenObserved = withObservables(['activeFilterTagIds'], ({ activeFilterTagIds }) => {
  let pinsQuery = database.get<Pin>('pins').query();
  if (activeFilterTagIds && activeFilterTagIds.length > 0) {
    pinsQuery = database.get<Pin>('pins').query(
      Q.on('pin_tags', 'tag_id', Q.oneOf(activeFilterTagIds))
    );
  }
  return {
    pins: pinsQuery.observe(),
    tags: database.get<Tag>('tags').query().observe(),
    pinTags: database.get<PinTag>('pin_tags').query().observe(),
  };
})(EnhancedMapScreen);

export default function MapScreen() {
  const [activeFilterTagIds, setActiveFilterTagIds] = useState<string[]>([]);

  const toggleFilterTag = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilterTagIds([]);
  };

  return (
    <EnhancedMapScreenObserved
      activeFilterTagIds={activeFilterTagIds}
      toggleFilterTag={toggleFilterTag}
      clearFilters={clearFilters}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  filterContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  filterBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  clearBadge: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBadgeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  locationButton: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    minHeight: 52,
    minWidth: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
