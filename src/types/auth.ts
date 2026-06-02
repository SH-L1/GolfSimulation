export interface AuthUser {
  id:               string;
  name:             string;
  email:            string | null;
  handicap:         number;
  experience_level: 'beginner' | 'experienced';
  avatar_url:       string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type:   string;
  user:         AuthUser;
}
