export type Profile = {
  handle: string;
  displayName: string;
  country: string;
  languages: string[];
  bio: string;
};

export type DiscoveryTab = 'quick-chat' | 'feed' | 'clubs' | 'messages' | 'profile';

