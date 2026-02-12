/// <reference lib="dom" />
/**
 * Onboarding API Hook
 * 
 * Provides API integration for the onboarding wizard:
 * - Save vendor profile
 * - Start OAuth flows
 * - Import products with progress tracking
 */

import { useState, useCallback, useRef } from 'react';
import type { 
  VendorProfileData, 
  PlatformType, 
  ImportProgressData,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingApiConfig {
  baseUrl?: string;
  organizationId: string;
  onError?: (error: Error) => void;
}

export interface OnboardingApiResult {
  // Profile API
  saveProfile: (profile: VendorProfileData) => Promise<boolean>;
  isSavingProfile: boolean;
  profileSaveError: string | null;
  
  // Connection API
  startOAuth: (platform: Exclude<PlatformType, null>) => Promise<void>;
  checkConnectionStatus: () => Promise<boolean>;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Import API
  startImport: (platformAccountId: string) => Promise<string | null>;
  pollImportProgress: (jobId: string) => void;
  cancelImportPolling: () => void;
  importProgress: ImportProgressData;
  isImporting: boolean;
  importError: string | null;
}

export interface ImportStatusResponse {
  jobId: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  total: number;
  imported: number;
  matched: number;
  created: number;
  errors: number;
  errorMessages: string[];
  completed: boolean;
}

export interface OAuthStartResponse {
  authorizationUrl: string;
  state: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useOnboardingApi(config: OnboardingApiConfig): OnboardingApiResult {
  const { baseUrl = '/api/marketplace', organizationId, onError } = config;
  
  // Profile state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  
  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressData>({
    status: 'idle',
    progress: 0,
    totalProducts: 0,
    importedProducts: 0,
    matchedProducts: 0,
    newProducts: 0,
    errors: [],
  });
  
  // Polling interval ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================================================
  // Error Handler
  // ==========================================================================

  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Onboarding ${context} error:`, error);
    onError?.(error);
  }, [onError]);

  // ==========================================================================
  // Profile API
  // ==========================================================================

  const saveProfile = useCallback(async (profile: VendorProfileData): Promise<boolean> => {
    setIsSavingProfile(true);
    setProfileSaveError(null);
    
    try {
      const response = await fetch(`${baseUrl}/vendor-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          ...profile,
        }),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      setProfileSaveError(message);
      handleError(error instanceof Error ? error : new Error(message), 'saveProfile');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }, [baseUrl, organizationId, handleError]);

  // ==========================================================================
  // Connection API
  // ==========================================================================

  const startOAuth = useCallback(async (platform: Exclude<PlatformType, null>): Promise<void> => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      const response = await fetch(`/api/integrations/${platform}/oauth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json() as OAuthStartResponse;
      
      // Redirect to OAuth authorization page
      window.location.href = data.authorizationUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start OAuth';
      setConnectionError(message);
      handleError(error instanceof Error ? error : new Error(message), 'startOAuth');
      setIsConnecting(false);
    }
    // Note: Don't set isConnecting to false here - user will be redirected
  }, [organizationId, handleError]);

  const checkConnectionStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/connection/status?organizationId=${organizationId}`);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json() as { connected?: boolean };
      return data.connected === true;
    } catch {
      return false;
    }
  }, [baseUrl, organizationId]);

  // ==========================================================================
  // Import API
  // ==========================================================================

  const startImport = useCallback(async (platformAccountId: string): Promise<string | null> => {
    setIsImporting(true);
    setImportError(null);
    setImportProgress({
      status: 'connecting',
      progress: 5,
      totalProducts: 0,
      importedProducts: 0,
      matchedProducts: 0,
      newProducts: 0,
      errors: [],
    });
    
    try {
      const response = await fetch(`${baseUrl}/import/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          platformAccountId,
        }),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json() as { jobId: string };
      return data.jobId;
    } catch (error) {
      const err = error as Error | { error?: string };
      const message = err instanceof Error ? err.message : (err.error || 'Failed to start import');
      setImportError(message);
      setImportProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [message],
      }));
      handleError(error instanceof Error ? error : new Error(message), 'startImport');
      setIsImporting(false);
      return null;
    }
  }, [baseUrl, organizationId, handleError]);

  const pollImportProgress = useCallback((jobId: string) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    const fetchProgress = async () => {
      try {
        const response = await fetch(`${baseUrl}/import/status/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json() as ImportStatusResponse;
        
        // Calculate progress percentage
        const progress = data.status === 'complete' 
          ? 100 
          : data.total > 0 
            ? Math.round((data.imported / data.total) * 100)
            : 10;
        
        // Map status
        let status: ImportProgressData['status'];
        switch (data.status) {
          case 'pending':
            status = 'connecting';
            break;
          case 'running':
            status = data.imported > 0 ? 'creating' : 'fetching';
            break;
          case 'complete':
            status = 'complete';
            break;
          case 'error':
            status = 'error';
            break;
          default:
            status = 'fetching';
        }
        
        setImportProgress({
          status,
          progress,
          totalProducts: data.total,
          importedProducts: data.imported,
          matchedProducts: data.matched,
          newProducts: data.created,
          errors: data.errorMessages,
        });
        
        // Stop polling when complete or error
        if (data.completed || data.status === 'error') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsImporting(false);
          
          if (data.status === 'error') {
            setImportError(data.errorMessages[0] || 'Import failed');
          }
        }
      } catch (error) {
        console.error('Error polling import progress:', error);
        // Continue polling despite errors
      }
    };
    
    // Initial fetch
    fetchProgress();
    
    // Start polling every 2 seconds
    pollIntervalRef.current = setInterval(fetchProgress, 2000);
  }, [baseUrl]);

  const cancelImportPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // ==========================================================================
  // Return API
  // ==========================================================================

  return {
    // Profile
    saveProfile,
    isSavingProfile,
    profileSaveError,
    
    // Connection
    startOAuth,
    checkConnectionStatus,
    isConnecting,
    connectionError,
    
    // Import
    startImport,
    pollImportProgress,
    cancelImportPolling,
    importProgress,
    isImporting,
    importError,
  };
}

export default useOnboardingApi;

