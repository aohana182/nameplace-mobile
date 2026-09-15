import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Alert, TouchableOpacity, Text, ScrollView, Platform, ActivityIndicator } from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  Marker,
  GeoJSONSource,
  Layer,
  UserLocation,
  type MapRef,
  type CameraRef,
  type LngLat,
  type PressEvent,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import ManageTagsBottomSheet from '../components/ManageTagsBottomSheet';
import { Navigation, Settings, Plus } from 'lucide-react-native';
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
  const insets = useSafeAreaInsets();
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePin, setActivePin] = useState<Pin | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [initialCamera, setInitialCamera] = useState<CameraState | null>(null);
  const [isLocating, setIsLocating] = useState(false);
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

  // GL-native circle layer instead of View-based Markers: Markers are positioned by the
  // JS/UI thread and visibly lag behind the map's own GL rendering during pan/zoom
  // gestures (the library's own docs note this — "If you have static view consider using
  // ViewAnnotation or SymbolLayer for better performance"). A GeoJSON circle layer is
  // rendered by the same GL surface as the map tiles, so it can never desync from them.
  const pinsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      id: pin.id,
      geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
      properties: { pinId: pin.id, color: pinColors[pin.id] ?? '#3B82F6' },
    })),
  }), [pins, pinColors]);

  const handlePinFeaturePress = useCallback((event: { nativeEvent: PressEventWithFeatures }) => {
    const pinId = event.nativeEvent.features[0]?.properties?.pinId;
    if (typeof pinId === 'string') {
      handleMarkerPress(pinId);
    }
  }, [handleMarkerPress]);

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

  // Shared by the initial GPS-snap and the locate button: request permission every time
  // (Android no-ops if already granted, so this is cheap — the initial-mount effect used to
  // skip this whenever a camera was restored from storage, which is true on nearly every
  // relaunch, so the locate button never got a chance to prompt for permission at all).
  // `silent` keeps cold-start GPS timeouts from popping an alert on every app launch; the
  // locate button always surfaces what went wrong since the user explicitly asked for it.
  const goToCurrentLocation = useCallback(async (silent: boolean) => {
    setIsLocating(true);
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
      } else if (silent) {
        console.warn('Location fetch failed', e);
      } else {
        Alert.alert('Location Error', 'Could not get current GPS location. Please check your settings.');
      }
    } finally {
      setIsLocating(false);
    }
  }, [flyToLocation]);

  useEffect(() => {
    if (!isMapReady) return;
    // Only auto-snap to GPS on a true first launch (no camera restored from storage) —
    // otherwise this silently overrides the user's last panned/zoomed position a moment
    // after it's restored, defeating region persistence on every relaunch where GPS succeeds.
    if (hasRestoredCameraRef.current) return;
    goToCurrentLocation(true);
  }, [isMapReady, goToCurrentLocation]);

  const handleLongPress = (event: { nativeEvent: PressEvent }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActivePin(null);
    const [longitude, latitude] = event.nativeEvent.lngLat;
    setSelectedLocation({ latitude, longitude });
  };

  const centerOnMe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToCurrentLocation(false);
  };

  // The only way to add a pin was previously long-pressing the map — a gesture with
  // zero on-screen affordance, so first-time users had no way to discover it. This
  // FAB drops a pin at the current map center, the same entry point as the long-press.
  const handleAddPinAtCenter = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivePin(null);
    const viewState = await mapRef.current?.getViewState();
    if (!viewState) return;
    const [longitude, latitude] = viewState.center;
    setSelectedLocation({ latitude, longitude });
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
        // bottom-left, matching the locate button's height on the opposite side but
        // shifted up clear of the MapLibre logo/attribution row that already lives there.
        compassPosition={{ bottom: 130 + insets.bottom, left: 20 }}
        // Default MapLibre behavior hides the compass whenever the map faces true north,
        // which made it look removed entirely on a never-rotated map — keep it visible always.
        compassHiddenFacingNorth={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCamera.center, zoom: initialCamera.zoom }}
        />
        <UserLocation animated />
        <GeoJSONSource id="pins" data={pinsGeoJSON} onPress={handlePinFeaturePress}>
          <Layer
            id="pins-circles"
            type="circle"
            paint={{
              'circle-radius': 12,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>
        {selectedLocation && (
          <Marker id="pending-pin" lngLat={[selectedLocation.longitude, selectedLocation.latitude]}>
            <View style={[styles.pin, { backgroundColor: '#10B981' }]} />
          </Marker>
        )}
      </MapLibreMap>

      {/* Horizontal Tag Filters — box-none so the container itself never eats map touches.
          left is reserved for the settings button's own width so the row starts right after it. */}
      <View pointerEvents="box-none" style={[styles.filterContainer, { top: insets.top + (Platform.OS === 'ios' ? 10 : 15), left: 78 }]}>
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
        style={[styles.settingsButton, { top: insets.top + (Platform.OS === 'ios' ? 10 : 15) }]}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowManageTags(true);
        }}
      >
        <Settings size={20} color="#2563EB" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.locationButton, { bottom: 50 + insets.bottom }]}
        activeOpacity={0.8}
        onPress={centerOnMe}
        disabled={isLocating}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <Navigation size={22} color="#2563EB" />
        )}
      </TouchableOpacity>

      {/* Primary create action — the only prior way to add a pin was a long-press with
          no on-screen hint at all. Drops a pin at the current map center. */}
      <TouchableOpacity
        style={[styles.addPinButton, { bottom: 50 + insets.bottom }]}
        activeOpacity={0.85}
        onPress={handleAddPinAtCenter}
      >
        <Plus size={26} color="#FFFFFF" />
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

      {showManageTags && (
        <ManageTagsBottomSheet onClose={() => setShowManageTags(false)} />
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
  settingsButton: {
    position: 'absolute',
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 11,
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
  addPinButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -30,
    backgroundColor: '#2563EB',
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    height: 60,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
