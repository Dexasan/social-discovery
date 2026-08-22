export type Profile = {
  avatarPath: string | null;
  birthDate: string | null;
  handle: string;
  displayName: string;
  country: string;
  languages: string[];
  bio: string;
};

export type DiscoveryTab = 'quick-chat' | 'feed' | 'clubs' | 'messages' | 'profile';
