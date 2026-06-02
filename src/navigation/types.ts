export type RootStackParamList = {
  Onboarding:    undefined;
  LevelSetting:  { nextScreen?: string } | undefined;
  Login:         undefined;
  SignUp:        undefined;
  Main:          { screen?: string; params?: Record<string, unknown> } | undefined;
  // sessionId: Module1 분석 세션 식별자 (POST /module1/analyze 결과)
  SwingFeedback: { sessionId: string } | undefined;
  // chatSessionId: Module2 채팅 세션 (DELETE /module2/history/{id})
  // sessionId: 연결된 스윙 분석 세션 (컨텍스트 제공용)
  SwingChat:     { chatSessionId?: string; sessionId?: string; title?: string } | undefined;
  Viewer3D:      { sessionId?: string } | undefined;
  Profile:       undefined;
  // recordedVideoUri: 촬영 완료 후 SwingUpload로 전달되는 영상 경로
  Camera:        undefined;
};
