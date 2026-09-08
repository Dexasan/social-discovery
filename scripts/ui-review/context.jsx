import { useState } from 'react';
const user = { id: 'review-me', email: 'alex@example.test', created_at: '2026-06-01T12:00:00Z' };
const profile = { displayName: 'Alex Morgan', handle: 'alexafterhours', bio: 'Collecting stories, records, and people who get it.', country: 'DE', languages: ['English', 'German'], birthDate: '1998-03-14', avatarPath: null };
export function useSession() {
  const screen = new URLSearchParams(location.search).get('screen');
  return { profile, user: screen === 'auth' ? null : user, isLoading: false, isConfigured: true, onboardingComplete: screen !== 'onboarding', signOut: async () => location.assign('/?screen=auth'), refreshProfile: async () => {}, signIn: async () => {}, signUp: async () => ({ needsEmailConfirmation: true }), requestPasswordReset: async () => {}, completeOnboarding: async () => {}, updatePassword: async () => true };
}
export function useCalls() { const [isAvailable, setAvailable] = useState(false); return { isAvailable, setAvailable, isAvailabilityBusy: false }; }
