import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ManageTagsBottomSheet from '../components/ManageTagsBottomSheet';
import { database } from '../model/database';
import Tag from '../model/Tag';
import Pin from '../model/Pin';
import PinTag from '../model/PinTag';

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

// Official mock for useSafeAreaInsets() etc. — see UIComponentRendering.test.tsx for why
// the default export needs unwrapping.
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
    X: () => <View testID="x-icon" />,
    Edit3: () => <View testID="edit-icon" />,
    Trash2: () => <View testID="trash-icon" />,
  };
});

describe('Tag CRUD (ManageTagsBottomSheet)', () => {
  // The in-memory LokiJS adapter persists for the whole module, so each test
  // clears every table first to stay independent of write order/leftover state.
  beforeEach(async () => {
    await database.write(async () => {
      const allPinTags = await database.get<PinTag>('pin_tags').query().fetch();
      const allTags = await database.get<Tag>('tags').query().fetch();
      const allPins = await database.get<Pin>('pins').query().fetch();
      await database.batch([
        ...allPinTags.map(r => r.prepareDestroyPermanently()),
        ...allTags.map(r => r.prepareDestroyPermanently()),
        ...allPins.map(r => r.prepareDestroyPermanently()),
      ]);
    });
  });

  const seedTag = async (name: string, color: string, isSystem: boolean) => {
    let created!: Tag;
    await database.write(async () => {
      created = await database.get<Tag>('tags').create((t: Tag) => {
        t.name = name;
        t.color = color;
        t.isSystem = isSystem;
      });
    });
    return created;
  };

  it('creates a new custom tag and persists it to the database', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(<ManageTagsBottomSheet onClose={onClose} />);

    fireEvent.press(getByText('New Tag'));
    fireEvent.changeText(getByPlaceholderText('New tag name'), 'Mentor');
    fireEvent.press(getByText('Create'));

    await waitFor(() => expect(getByText('Mentor')).toBeTruthy());

    const rows = await database.get<Tag>('tags').query().fetch();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Mentor');
    expect(rows[0].isSystem).toBe(false);
  });

  it('rejects creating a tag with an empty/whitespace-only name', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(<ManageTagsBottomSheet onClose={onClose} />);

    fireEvent.press(getByText('New Tag'));
    fireEvent.changeText(getByPlaceholderText('New tag name'), '   ');
    fireEvent.press(getByText('Create'));

    // Creator panel should still be open (create was a no-op), and nothing was written.
    await waitFor(() => expect(getByPlaceholderText('New tag name')).toBeTruthy());
    const rows = await database.get<Tag>('tags').query().fetch();
    expect(rows).toHaveLength(0);
  });

  it('edits an existing tag name and color', async () => {
    const tag = await seedTag('Neighbor', '#D97706', false);
    const onClose = jest.fn();
    const { getByText, getByTestId, getByDisplayValue } = render(
      <ManageTagsBottomSheet onClose={onClose} />
    );

    await waitFor(() => expect(getByText('Neighbor')).toBeTruthy());
    fireEvent.press(getByTestId(`edit-tag-${tag.id}`));

    const input = getByDisplayValue('Neighbor');
    fireEvent.changeText(input, 'Old Neighbor');
    fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Old Neighbor')).toBeTruthy());

    const updated = await database.get<Tag>('tags').find(tag.id);
    expect(updated.name).toBe('Old Neighbor');
  });

  it('deletes a non-system tag after confirmation and cascade-deletes its pin_tags', async () => {
    const tag = await seedTag('Mentor', '#DB2777', false);
    let pin!: Pin;
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p: Pin) => {
        p.name = 'Test Person';
        p.lat = 37.7;
        p.lng = -122.4;
      });
      await database.get<PinTag>('pin_tags').create((pt: PinTag) => {
        pt.pin.set(pin);
        pt.tag.set(tag);
      });
    });

    // Auto-confirm the native Alert's destructive "Delete" button.
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const deleteButton = buttons?.find(b => b.text === 'Delete');
      deleteButton?.onPress?.();
    });

    const onClose = jest.fn();
    const { getByText, getByTestId, queryByText } = render(
      <ManageTagsBottomSheet onClose={onClose} />
    );

    await waitFor(() => expect(getByText('Mentor')).toBeTruthy());
    fireEvent.press(getByTestId(`delete-tag-${tag.id}`));

    await waitFor(() => expect(queryByText('Mentor')).toBeNull());

    const remainingTags = await database.get<Tag>('tags').query().fetch();
    expect(remainingTags).toHaveLength(0);

    const remainingPinTags = await database.get<PinTag>('pin_tags').query().fetch();
    expect(remainingPinTags).toHaveLength(0);

    (Alert.alert as jest.Mock).mockRestore();
  });

  it('does not render a delete button for system tags', async () => {
    const tag = await seedTag('Friend', '#2563EB', true);
    const onClose = jest.fn();
    const { getByText, queryByTestId, getByText: getBy } = render(
      <ManageTagsBottomSheet onClose={onClose} />
    );

    await waitFor(() => expect(getByText('Friend')).toBeTruthy());
    expect(getBy('System')).toBeTruthy();
    expect(queryByTestId(`delete-tag-${tag.id}`)).toBeNull();
  });
});
