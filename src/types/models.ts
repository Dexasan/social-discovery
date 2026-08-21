export type Profile = {
  birthDate: string | null;
  handle: string;
  displayName: string;
  country: string;
  languages: string[];
  bio: string;
};

export type DiscoveryTab = 'quick-chat' | 'feed' | 'clubs' | 'messages' | 'profile';
