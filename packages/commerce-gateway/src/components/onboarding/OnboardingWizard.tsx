/**
 * Marketplace Vendor Onboarding Wizard
 * 
 * Multi-step wizard for new vendors to:
 * 1. Set up their vendor profile
 * 2. Connect their e-commerce platform (Shopify/Square)
 * 3. Import their products
 * 4. Go live on the marketplace
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { 
  OnboardingFormData, 
  OnboardingStep,
  PlatformType,
  VendorProfileData,
  ImportProgressData,
} from './types.js';
import { ONBOARDING_STEPS, INITIAL_FORM_DATA } from './types.js';

// ============================================================================
// Styles (inline for portability)
// ============================================================================

const styles = {
  container: {
    maxWidth: '56rem',
    margin: '0 auto',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  progressContainer: {
    marginBottom: '2rem',
  },
  progressSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  progressStep: (isActive: boolean, isComplete: boolean) => ({
    flex: 1,
    textAlign: 'center' as const,
    position: 'relative' as const,
    paddingBottom: '0.5rem',
    borderBottom: `3px solid ${isComplete || isActive ? '#6366f1' : '#e5e7eb'}`,
  }),
  stepNumber: (isActive: boolean, isComplete: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    backgroundColor: isComplete ? '#22c55e' : isActive ? '#6366f1' : '#e5e7eb',
    color: isComplete || isActive ? '#fff' : '#6b7280',
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  }),
  stepTitle: (isActive: boolean) => ({
    fontSize: '0.875rem',
    color: isActive ? '#111827' : '#6b7280',
    fontWeight: isActive ? 600 : 400,
  }),
  card: {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
    margin: 0,
  },
  cardContent: {
    padding: '1.5rem',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '1.5rem',
  },
  button: (variant: 'primary' | 'outline' | 'disabled') => ({
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: variant === 'disabled' ? 'not-allowed' : 'pointer',
    border: variant === 'outline' ? '1px solid #e5e7eb' : 'none',
    backgroundColor: variant === 'primary' ? '#6366f1' : variant === 'disabled' ? '#e5e7eb' : '#fff',
    color: variant === 'primary' ? '#fff' : variant === 'disabled' ? '#9ca3af' : '#374151',
    transition: 'all 0.15s ease',
  }),
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
    fontSize: '0.875rem',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '100px',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '0.5rem',
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  infoBox: (variant: 'info' | 'success' | 'warning') => ({
    padding: '1rem',
    borderRadius: '0.5rem',
    backgroundColor: variant === 'success' ? '#f0fdf4' : variant === 'warning' ? '#fffbeb' : '#eff6ff',
    border: `1px solid ${variant === 'success' ? '#bbf7d0' : variant === 'warning' ? '#fde68a' : '#bfdbfe'}`,
    marginBottom: '1rem',
  }),
  platformButton: (isSelected: boolean) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    borderRadius: '0.75rem',
    border: `2px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
    backgroundColor: isSelected ? '#eef2ff' : '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: '8rem',
  }),
  progressBar: {
    width: '100%',
    height: '1rem',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  progressFill: (progress: number) => ({
    width: `${progress}%`,
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: '0.5rem',
    transition: 'width 0.3s ease',
  }),
  statCard: {
    textAlign: 'center' as const,
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
};

// ============================================================================
// Step Components
// ============================================================================

interface StepProps {
  formData: OnboardingFormData;
  updateFormData: (data: Partial<OnboardingFormData>) => void;
  onNext?: () => void;
}

function WelcomeStep({ onNext }: StepProps) {
  return (
    <div>
      <p style={{ fontSize: '1.125rem', color: '#374151', marginBottom: '1.5rem' }}>
        Welcome to Better Data Marketplace! Let's get your store set up so customers
        can find your products through Claude, ChatGPT, and Grok.
      </p>
      
      <div style={styles.infoBox('info')}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#1e40af' }}>
          📋 What you'll need:
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#1e40af' }}>
          <li style={{ marginBottom: '0.5rem' }}>Shopify or Square account credentials</li>
          <li style={{ marginBottom: '0.5rem' }}>Product listings ready to import</li>
          <li style={{ marginBottom: '0.5rem' }}>~10 minutes to complete setup</li>
        </ul>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '2rem' }}>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>🤖</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>AI-Powered</div>
          <div style={styles.statLabel}>Sell through AI assistants</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>✓</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Authenticated</div>
          <div style={styles.statLabel}>Signal Tag verified</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>📊</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Analytics</div>
          <div style={styles.statLabel}>Track LLM attribution</div>
        </div>
      </div>
    </div>
  );
}

function ProfileStep({ formData, updateFormData }: StepProps) {
  const updateProfile = (field: keyof VendorProfileData, value: string) => {
    updateFormData({
      profile: {
        ...formData.profile,
        [field]: value,
      },
    });
  };

  return (
    <div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Display Name *</label>
        <input
          type="text"
          style={styles.input}
          value={formData.profile.displayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProfile('displayName', e.target.value)}
          placeholder="Your Store Name"
        />
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Tagline</label>
        <input
          type="text"
          style={styles.input}
          value={formData.profile.tagline}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProfile('tagline', e.target.value)}
          placeholder="Premium sneakers since 2015"
        />
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Description</label>
        <textarea
          style={styles.textarea}
          value={formData.profile.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateProfile('description', e.target.value)}
          placeholder="Tell customers about your store, what makes you special, and why they should buy from you..."
          rows={4}
        />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Return Policy</label>
          <textarea
            style={{ ...styles.textarea, minHeight: '80px' }}
            value={formData.profile.returnPolicy}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateProfile('returnPolicy', e.target.value)}
            placeholder="30-day returns, original condition"
            rows={3}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Shipping Policy</label>
          <textarea
            style={{ ...styles.textarea, minHeight: '80px' }}
            value={formData.profile.shippingPolicy}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateProfile('shippingPolicy', e.target.value)}
            placeholder="Free shipping on orders over $100"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function ConnectStep({ formData, updateFormData }: StepProps) {
  const selectPlatform = (platform: PlatformType) => {
    updateFormData({
      connection: {
        ...formData.connection,
        platform,
      },
    });
  };

  return (
    <div>
      <p style={{ marginBottom: '1.5rem', color: '#374151' }}>
        Connect your e-commerce platform to import your products:
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <button
          style={styles.platformButton(formData.connection.platform === 'shopify')}
          onClick={() => selectPlatform('shopify')}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛍️</div>
          <div style={{ fontWeight: 600 }}>Shopify</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Most popular
          </div>
        </button>
        
        <button
          style={styles.platformButton(formData.connection.platform === 'square')}
          onClick={() => selectPlatform('square')}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>◼️</div>
          <div style={{ fontWeight: 600 }}>Square</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Retail & POS
          </div>
        </button>
        
        <button
          style={styles.platformButton(formData.connection.platform === 'woocommerce')}
          onClick={() => selectPlatform('woocommerce')}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔌</div>
          <div style={{ fontWeight: 600 }}>WooCommerce</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            WordPress
          </div>
        </button>
        
        <button
          style={styles.platformButton(formData.connection.platform === 'google_merchant')}
          onClick={() => selectPlatform('google_merchant')}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
          <div style={{ fontWeight: 600 }}>Google Merchant</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Google Shopping
          </div>
        </button>
      </div>
      
      {formData.connection.platform && (
        <div style={{ ...styles.infoBox('success'), marginTop: '1.5rem' }}>
          <p style={{ fontWeight: 600, color: '#166534', margin: 0 }}>
            ✓ Selected: {formData.connection.platform.charAt(0).toUpperCase() + formData.connection.platform.slice(1)}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#166534', marginTop: '0.5rem', marginBottom: 0 }}>
            Click "Next" to authorize and connect your {formData.connection.platform} store.
          </p>
        </div>
      )}
      
      <div style={{ ...styles.infoBox('info'), marginTop: '1rem' }}>
        <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
          <strong>🔒 Secure Connection:</strong> We use OAuth to securely connect to your store.
          We never store your password.
        </p>
      </div>
    </div>
  );
}

function ImportStep({ formData, updateFormData }: StepProps) {
  const [isImporting, setIsImporting] = useState(false);
  
  const startImport = useCallback(async () => {
    setIsImporting(true);
    
    const progressSteps: Partial<ImportProgressData>[] = [
      { status: 'connecting', progress: 10 },
      { status: 'fetching', progress: 30 },
      { status: 'matching', progress: 50, totalProducts: 25 },
      { status: 'creating', progress: 70, importedProducts: 12, matchedProducts: 8 },
      { status: 'creating', progress: 90, importedProducts: 20, matchedProducts: 8, newProducts: 17 },
      { status: 'complete', progress: 100, importedProducts: 25, matchedProducts: 8, newProducts: 17 },
    ];
    
    for (const step of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      updateFormData({
        import: {
          ...formData.import,
          ...step,
        },
      });
    }
    
    setIsImporting(false);
  }, [formData.import, updateFormData]);
  
  const importStatus = formData.import.status;
  const progress = formData.import.progress;
  
  const statusMessages: Record<string, string> = {
    idle: 'Ready to import products',
    connecting: `Connecting to ${formData.connection.platform}...`,
    fetching: 'Fetching product catalog...',
    matching: 'Matching products to catalog...',
    creating: 'Creating marketplace listings...',
    complete: 'Import complete!',
    error: 'Import failed',
  };

  return (
    <div>
      {importStatus === 'idle' && (
        <>
          <p style={{ marginBottom: '1.5rem', color: '#374151' }}>
            Ready to import products from your {formData.connection.platform} store.
          </p>
          
          <div style={styles.infoBox('info')}>
            <h4 style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.5rem' }}>
              What happens during import:
            </h4>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#1e40af' }}>
              <li style={{ marginBottom: '0.25rem' }}>Connect to your {formData.connection.platform} store</li>
              <li style={{ marginBottom: '0.25rem' }}>Fetch your product catalog</li>
              <li style={{ marginBottom: '0.25rem' }}>Match products to our canonical catalog (GTIN/name)</li>
              <li style={{ marginBottom: '0.25rem' }}>Create marketplace listings</li>
              <li>Update search index for AI discovery</li>
            </ol>
          </div>
          
          <button
            style={{ ...styles.button('primary'), marginTop: '1rem', width: '100%' }}
            onClick={startImport}
            disabled={isImporting}
          >
            🚀 Start Import
          </button>
        </>
      )}
      
      {(importStatus !== 'idle' && importStatus !== 'complete') && (
        <>
          <p style={{ marginBottom: '1rem', color: '#374151' }}>
            {statusMessages[importStatus]}
          </p>
          
          <div style={styles.progressBar}>
            <div style={styles.progressFill(progress)} />
          </div>
          
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            {progress}% complete
          </p>
          
          {formData.import.totalProducts > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formData.import.totalProducts}</div>
                <div style={styles.statLabel}>Total Products</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formData.import.matchedProducts}</div>
                <div style={styles.statLabel}>Matched</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formData.import.importedProducts}</div>
                <div style={styles.statLabel}>Imported</div>
              </div>
            </div>
          )}
        </>
      )}
      
      {importStatus === 'complete' && (
        <div style={styles.infoBox('success')}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#166534', marginBottom: '1rem' }}>
            ✅ Import Complete!
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#166534' }}>
                {formData.import.importedProducts}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#166534' }}>Products Imported</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#166534' }}>
                {formData.import.matchedProducts}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#166534' }}>Matched to Catalog</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#166534' }}>
                {formData.import.newProducts}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#166534' }}>New Products</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompleteStep({ formData }: StepProps) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
        You're All Set!
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Your products are now live on Better Data Marketplace and searchable
        across Claude, ChatGPT, and Grok.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formData.import.importedProducts}</div>
          <div style={styles.statLabel}>Products Listed</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>3</div>
          <div style={styles.statLabel}>AI Platforms</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>✓</div>
          <div style={styles.statLabel}>Profile Complete</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>🚀</div>
          <div style={styles.statLabel}>Ready to Sell</div>
        </div>
      </div>
      
      <div style={{ ...styles.infoBox('info'), textAlign: 'left' }}>
        <h4 style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.75rem' }}>
          📌 Next Steps:
        </h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#1e40af' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Enable Signal Tags</strong> - Boost your ranking by +20 points per product
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Set competitive pricing</strong> - Compare against other sellers
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Complete your profile</strong> - Add logo and banner images
          </li>
          <li>
            <strong>Monitor analytics</strong> - Track which AI platforms drive sales
          </li>
        </ul>
      </div>
      
      <button
        style={{ ...styles.button('primary'), marginTop: '1.5rem', padding: '1rem 2rem', fontSize: '1rem' }}
        onClick={() => window.location.href = '/dashboard'}
      >
        View Dashboard →
      </button>
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export interface MarketplaceOnboardingProps {
  onComplete?: (data: OnboardingFormData) => void;
  initialData?: Partial<OnboardingFormData>;
}

export function MarketplaceOnboarding({ 
  onComplete,
  initialData,
}: MarketplaceOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    ...INITIAL_FORM_DATA,
    ...initialData,
  });
  
  const step = ONBOARDING_STEPS[currentStep];
  
  const updateFormData = useCallback((data: Partial<OnboardingFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);
  
  const canProceed = useCallback(() => {
    switch (step.id) {
      case 'welcome':
        return true;
      case 'profile':
        return formData.profile.displayName.trim().length > 0;
      case 'connect':
        return formData.connection.platform !== null;
      case 'import':
        return formData.import.status === 'complete';
      case 'complete':
        return true;
      default:
        return false;
    }
  }, [step.id, formData]);
  
  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
    
    if (currentStep === ONBOARDING_STEPS.length - 1 && onComplete) {
      onComplete(formData);
    }
  }, [currentStep, canProceed, onComplete, formData]);
  
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const stepProps: StepProps = {
    formData,
    updateFormData,
    onNext: handleNext,
  };

  return (
    <div style={styles.container}>
      {/* Progress Indicator */}
      <div style={styles.progressContainer}>
        <div style={styles.progressSteps}>
          {ONBOARDING_STEPS.map((s, i) => (
            <div key={s.id} style={styles.progressStep(i === currentStep, i < currentStep)}>
              <div style={styles.stepNumber(i === currentStep, i < currentStep)}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <div style={styles.stepTitle(i === currentStep)}>{s.title}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Step Card */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>{step.title}</h2>
          {step.description && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {step.description}
            </p>
          )}
        </div>
        <div style={styles.cardContent}>
          {step.id === 'welcome' && <WelcomeStep {...stepProps} />}
          {step.id === 'profile' && <ProfileStep {...stepProps} />}
          {step.id === 'connect' && <ConnectStep {...stepProps} />}
          {step.id === 'import' && <ImportStep {...stepProps} />}
          {step.id === 'complete' && <CompleteStep {...stepProps} />}
        </div>
      </div>
      
      {/* Navigation */}
      <div style={styles.navigation}>
        <button
          style={styles.button(currentStep === 0 ? 'disabled' : 'outline')}
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          ← Back
        </button>
        
        {currentStep < ONBOARDING_STEPS.length - 1 && (
          <button
            style={styles.button(canProceed() ? 'primary' : 'disabled')}
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {currentStep === ONBOARDING_STEPS.length - 2 ? 'Finish Setup' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default MarketplaceOnboarding;

