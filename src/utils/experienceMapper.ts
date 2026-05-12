export type ExperienceLevel    = 'beginner' | 'intermediate' | 'advanced';
export type ApiExperienceLevel = 'beginner' | 'experienced';

/** UI 3단계 → API 2단계 변환 */
export function toApiLevel(level: ExperienceLevel): ApiExperienceLevel {
  return level === 'beginner' ? 'beginner' : 'experienced';
}

/** API 2단계 → UI 기본값 변환 */
export function toUiLevel(level: ApiExperienceLevel): ExperienceLevel {
  return level === 'beginner' ? 'beginner' : 'intermediate';
}
