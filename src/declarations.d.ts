declare module '*.png' {
  const value: number;
  export default value;
}

declare module '@azesmway/react-native-unity' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  interface UnityViewProps {
    style?: ViewStyle;
    onUnityMessage?: (message: string) => void;
  }

  class UnityView extends Component<UnityViewProps> {
    postMessage(gameObject: string, methodName: string, message: string): void;
    pauseUnity(pause: boolean): void;
    resumeUnity(): void;
    unloadUnity(): void;
    windowFocusChanged(hasFocus?: boolean): void;
  }

  export default UnityView;
}
