/**
 * Vendor Onboarding Module
 */

// Demo wizard (simulated imports)
export { MarketplaceOnboarding, default } from './OnboardingWizard';
export type { MarketplaceOnboardingProps } from './OnboardingWizard';

// API-connected wizard (real API calls)
export { MarketplaceOnboardingConnected } from './MarketplaceOnboardingConnected';
export type { MarketplaceOnboardingConnectedProps } from './MarketplaceOnboardingConnected';

// API hook for custom implementations
export { useOnboardingApi } from './useOnboardingApi';
export type { OnboardingApiConfig, OnboardingApiResult } from './useOnboardingApi';

// Types
export * from './types';

