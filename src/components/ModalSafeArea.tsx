import React from 'react';
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
export const ModalSafeArea = ({ children }: ModalSafeAreaProps) => (
  <SafeAreaProvider>
    <ModalSafeAreaContent>{children}</ModalSafeAreaContent>
  </SafeAreaProvider>
);
