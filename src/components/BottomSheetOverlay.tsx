import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Keyboard, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

interface BottomSheetOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
}

// Renders the sheet in-tree (absolutely positioned over the screen) instead of using
// RN's <Modal>. <Modal> creates a separate Android Dialog window, and that window's
// content is measured by Android's own SOFT_INPUT_ADJUST_RESIZE logic, hardcoded in
// RN core (ReactModalHostView.kt) with no prop to turn it off. Combined with
// edge-to-edge (needed for the sheet's background to reach the true screen bottom)
// this is the same documented broken Android combination already worked around for
// the main Activity window: Android's own "resized" content measurement sticks short
// of the real window even with no keyboard open, and no JS-level styling can
// override it — the shortfall happens in Android's native measure pass before React
// ever sees it. Rendering the sheet in-tree instead makes it inherit the main
// Activity's window, which already correctly handles this — sidestepping the
// Dialog-specific bug entirely.
//
// Android's adjustResize doesn't resize the window under edge-to-edge, so the keyboard lift
// is done here from the keyboard event's own height (0 when hidden).
// The height cap is in pixels on purpose: a percentage maxHeight on a child of this
// auto-height wrapper resolved against a taller measured height and left an empty strip
// (~110dp) under the sheet, with no keyboard involved.
export const BottomSheetOverlay = ({ onClose, children }: BottomSheetOverlayProps) => {
  const translateY = useRef(new Animated.Value(400)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
    return () => subscription.remove();
  }, [onClose, translateY]);

  return (
    <Animated.View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheetSlide,
          { maxHeight: windowHeight * 0.9, paddingBottom: keyboardHeight, transform: [{ translateY }] },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetSlide: {
    width: '100%',
  },
});
