/**
 * Marketplace Analytics Dashboard Types
 */

// Re-export core analytics types
export {
  type AnalyticsPeriod,
  type OverviewStats,
  type OverviewResponse,
  type ProviderAttribution,
  type AttributionResponse,
  type Competitor,
  type CompetitiveResponse,
  type Recommendation,
  type RecommendationsResponse,
  type ProductPerformance,
  type ProductPerformanceResponse,
} from '../../analytics/types';

// ============================================================================
// Dashboard-specific Types
// ============================================================================

export interface MarketplaceAnalyticsProps {
  vendorOrgId: string;
  className?: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
  trendLabel?: string;
}

export interface ChartDataPoint {
  provider: string;
  events: number;
  revenue: number;
  percentage: number;
}

export interface CompetitorRowProps {
  competitor: {
    vendorId: string;
    vendorName: string;
    sharedProducts: number;
    avgPrice: number;
    avgRating?: number;
    authenticated?: boolean;
  };
  myAvgPrice?: number;
}

export interface RecommendationCardProps {
  recommendation: {
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    action: {
      label: string;
      url: string;
    };
  };
}

