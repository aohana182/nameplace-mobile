import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Text, ScrollView, Platform } from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  Marker,
  UserLocation,
  type MapRef,
  type CameraRef,
  type LngLat,
  type PressEvent,
} from '@maplibre/maplibre-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../model/database';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';
import { requestLocationPermissions, getCurrentLocation } from '../services/LocationService';
import AddPinBottomSheet from '../components/AddPinBottomSheet';
import PinDetailsBottomSheet from '../components/PinDetailsBottomSheet';
import { Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface MapScreenProps {
  pins: Pin[];
  tags: Tag[];
  pinTags: PinTag[];
  activeFilterTagIds: string[];
  toggleFilterTag: (tagId: string) => void;
  clearFilters: () => void;
}

interface CameraState {
  center: LngLat;
  zoom: number;
}

interface PinMarkerProps {
  pinId: string;
  lat: number;
  lng: number;
  color: string;
  onPress: (pinId: string) => void;
}

const PinMarker = memo(({ pinId, lat, lng, color, onPress }: PinMarkerProps) => {
  const handlePress = useCallback(() => onPress(pinId), [onPress, pinId]);
  return (
    <Marker id={pinId} lngLat={[lng, lat]} onPress={handlePress}>
      <View style={[styles.pin, { backgroundColor: color }]} />
    </Marker>
  );
});

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const CAMERA_KEY = 'nameplace:lastCamera';

const DEFAULT_CAMERA: CameraState = {
  center: [-122.4194, 37.7749],
  zoom: 10,
};

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
  const [initialCamera, setInitialCamera] = useState<CameraState | null>(null);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const pinsRef = useRef<Pin[]>(pins);
  const hasRestoredCameraRef = useRef(false);
  useEffect(() => { pinsRef.current = pins; }, [pins]);

  // Stable color lookup: recomputes only when the underlying data actually changes,
  // not on every observable tick. String equality in memo comparison is by value,
  // so unchanged pins won't re-render their Marker even when this map is rebuilt.
  const pinColors = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pin of pins) {
      const rel = pinTags.find(pt => pt.pin.id === pin.id);
      const tag = rel ? tags.find(t => t.id === rel.tag.id) : null;
      m[pin.id] = tag?.color ?? '#3B82F6';
    }
    return m;
  }, [pins, pinTags, tags]);

  const handleMarkerPress = useCallback((pinId: string) => {
    const pin = pinsRef.current.find(p => p.id === pinId);
    if (pin) {
      Haptics.selectionAsync();
      setSelectedLocation(null);
      setActivePin(pin);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CAMERA_KEY)
      .then(raw => {
        if (raw) {
          try {
            setInitialCamera(JSON.parse(raw));
            hasRestoredCameraRef.current = true;
            return;
          } catch {}
        }
        setInitialCamera(DEFAULT_CAMERA);
      })
      .catch(err => {
        console.warn('Failed to restore map camera:', err);
        setInitialCamera(DEFAULT_CAMERA);
      });
  }, []);

  const handleRegionDidChange = useCallback(async () => {
    try {
      const viewState = await mapRef.current?.getViewState();
      if (viewState) {
        const camera: CameraState = { center: viewState.center, zoom: viewState.zoom };
        AsyncStorage.setItem(CAMERA_KEY, JSON.stringify(camera));
      }
    } catch (err) {
      console.warn('Failed to persist map camera:', err);
    }
  }, []);

  const flyToLocation = useCallback((loc: { latitude: number; longitude: number }) => {
    cameraRef.current?.flyTo({
      center: [loc.longitude, loc.latitude],
      zoom: 16,
      duration: 1500,
    });
  }, []);

  useEffect(() => {
    if (!isMapReady) return;
    // Only auto-snap to GPS on a true first launch (no camera restored from storage) —
    // otherwise this silently overrides the user's last panned/zoomed position a moment
    // after it's restored, defeating region persistence on every relaunch where GPS succeeds.
    if (hasRestoredCameraRef.current) return;
    const init = async () => {
      try {
        await requestLocationPermissions();
        const loc = await getCurrentLocation();
        flyToLocation(loc);
      } catch (e: any) {
        const msg: string = e?.message ?? '';
        if (msg.includes('denied') || msg.includes('Permission')) {
          Alert.alert(
            'Location Permission Needed',
            'Nameplace uses your location to place pins on the map. You can enable it in your device Settings.',
          );
        } else {
          console.warn('Location init failed', e);
        }
      }
    };
    init();
  }, [isMapReady]);

  const handleLongPress = (event: { nativeEvent: PressEvent }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActivePin(null);
    const [longitude, latitude] = event.nativeEvent.lngLat;
    setSelectedLocation({ latitude, longitude });
  };

  const centerOnMe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const loc = await getCurrentLocation();
      flyToLocation(loc);
    } catch (e) {
      Alert.alert('Location Error', 'Could not get current GPS location. Please check your settings.');
    }
  };

  if (!initialCamera) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <MapLibreMap
        ref={mapRef}
        mapStyle={MAP_STYLE_URL}
        style={styles.map}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
        onLongPress={handleLongPress}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCamera.center, zoom: initialCamera.zoom }}
        />
        <UserLocation animated />
        {pins.map((pin) => (
          <PinMarker
            key={pin.id}
            pinId={pin.id}
            lat={pin.lat}
            lng={pin.lng}
            color={pinColors[pin.id] ?? '#3B82F6'}
            onPress={handleMarkerPress}
          />
        ))}
        {selectedLocation && (
          <Marker id="pending-pin" lngLat={[selectedLocation.longitude, selectedLocation.latitude]}>
            <View style={[styles.pin, { backgroundColor: '#10B981' }]} />
          </Marker>
        )}
      </MapLibreMap>

      {/* Horizontal Tag Filters — box-none so the container itself never eats map touches */}
      <View pointerEvents="box-none" style={[styles.filterContainer, { top: Platform.OS === 'ios' ? 60 : 35 }]}>
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
          key={activePin.id}
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
  pin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
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
