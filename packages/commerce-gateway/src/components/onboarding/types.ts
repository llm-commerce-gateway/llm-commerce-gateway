/**
 * Vendor Onboarding Types
 */

export type PlatformType = 'shopify' | 'square' | 'woocommerce' | 'google_merchant' | null;

export type OnboardingStepId = 
  | 'welcome' 
  | 'profile' 
  | 'connect' 
  | 'import' 
  | 'complete';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description?: string;
}

export interface VendorProfileData {
  displayName: string;
  tagline: string;
  description: string;
  logo?: string;
  banner?: string;
  returnPolicy: string;
  shippingPolicy: string;
  businessAddress?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface PlatformConnectionData {
  platform: PlatformType;
  connected: boolean;
  shopDomain?: string;
  accessToken?: string;
  locationId?: string;
}

export interface ImportProgressData {
  status: 'idle' | 'connecting' | 'fetching' | 'matching' | 'creating' | 'complete' | 'error';
  progress: number;
  totalProducts: number;
  importedProducts: number;
  matchedProducts: number;
  newProducts: number;
  errors: string[];
}

export interface OnboardingFormData {
  profile: VendorProfileData;
  connection: PlatformConnectionData;
  import: ImportProgressData;
}

export interface OnboardingContextValue {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  formData: OnboardingFormData;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
  canProceed: boolean;
  isComplete: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { 
    id: 'welcome', 
    title: 'Welcome',
    description: 'Get started with Better Data Marketplace',
  },
  { 
    id: 'profile', 
    title: 'Vendor Profile',
    description: 'Set up your store profile',
  },
  { 
    id: 'connect', 
    title: 'Connect Store',
    description: 'Connect your e-commerce platform',
  },
  { 
    id: 'import', 
    title: 'Import Products',
    description: 'Import your product catalog',
  },
  { 
    id: 'complete', 
    title: 'Complete',
    description: "You're all set!",
  },
];

export const INITIAL_FORM_DATA: OnboardingFormData = {
  profile: {
    displayName: '',
    tagline: '',
    description: '',
    returnPolicy: '',
    shippingPolicy: '',
  },
  connection: {
    platform: null,
    connected: false,
  },
  import: {
    status: 'idle',
    progress: 0,
    totalProducts: 0,
    importedProducts: 0,
    matchedProducts: 0,
    newProducts: 0,
    errors: [],
  },
};

