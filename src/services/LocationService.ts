import * as Location from 'expo-location';

export const requestLocationPermissions = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access location was denied');
  }
};

export const getCurrentLocation = async () => {
  try {
    // Race the current position request against a 5-second timeout
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 5000)
    );

    const result = await Promise.race([locationPromise, timeoutPromise]);

    if (result) {
      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
    }

    // If it timed out (result is null), fallback to the last known position
    console.warn('GPS lock timed out, falling back to last known location.');
    const lastKnown = await Location.getLastKnownPositionAsync({});
    
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }

    throw new Error('Could not determine location (Timeout and no last known position).');

  } catch (error) {
    console.error('Location service failure:', error);
    throw error;
  }
};
