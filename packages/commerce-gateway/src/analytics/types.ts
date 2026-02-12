/**
 * Analytics Types
 * 
 * Core types for the LLM Gateway analytics system.
 */

// ============================================================================
// Time Periods
// ============================================================================

export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d';

// ============================================================================
// Overview Stats
// ============================================================================

export interface OverviewStats {
  impressions: number;
  searchAppearances: number;
  cartAdds: number;
  conversions: number;
  conversionRate: number;
  orders: number;
  revenue: number;
  avgRanking: number;
  avgRank: number;
  rankingTrend: number;
}

export interface TrendData {
  impressions: number;
  searchAppearancesTrend: number;
  conversionRate: number;
  cartAddsTrend: number;
  orders: number;
  revenueTrend: number;
}

export interface OverviewResponse {
  period: AnalyticsPeriod;
  stats: OverviewStats;
  previousPeriodStats?: OverviewStats;
  trends?: TrendData;
}

// ============================================================================
// Attribution
// ============================================================================

export interface ProviderAttribution {
  provider: string;
  events: number;
  revenue: number;
  percentage: number;
  avgConversionRate?: number;
}

export interface AttributionResponse {
  period: AnalyticsPeriod;
  byProvider: ProviderAttribution[];
  totalEvents: number;
  totalRevenue: number;
}

// ============================================================================
// Competitive Analysis
// ============================================================================

export interface Competitor {
  vendorId: string;
  vendorName: string;
  sharedProducts: number;
  avgPrice: number;
  avgRating?: number;
  authenticated?: boolean;
}

export interface CompetitiveInsights {
  pricePosition: 'lower' | 'average' | 'higher';
  ratingPosition: 'lower' | 'average' | 'higher';
  marketShare?: number;
}

export interface MyStats {
  avgPrice: number;
  avgRating?: number;
  totalProducts: number;
}

export interface CompetitiveResponse {
  competitors: Competitor[];
  myStats: MyStats;
  insights?: CompetitiveInsights;
}

// ============================================================================
// Recommendations
// ============================================================================

export interface RecommendationAction {
  label: string;
  url: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  action: RecommendationAction;
  category?: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  totalPotentialBoost: number;
}

// ============================================================================
// Product Performance
// ============================================================================

export interface ProductPerformance {
  productId: string;
  productName: string;
  impressions: number;
  clicks: number;
  cartAdds: number;
  conversions: number;
  revenue: number;
  ranking: number;
}

export interface ProductPerformanceResponse {
  products: ProductPerformance[];
  period: AnalyticsPeriod;
}

