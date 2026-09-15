import React from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

interface ModalSafeAreaProps {
  children: (insets: EdgeInsets) => React.ReactNode;
}

const ModalSafeAreaContent = ({ children }: ModalSafeAreaProps) => {
  const insets = useSafeAreaInsets();
  return <>{children(insets)}</>;
};

// React Native's <Modal> renders its content into a separate native window, outside the
// view hierarchy the app-root SafeAreaProvider measures. Calling useSafeAreaInsets()
// directly inside a Modal reads insets from that root context, not the Modal's own
// window — on this app's edge-to-edge Android build that shows up as bottom content
// (Save buttons, list ends) staying clipped even after adding insets.bottom padding.
// Wrapping the Modal's content in its own SafeAreaProvider gets a fresh measurement
// for the Modal's actual window.
//
// Separately: with navigationBarTranslucent, the Modal's own Android Dialog window is
// genuinely edge-to-edge (confirmed via `adb shell dumpsys window windows` — its
// LayoutParams report fillxfill, the full physical display). But RN hardcodes
// SOFT_INPUT_ADJUST_RESIZE on that window (ReactModalHostView.kt), and adjustResize
// combined with edge-to-edge is the same documented broken combination that affected
// the main Activity window (see AddPinBottomSheet.tsx) — Android's own "resized"
// content measurement sticks at a shorter height than the real window even with no
// keyboard open, leaving a strip at the bottom where the screen behind the Modal
// (the map) shows through. minHeight against Dimensions.get('screen') — the OS's
// static physical-display size, independent of any one window's own relayout state —
// forces this content to actually fill the real screen instead of that short
// measurement.
export const ModalSafeArea = ({ children }: ModalSafeAreaProps) => (
  <SafeAreaProvider style={{ minHeight: Dimensions.get('screen').height }}>
    <ModalSafeAreaContent>{children}</ModalSafeAreaContent>
  </SafeAreaProvider>
);
