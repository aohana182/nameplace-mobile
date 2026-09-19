import React from 'react';
import { Dimensions, Keyboard, StyleSheet, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { BottomSheetOverlay } from '../components/BottomSheetOverlay';
import { AddPinBottomSheet } from '../components/AddPinBottomSheet';
import { PinDetailsBottomSheet } from '../components/PinDetailsBottomSheet';
import { ManageTagsBottomSheet } from '../components/ManageTagsBottomSheet';
import Tag from '../model/Tag';
import Pin from '../model/Pin';

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

jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 0, Heavy: 2 },
  NotificationFeedbackType: { Success: 0 },
}));

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

const DIM_TINT = 'rgba(15, 23, 42, 0.4)';

const styleOf = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

const allHostViewStyles = (root: { findAll: (p: (n: any) => boolean) => any[] }) =>
  root.findAll(n => typeof n.type === 'string').map(styleOf);

// First host ancestor of the child is the sliding sheet wrapper; the next one is the overlay root.
const hostAncestorsOf = (child: { parent: any }) => {
  const hosts: Array<Record<string, unknown>> = [];
  for (let node = child.parent; node; node = node.parent) {
    if (typeof node.type === 'string') hosts.push(styleOf(node));
  }
  return hosts;
};

describe('BottomSheetOverlay', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caps the sheet height at 90% of the window height in pixels, not as a percentage', () => {
    const { getByTestId } = render(
      <BottomSheetOverlay onClose={jest.fn()}>
        <View testID="sheet-content" />
      </BottomSheetOverlay>
    );

    const [sheetWrapper] = hostAncestorsOf(getByTestId('sheet-content'));

    expect(sheetWrapper.maxHeight).toBe(Dimensions.get('window').height * 0.9);
  });

  it('adds no bottom padding while the keyboard is hidden', () => {
    const { getByTestId } = render(
      <BottomSheetOverlay onClose={jest.fn()}>
        <View testID="sheet-content" />
      </BottomSheetOverlay>
    );

    const [sheetWrapper] = hostAncestorsOf(getByTestId('sheet-content'));

    expect(sheetWrapper.paddingBottom ?? 0).toBe(0);
  });

  it('lifts the sheet by the keyboard height while the keyboard is shown, then drops it again', () => {
    // Keyboard has no public emit; capture the handlers the component registers with the
    // native event source and fire them as the OS would.
    const handlers: Record<string, (e: unknown) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: unknown) => void) => {
      handlers[event] = handler;
      return { remove: jest.fn() };
    }) as never);

    const { getByTestId } = render(
      <BottomSheetOverlay onClose={jest.fn()}>
        <View testID="sheet-content" />
      </BottomSheetOverlay>
    );

    act(() => {
      handlers.keyboardDidShow({ endCoordinates: { height: 300 } });
    });
    expect(hostAncestorsOf(getByTestId('sheet-content'))[0].paddingBottom).toBe(300);

    act(() => {
      handlers.keyboardDidHide({ endCoordinates: { height: 0 } });
    });
    expect(hostAncestorsOf(getByTestId('sheet-content'))[0].paddingBottom).toBe(0);
  });

  it('puts the dim tint on exactly one view, and that view has no elevation', () => {
    const { UNSAFE_root } = render(
      <BottomSheetOverlay onClose={jest.fn()}>
        <View testID="sheet-content" />
      </BottomSheetOverlay>
    );

    const tinted = allHostViewStyles(UNSAFE_root).filter(s => s.backgroundColor === DIM_TINT);

    expect(tinted).toHaveLength(1);
    expect(tinted[0].elevation ?? 0).toBe(0);
  });

  it('keeps the elevated overlay root free of any translucent background', () => {
    const { getByTestId } = render(
      <BottomSheetOverlay onClose={jest.fn()}>
        <View testID="sheet-content" />
      </BottomSheetOverlay>
    );

    const overlayRoot = hostAncestorsOf(getByTestId('sheet-content'))[1];

    expect(overlayRoot.elevation).toBeGreaterThan(0);
    expect(overlayRoot.backgroundColor).toBeUndefined();
  });
});

describe('bottom sheets inside the overlay', () => {
  const tags = [
    { id: 't1', name: 'Friend', color: 'blue', isSystem: true } as Tag,
    { id: 't2', name: 'Work', color: 'purple', isSystem: true } as Tag,
  ];
  const pin = {
    id: 'p1',
    name: 'Jane Barista',
    description: 'Met at Starbucks',
    createdAt: new Date('2026-06-04'),
  } as Pin;

  const percentageMaxHeights = (root: { findAll: (p: (n: any) => boolean) => any[] }) =>
    allHostViewStyles(root).filter(s => typeof s.maxHeight === 'string');

  it('AddPinBottomSheet uses no percentage maxHeight (it resolved against an auto-height parent)', () => {
    const { UNSAFE_root } = render(
      <AddPinBottomSheet location={{ latitude: 37.7, longitude: -122.4 }} onClose={jest.fn()} tags={tags} />
    );

    expect(percentageMaxHeights(UNSAFE_root)).toHaveLength(0);
  });

  it('PinDetailsBottomSheet uses no percentage maxHeight', () => {
    const { UNSAFE_root } = render(
      <PinDetailsBottomSheet pin={pin} onClose={jest.fn()} allTags={tags} pinTags={[tags[0]]} />
    );

    expect(percentageMaxHeights(UNSAFE_root)).toHaveLength(0);
  });

  it('ManageTagsBottomSheet uses no percentage maxHeight', () => {
    const { UNSAFE_root } = render(<ManageTagsBottomSheet onClose={jest.fn()} tags={tags} />);

    expect(percentageMaxHeights(UNSAFE_root)).toHaveLength(0);
  });
});
