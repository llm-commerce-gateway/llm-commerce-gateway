/**
 * Marketplace Onboarding Wizard (API-Connected)
 * 
 * Full-featured onboarding wizard with real API integration:
 * - Saves vendor profile to backend
 * - Initiates OAuth flows for Shopify/Square/WooCommerce/Google Merchant
 * - Imports products with progress tracking
 * - Handles errors gracefully
 * 
 * @module components/onboarding/MarketplaceOnboardingConnected
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { 
  OnboardingFormData, 
  PlatformType,
  VendorProfileData,
} from './types.js';
import { ONBOARDING_STEPS, INITIAL_FORM_DATA } from './types.js';
import { useOnboardingApi } from './useOnboardingApi.js';

// ============================================================================
// Types
// ============================================================================

export interface MarketplaceOnboardingConnectedProps {
  organizationId: string;
  platformAccountId?: string; // If already connected via OAuth callback
  onComplete?: (data: OnboardingFormData) => void;
  onError?: (error: Error) => void;
  apiBaseUrl?: string;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    padding: '3rem 1rem',
  },
  inner: {
    maxWidth: '56rem',
    margin: '0 auto',
  },
  progressBar: {
    marginBottom: '2rem',
  },
  progressSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    position: 'relative' as const,
  },
  progressLine: {
    position: 'absolute' as const,
    top: '1.25rem',
    left: '10%',
    right: '10%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    zIndex: 0,
  },
  progressLineFill: (progress: number) => ({
    height: '100%',
    backgroundColor: '#6366f1',
    width: `${progress}%`,
    transition: 'width 0.3s ease',
  }),
  stepDot: (isActive: boolean, isComplete: boolean) => ({
    position: 'relative' as const,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
  }),
  stepCircle: (isActive: boolean, isComplete: boolean) => ({
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isComplete ? '#22c55e' : isActive ? '#6366f1' : '#fff',
    border: isComplete || isActive ? 'none' : '2px solid #e5e7eb',
    color: isComplete || isActive ? '#fff' : '#9ca3af',
    fontWeight: 600,
    fontSize: '0.875rem',
  }),
  stepLabel: (isActive: boolean) => ({
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: isActive ? '#111827' : '#6b7280',
    fontWeight: isActive ? 600 : 400,
    textAlign: 'center' as const,
  }),
  card: {
    backgroundColor: '#fff',
    borderRadius: '1rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '2rem',
  },
  cardHeader: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  cardTitle: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  cardSubtitle: {
    color: '#6b7280',
    marginTop: '0.5rem',
    fontSize: '1rem',
  },
  button: (variant: 'primary' | 'secondary' | 'outline' | 'disabled') => ({
    padding: '0.875rem 1.75rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: variant === 'disabled' ? 'not-allowed' : 'pointer',
    border: variant === 'outline' ? '2px solid #e5e7eb' : 'none',
    backgroundColor: 
      variant === 'primary' ? '#6366f1' : 
      variant === 'secondary' ? '#f3f4f6' :
      variant === 'disabled' ? '#e5e7eb' : '#fff',
    color: 
      variant === 'primary' ? '#fff' : 
      variant === 'disabled' ? '#9ca3af' : '#374151',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  }),
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '0.5rem',
    border: '2px solid #e5e7eb',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  textarea: {
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '0.5rem',
    border: '2px solid #e5e7eb',
    fontSize: '1rem',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '100px',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.5rem',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  alert: (variant: 'error' | 'success' | 'info') => ({
    padding: '1rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
    backgroundColor: 
      variant === 'error' ? '#fef2f2' :
      variant === 'success' ? '#f0fdf4' : '#eff6ff',
    border: `1px solid ${
      variant === 'error' ? '#fecaca' :
      variant === 'success' ? '#bbf7d0' : '#bfdbfe'
    }`,
    color: 
      variant === 'error' ? '#dc2626' :
      variant === 'success' ? '#16a34a' : '#2563eb',
  }),
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  platformCard: (isSelected: boolean) => ({
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: `2px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
    backgroundColor: isSelected ? '#eef2ff' : '#fff',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.15s ease',
  }),
  progressContainer: {
    marginTop: '2rem',
  },
  progressBarFull: {
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
    transition: 'width 0.3s ease',
  }),
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  statCard: {
    textAlign: 'center' as const,
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.75rem',
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
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e5e7eb',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function MarketplaceOnboardingConnected({
  organizationId,
  platformAccountId,
  onComplete,
  onError,
  apiBaseUrl,
}: MarketplaceOnboardingConnectedProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  
  const api = useOnboardingApi({
    organizationId,
    baseUrl: apiBaseUrl,
    onError,
  });
  
  const step = ONBOARDING_STEPS[currentStep];
  
  // If returning from OAuth with platformAccountId, skip to import
  useEffect(() => {
    if (platformAccountId && currentStep < 3) {
      setCurrentStep(3);
      setFormData(prev => ({
        ...prev,
        connection: {
          ...prev.connection,
          connected: true,
        },
      }));
    }
  }, [platformAccountId, currentStep]);
  
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
        return api.importProgress.status === 'complete';
      case 'complete':
        return true;
      default:
        return false;
    }
  }, [step.id, formData, api.importProgress.status]);
  
  const handleNext = useCallback(async () => {
    // Special handling for profile step - save to API
    if (step.id === 'profile') {
      const success = await api.saveProfile(formData.profile);
      if (!success) return; // Error handled by hook
    }
    
    // Special handling for connect step - start OAuth
    if (step.id === 'connect' && formData.connection.platform) {
      api.startOAuth(formData.connection.platform);
      return; // Will redirect to OAuth
    }
    
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
    
    if (currentStep === ONBOARDING_STEPS.length - 1 && onComplete) {
      onComplete(formData);
    }
  }, [currentStep, step.id, formData, api, onComplete]);
  
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);
  
  const handleStartImport = useCallback(async () => {
    if (!platformAccountId) {
      console.error('No platform account ID');
      return;
    }
    
    const jobId = await api.startImport(platformAccountId);
    if (jobId) {
      api.pollImportProgress(jobId);
    }
  }, [platformAccountId, api]);
  
  // Calculate progress for the progress bar
  const progressPercent = ((currentStep) / (ONBOARDING_STEPS.length - 1)) * 100;
  
  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Progress Bar */}
        <div style={styles.progressBar}>
          <div style={styles.progressSteps}>
            <div style={styles.progressLine}>
              <div style={styles.progressLineFill(progressPercent)} />
            </div>
            {ONBOARDING_STEPS.map((s, i) => (
              <div key={s.id} style={styles.stepDot(i === currentStep, i < currentStep)}>
                <div style={styles.stepCircle(i === currentStep, i < currentStep)}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <div style={styles.stepLabel(i === currentStep)}>{s.title}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Step Card */}
        <div style={styles.card}>
          {/* Step 1: Welcome */}
          {step.id === 'welcome' && (
            <WelcomeStep onNext={handleNext} />
          )}
          
          {/* Step 2: Profile */}
          {step.id === 'profile' && (
            <ProfileStep
              profile={formData.profile}
              onUpdate={(profile) => updateFormData({ profile: { ...formData.profile, ...profile } })}
              isSaving={api.isSavingProfile}
              error={api.profileSaveError}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {/* Step 3: Connect */}
          {step.id === 'connect' && (
            <ConnectStep
              selectedPlatform={formData.connection.platform}
              onSelectPlatform={(platform) => updateFormData({
                connection: { ...formData.connection, platform },
              })}
              isConnecting={api.isConnecting}
              error={api.connectionError}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {/* Step 4: Import */}
          {step.id === 'import' && (
            <ImportStep
              progress={api.importProgress}
              isImporting={api.isImporting}
              error={api.importError}
              onStartImport={handleStartImport}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {/* Step 5: Complete */}
          {step.id === 'complete' && (
            <CompleteStep
              importedCount={api.importProgress.importedProducts}
              matchedCount={api.importProgress.matchedProducts}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div style={styles.cardHeader}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
        <h1 style={styles.cardTitle}>Welcome to Better Data Marketplace!</h1>
        <p style={styles.cardSubtitle}>
          Reach customers on Claude, ChatGPT, and Grok with AI-powered product discovery.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2.5rem' }}>🤖</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>AI-Native</div>
          <div style={styles.statLabel}>Sell through AI assistants</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2.5rem' }}>✓</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Authenticated</div>
          <div style={styles.statLabel}>Signal Tag verified</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2.5rem' }}>📊</div>
          <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Analytics</div>
          <div style={styles.statLabel}>Track LLM attribution</div>
        </div>
      </div>
      
      <div style={{ ...styles.alert('info'), textAlign: 'center' }}>
        ⏱️ Setup takes about 10 minutes
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <button style={styles.button('primary')} onClick={onNext}>
          Get Started →
        </button>
      </div>
    </>
  );
}

function ProfileStep({
  profile,
  onUpdate,
  isSaving,
  error,
  onNext,
  onBack,
}: {
  profile: VendorProfileData;
  onUpdate: (data: Partial<VendorProfileData>) => void;
  isSaving: boolean;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Create Your Vendor Profile</h2>
        <p style={styles.cardSubtitle}>
          This information will be shown to customers when they find your products
        </p>
      </div>
      
      {error && (
        <div style={styles.alert('error')}>
          ❌ {error}
        </div>
      )}
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Display Name *</label>
        <input
          type="text"
          style={styles.input}
          value={profile.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          placeholder="Your Store Name"
        />
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Tagline</label>
        <input
          type="text"
          style={styles.input}
          value={profile.tagline}
          onChange={(e) => onUpdate({ tagline: e.target.value })}
          placeholder="e.g., Authentic sneakers since 2015"
        />
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Description</label>
        <textarea
          style={styles.textarea}
          value={profile.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Tell customers about your store..."
        />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Return Policy</label>
          <textarea
            style={{ ...styles.textarea, minHeight: '80px' }}
            value={profile.returnPolicy}
            onChange={(e) => onUpdate({ returnPolicy: e.target.value })}
            placeholder="e.g., 30-day returns in original condition"
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Shipping Policy</label>
          <textarea
            style={{ ...styles.textarea, minHeight: '80px' }}
            value={profile.shippingPolicy}
            onChange={(e) => onUpdate({ shippingPolicy: e.target.value })}
            placeholder="e.g., Free shipping on orders over $100"
          />
        </div>
      </div>
      
      <div style={styles.navigation}>
        <button style={styles.button('outline')} onClick={onBack}>
          ← Back
        </button>
        <button 
          style={styles.button(profile.displayName.trim() ? (isSaving ? 'disabled' : 'primary') : 'disabled')}
          onClick={onNext}
          disabled={!profile.displayName.trim() || isSaving}
        >
          {isSaving ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    </>
  );
}

function ConnectStep({
  selectedPlatform,
  onSelectPlatform,
  isConnecting,
  error,
  onNext,
  onBack,
}: {
  selectedPlatform: PlatformType;
  onSelectPlatform: (platform: Exclude<PlatformType, null>) => void;
  isConnecting: boolean;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const platforms: { id: Exclude<PlatformType, null>; name: string; icon: string; desc: string }[] = [
    { id: 'shopify', name: 'Shopify', icon: '🛍️', desc: 'Most popular' },
    { id: 'square', name: 'Square', icon: '◼️', desc: 'Retail & POS' },
    { id: 'woocommerce', name: 'WooCommerce', icon: '🔌', desc: 'WordPress' },
    { id: 'google_merchant', name: 'Google Merchant', icon: '🔍', desc: 'Google Shopping' },
  ];
  
  return (
    <>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Connect Your Store</h2>
        <p style={styles.cardSubtitle}>
          Choose your e-commerce platform to import products
        </p>
      </div>
      
      {error && (
        <div style={styles.alert('error')}>
          ❌ {error}
        </div>
      )}
      
      <div style={styles.platformGrid}>
        {platforms.map((p) => (
          <button
            key={p.id}
            style={styles.platformCard(selectedPlatform === p.id)}
            onClick={() => onSelectPlatform(p.id)}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{p.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{p.name}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {p.desc}
            </div>
          </button>
        ))}
      </div>
      
      {selectedPlatform && (
        <div style={{ ...styles.alert('success'), marginTop: '1.5rem' }}>
          ✓ Selected: {platforms.find(p => p.id === selectedPlatform)?.name}
          <br />
          <span style={{ fontSize: '0.875rem' }}>
            Click "Connect" to authorize and link your store.
          </span>
        </div>
      )}
      
      <div style={{ ...styles.alert('info'), marginTop: '1rem' }}>
        🔒 <strong>Secure Connection:</strong> We use OAuth to securely connect. We never store your password.
      </div>
      
      <div style={styles.navigation}>
        <button style={styles.button('outline')} onClick={onBack}>
          ← Back
        </button>
        <button 
          style={styles.button(selectedPlatform && !isConnecting ? 'primary' : 'disabled')}
          onClick={onNext}
          disabled={!selectedPlatform || isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect →'}
        </button>
      </div>
    </>
  );
}

function ImportStep({
  progress,
  isImporting,
  error,
  onStartImport,
  onNext,
  onBack,
}: {
  progress: {
    status: string;
    progress: number;
    totalProducts: number;
    importedProducts: number;
    matchedProducts: number;
    newProducts: number;
    errors: string[];
  };
  isImporting: boolean;
  error: string | null;
  onStartImport: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const statusMessages: Record<string, string> = {
    idle: 'Ready to import',
    connecting: 'Connecting to your store...',
    fetching: 'Fetching product catalog...',
    matching: 'Matching products to catalog...',
    creating: 'Creating marketplace listings...',
    complete: 'Import complete!',
    error: 'Import failed',
  };
  
  return (
    <>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Import Your Products</h2>
        <p style={styles.cardSubtitle}>
          {statusMessages[progress.status] || 'Processing...'}
        </p>
      </div>
      
      {error && (
        <div style={styles.alert('error')}>
          ❌ {error}
        </div>
      )}
      
      {progress.status === 'idle' && (
        <>
          <div style={styles.alert('info')}>
            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>What happens during import:</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              <li>Fetch products from your store</li>
              <li>Match to existing products in catalog</li>
              <li>Create marketplace listings</li>
              <li>Index for AI search</li>
            </ul>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button style={styles.button('primary')} onClick={onStartImport}>
              🚀 Start Import
            </button>
          </div>
        </>
      )}
      
      {(isImporting || (progress.status !== 'idle' && progress.status !== 'complete')) && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBarFull}>
            <div style={styles.progressFill(progress.progress)} />
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#6b7280' }}>
            {progress.progress}% complete
          </div>
          
          {progress.totalProducts > 0 && (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{progress.totalProducts}</div>
                <div style={styles.statLabel}>Total</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{progress.importedProducts}</div>
                <div style={styles.statLabel}>Imported</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{progress.matchedProducts}</div>
                <div style={styles.statLabel}>Matched</div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {progress.status === 'complete' && (
        <>
          <div style={styles.alert('success')}>
            ✅ Import Complete! {progress.importedProducts} products imported successfully.
          </div>
          
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#16a34a' }}>{progress.importedProducts}</div>
              <div style={styles.statLabel}>Products Imported</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#2563eb' }}>{progress.matchedProducts}</div>
              <div style={styles.statLabel}>Matched to Catalog</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#7c3aed' }}>{progress.newProducts}</div>
              <div style={styles.statLabel}>New Products</div>
            </div>
          </div>
        </>
      )}
      
      <div style={styles.navigation}>
        <button 
          style={styles.button(isImporting ? 'disabled' : 'outline')} 
          onClick={onBack}
          disabled={isImporting}
        >
          ← Back
        </button>
        <button 
          style={styles.button(progress.status === 'complete' ? 'primary' : 'disabled')}
          onClick={onNext}
          disabled={progress.status !== 'complete'}
        >
          Continue →
        </button>
      </div>
    </>
  );
}

function CompleteStep({
  importedCount,
  matchedCount,
}: {
  importedCount: number;
  matchedCount: number;
}) {
  return (
    <>
      <div style={{ ...styles.cardHeader, marginBottom: '1rem' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={styles.cardTitle}>You're All Set!</h2>
        <p style={styles.cardSubtitle}>
          Your products are now live on Better Data Marketplace
        </p>
      </div>
      
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{importedCount}</div>
          <div style={styles.statLabel}>Products Listed</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>3</div>
          <div style={styles.statLabel}>AI Platforms</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ fontSize: '2rem' }}>🚀</div>
          <div style={styles.statLabel}>Ready to Sell</div>
        </div>
      </div>
      
      <div style={{ ...styles.alert('info'), marginTop: '2rem', textAlign: 'left' }}>
        <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>📌 Next Steps:</h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
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
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          style={{ ...styles.button('primary'), padding: '1rem 2.5rem', fontSize: '1.125rem' }}
          onClick={() => window.location.href = '/dashboard'}
        >
          View Dashboard →
        </button>
      </div>
    </>
  );
}

export default MarketplaceOnboardingConnected;

