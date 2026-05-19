declare module '@azesmway/react-native-unity' {
  import React from 'react';
  import type { ViewProps } from 'react-native';
  import type { DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';

  type UnityViewContentUpdateEvent = Readonly<{ message: string }>;

  export type RNUnityViewProps = ViewProps & {
    androidKeepPlayerMounted?: boolean;
    fullScreen?: boolean;
    onUnityMessage?: DirectEventHandler<UnityViewContentUpdateEvent>;
    onPlayerUnload?: DirectEventHandler<UnityViewContentUpdateEvent>;
    onPlayerQuit?: DirectEventHandler<UnityViewContentUpdateEvent>;
  };

  export default class UnityView extends React.Component<RNUnityViewProps> {
    postMessage(gameObject: string, methodName: string, message: string): void;
    unloadUnity(): void;
    pauseUnity(pause: boolean): void;
    resumeUnity(): void;
    windowFocusChanged(hasFocus?: boolean): void;
  }
}
