import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AddPinBottomSheet } from '../components/AddPinBottomSheet';
import { PinDetailsBottomSheet } from '../components/PinDetailsBottomSheet';
import Tag from '../model/Tag';
import Pin from '../model/Pin';

// Mock the database module to run in-memory during tests and avoid SQLite native bridge issues
jest.mock('../model/database', () => {
  const { Database } = require('@nozbe/watermelondb');
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  const { schema } = require('./mockSchema');
  const Pin = require('../model/Pin').default;
  const Tag = require('../model/Tag').default;
  const PinTag = require('../model/PinTag').default;

  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });

  return {
    database: new Database({
      adapter,
      modelClasses: [Pin, Tag, PinTag],
    }),
  };
});

// Official mock for useSafeAreaInsets() etc. — components under test call this directly
// without a SafeAreaProvider ancestor. The mock file's `export default {...}` compiles to
// a `default` key under CJS interop, so unwrap it to get the named exports our code imports.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// Mock haptics module
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 0, Heavy: 2 },
  NotificationFeedbackType: { Success: 0 },
}));

// Mock lucide icons
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Plus: () => <View testID="plus-icon" />,
    Check: () => <View testID="check-icon" />,
    Trash2: () => <View testID="trash-icon" />,
    Edit3: () => <View testID="edit-icon" />,
    X: () => <View testID="x-icon" />,
  };
});

describe('UI Component Layout & Rendering Tests (UAT Component Integration)', () => {
  // Setup dummy tags
  const mockTags = [
    { id: 't1', name: 'Friend', color: 'blue', isSystem: true } as Tag,
    { id: 't2', name: 'Work', color: 'purple', isSystem: true } as Tag,
    { id: 't3', name: 'Gym', color: 'red', isSystem: false } as Tag,
  ];

  it('renders AddPinBottomSheet inputs, buttons, and tag selector correctly', () => {
    const location = { latitude: 37.7, longitude: -122.4 };
    const onClose = jest.fn();

    const { getByText, getByPlaceholderText, queryByText } = render(
      <AddPinBottomSheet
        location={location}
        onClose={onClose}
        tags={mockTags}
      />
    );

    // Assert title and buttons exist
    expect(getByText('Add Connection Pin')).toBeTruthy();
    expect(getByText('Save Connection')).toBeTruthy();

    // Assert inputs render with correct placeholder text
    expect(getByPlaceholderText('Who did you meet?')).toBeTruthy();
    expect(getByPlaceholderText('Notes (e.g. coffee preferences, where they work...)')).toBeTruthy();

    // Assert tag badges exist as touchable selections
    expect(getByText('Friend')).toBeTruthy();
    expect(getByText('Work')).toBeTruthy();
    expect(getByText('Gym')).toBeTruthy();
  });

  it('renders PinDetailsBottomSheet view mode details and tag list correctly', () => {
    const mockPin = {
      id: 'p1',
      name: 'Jane Barista',
      description: 'Met at Starbucks, likes iced matcha',
      createdAt: new Date('2026-06-04'),
    } as Pin;
    const onClose = jest.fn();

    const { getByText, queryByPlaceholderText } = render(
      <PinDetailsBottomSheet
        pin={mockPin}
        onClose={onClose}
        allTags={mockTags}
        pinTags={[mockTags[0]]} // Associated only with Tag A ('Friend')
      />
    );

    // Assert Name and notes display
    expect(getByText('Jane Barista')).toBeTruthy();
    expect(getByText('Met at Starbucks, likes iced matcha')).toBeTruthy();

    // Assert associated tag renders
    expect(getByText('Friend')).toBeTruthy();

    // Assert unassociated tag 'Work' is not visible in view mode
    expect(queryByPlaceholderText('Who did you meet?')).toBeNull(); // Inputs only in edit mode
  });
});
