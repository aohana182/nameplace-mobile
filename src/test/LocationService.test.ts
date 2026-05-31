import * as Location from 'expo-location';
import { getCurrentLocation } from '../services/LocationService';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current position when successful', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 10, longitude: 20 },
    });

    const loc = await getCurrentLocation();
    expect(loc).toEqual({ latitude: 10, longitude: 20 });
  });

  it('falls back to last known position on timeout', async () => {
    // Mock getCurrentPositionAsync to never resolve (trigger timeout)
    (Location.getCurrentPositionAsync as jest.Mock).mockReturnValue(new Promise(() => {}));
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 30, longitude: 40 },
    });

    // Use fake timers to trigger timeout
    jest.useFakeTimers();
    const locPromise = getCurrentLocation();
    
    jest.advanceTimersByTime(5000);
    const loc = await locPromise;
    
    expect(loc).toEqual({ latitude: 30, longitude: 40 });
    jest.useRealTimers();
  });

  it('throws error if both current and last known fail', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('GPS Hardware Error'));
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);

    await expect(getCurrentLocation()).rejects.toThrow('GPS Hardware Error');
  });
});
