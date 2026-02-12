/**
 * Onboarding Wizard Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  INITIAL_FORM_DATA,
  type OnboardingFormData,
  type VendorProfileData,
  type PlatformConnectionData,
  type ImportProgressData,
} from '../../../src/components/onboarding/types';

describe('Onboarding Types and Constants', () => {
  describe('ONBOARDING_STEPS', () => {
    it('should have 5 steps', () => {
      expect(ONBOARDING_STEPS).toHaveLength(5);
    });

    it('should have correct step order', () => {
      const stepIds = ONBOARDING_STEPS.map(s => s.id);
      expect(stepIds).toEqual(['welcome', 'profile', 'connect', 'import', 'complete']);
    });

    it('should have titles for all steps', () => {
      for (const step of ONBOARDING_STEPS) {
        expect(step.title).toBeTruthy();
        expect(typeof step.title).toBe('string');
      }
    });
  });

  describe('INITIAL_FORM_DATA', () => {
    it('should have empty profile data', () => {
      expect(INITIAL_FORM_DATA.profile.displayName).toBe('');
      expect(INITIAL_FORM_DATA.profile.tagline).toBe('');
      expect(INITIAL_FORM_DATA.profile.description).toBe('');
      expect(INITIAL_FORM_DATA.profile.returnPolicy).toBe('');
      expect(INITIAL_FORM_DATA.profile.shippingPolicy).toBe('');
    });

    it('should have null platform', () => {
      expect(INITIAL_FORM_DATA.connection.platform).toBeNull();
      expect(INITIAL_FORM_DATA.connection.connected).toBe(false);
    });

    it('should have idle import status', () => {
      expect(INITIAL_FORM_DATA.import.status).toBe('idle');
      expect(INITIAL_FORM_DATA.import.progress).toBe(0);
      expect(INITIAL_FORM_DATA.import.totalProducts).toBe(0);
    });
  });
});

describe('Form Validation Logic', () => {
  describe('Profile Step', () => {
    it('should require display name', () => {
      const profile: VendorProfileData = {
        displayName: '',
        tagline: '',
        description: '',
        returnPolicy: '',
        shippingPolicy: '',
      };
      
      const isValid = profile.displayName.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should pass with display name', () => {
      const profile: VendorProfileData = {
        displayName: 'Test Store',
        tagline: '',
        description: '',
        returnPolicy: '',
        shippingPolicy: '',
      };
      
      const isValid = profile.displayName.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should trim whitespace from display name', () => {
      const profile: VendorProfileData = {
        displayName: '   ',
        tagline: '',
        description: '',
        returnPolicy: '',
        shippingPolicy: '',
      };
      
      const isValid = profile.displayName.trim().length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Connect Step', () => {
    it('should require platform selection', () => {
      const connection: PlatformConnectionData = {
        platform: null,
        connected: false,
      };
      
      const isValid = connection.platform !== null;
      expect(isValid).toBe(false);
    });

    it('should pass with platform selected', () => {
      const connection: PlatformConnectionData = {
        platform: 'shopify',
        connected: false,
      };
      
      const isValid = connection.platform !== null;
      expect(isValid).toBe(true);
    });

    it('should accept all platform types', () => {
      const platforms = ['shopify', 'square', 'woocommerce'] as const;
      
      for (const platform of platforms) {
        const connection: PlatformConnectionData = {
          platform,
          connected: false,
        };
        expect(connection.platform).toBe(platform);
      }
    });
  });

  describe('Import Step', () => {
    it('should require import complete', () => {
      const importData: ImportProgressData = {
        status: 'idle',
        progress: 0,
        totalProducts: 0,
        importedProducts: 0,
        matchedProducts: 0,
        newProducts: 0,
        errors: [],
      };
      
      const isValid = importData.status === 'complete';
      expect(isValid).toBe(false);
    });

    it('should pass when import complete', () => {
      const importData: ImportProgressData = {
        status: 'complete',
        progress: 100,
        totalProducts: 25,
        importedProducts: 25,
        matchedProducts: 8,
        newProducts: 17,
        errors: [],
      };
      
      const isValid = importData.status === 'complete';
      expect(isValid).toBe(true);
    });

    it('should track all import statuses', () => {
      const statuses = ['idle', 'connecting', 'fetching', 'matching', 'creating', 'complete', 'error'] as const;
      
      for (const status of statuses) {
        const importData: ImportProgressData = {
          status,
          progress: 0,
          totalProducts: 0,
          importedProducts: 0,
          matchedProducts: 0,
          newProducts: 0,
          errors: [],
        };
        expect(importData.status).toBe(status);
      }
    });
  });
});

describe('Form Data Flow', () => {
  it('should support complete form data structure', () => {
    const formData: OnboardingFormData = {
      profile: {
        displayName: 'Sneaker Paradise',
        tagline: 'Premium sneakers since 2015',
        description: 'We sell authenticated sneakers from top brands.',
        returnPolicy: '30-day returns',
        shippingPolicy: 'Free shipping over $100',
      },
      connection: {
        platform: 'shopify',
        connected: true,
        shopDomain: 'sneaker-paradise.myshopify.com',
        accessToken: 'shpat_xxx',
      },
      import: {
        status: 'complete',
        progress: 100,
        totalProducts: 25,
        importedProducts: 25,
        matchedProducts: 8,
        newProducts: 17,
        errors: [],
      },
    };

    expect(formData.profile.displayName).toBe('Sneaker Paradise');
    expect(formData.connection.platform).toBe('shopify');
    expect(formData.connection.connected).toBe(true);
    expect(formData.import.status).toBe('complete');
    expect(formData.import.importedProducts).toBe(25);
  });

  it('should support partial updates', () => {
    const initial = { ...INITIAL_FORM_DATA };
    
    // Update profile
    const updated: OnboardingFormData = {
      ...initial,
      profile: {
        ...initial.profile,
        displayName: 'New Store',
      },
    };
    
    expect(updated.profile.displayName).toBe('New Store');
    expect(updated.profile.tagline).toBe(''); // Original value preserved
    expect(updated.connection.platform).toBeNull(); // Other sections unchanged
  });
});

describe('Progress Tracking', () => {
  it('should calculate step completion', () => {
    const isStepComplete = (stepIndex: number, formData: OnboardingFormData): boolean => {
      switch (stepIndex) {
        case 0: // welcome
          return true;
        case 1: // profile
          return formData.profile.displayName.trim().length > 0;
        case 2: // connect
          return formData.connection.platform !== null;
        case 3: // import
          return formData.import.status === 'complete';
        case 4: // complete
          return true;
        default:
          return false;
      }
    };

    const completeData: OnboardingFormData = {
      profile: {
        displayName: 'Test Store',
        tagline: '',
        description: '',
        returnPolicy: '',
        shippingPolicy: '',
      },
      connection: {
        platform: 'shopify',
        connected: true,
      },
      import: {
        status: 'complete',
        progress: 100,
        totalProducts: 25,
        importedProducts: 25,
        matchedProducts: 8,
        newProducts: 17,
        errors: [],
      },
    };

    expect(isStepComplete(0, completeData)).toBe(true);
    expect(isStepComplete(1, completeData)).toBe(true);
    expect(isStepComplete(2, completeData)).toBe(true);
    expect(isStepComplete(3, completeData)).toBe(true);
    expect(isStepComplete(4, completeData)).toBe(true);
  });

  it('should calculate progress percentage', () => {
    const calculateProgress = (completedSteps: number): number => {
      return (completedSteps / (ONBOARDING_STEPS.length - 1)) * 100;
    };

    expect(calculateProgress(0)).toBe(0);
    expect(calculateProgress(1)).toBe(25);
    expect(calculateProgress(2)).toBe(50);
    expect(calculateProgress(3)).toBe(75);
    expect(calculateProgress(4)).toBe(100);
  });
});

describe('Import Progress Simulation', () => {
  it('should progress through import stages', () => {
    const stages: ImportProgressData['status'][] = [
      'idle',
      'connecting',
      'fetching',
      'matching',
      'creating',
      'complete',
    ];

    let currentIndex = 0;
    
    const advanceStage = (): ImportProgressData['status'] => {
      if (currentIndex < stages.length - 1) {
        currentIndex++;
      }
      return stages[currentIndex];
    };

    expect(stages[currentIndex]).toBe('idle');
    expect(advanceStage()).toBe('connecting');
    expect(advanceStage()).toBe('fetching');
    expect(advanceStage()).toBe('matching');
    expect(advanceStage()).toBe('creating');
    expect(advanceStage()).toBe('complete');
    expect(advanceStage()).toBe('complete'); // Stays at complete
  });

  it('should calculate matched vs new products', () => {
    const importResult: ImportProgressData = {
      status: 'complete',
      progress: 100,
      totalProducts: 25,
      importedProducts: 25,
      matchedProducts: 8,
      newProducts: 17,
      errors: [],
    };

    // Matched + New should equal Total
    expect(importResult.matchedProducts + importResult.newProducts).toBe(importResult.totalProducts);
    
    // All products should be imported
    expect(importResult.importedProducts).toBe(importResult.totalProducts);
  });
});

