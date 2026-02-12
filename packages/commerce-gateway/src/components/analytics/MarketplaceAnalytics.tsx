/**
 * Marketplace Analytics Dashboard
 * 
 * Shows vendor performance in AI search/recommendations:
 * - Overview stats (impressions, cart adds, revenue)
 * - LLM provider attribution (Claude, ChatGPT, Grok)
 * - Competitive insights
 * - Actionable recommendations to improve ranking
 * 
 * @module components/analytics/MarketplaceAnalytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  MarketplaceAnalyticsProps,
  StatCardProps,
  RecommendationCardProps,
  CompetitorRowProps,
  AnalyticsPeriod,
  OverviewResponse,
  AttributionResponse,
  CompetitiveResponse,
  RecommendationsResponse,
  ProviderAttribution,
  Competitor,
  Recommendation,
} from './types.js';

// ============================================================================
// Main Component
// ============================================================================

export function MarketplaceAnalytics({ 
  vendorOrgId, 
  className = '' 
}: MarketplaceAnalyticsProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [attribution, setAttribution] = useState<AttributionResponse | null>(null);
  const [competitive, setCompetitive] = useState<CompetitiveResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = '/api/marketplace/analytics';
      
      const [overviewRes, attributionRes, competitiveRes, recommendationsRes] = await Promise.all([
        fetch(`${baseUrl}/overview?vendorOrgId=${vendorOrgId}&period=${period}`),
        fetch(`${baseUrl}/attribution?vendorOrgId=${vendorOrgId}&period=${period}`),
        fetch(`${baseUrl}/competitive?vendorOrgId=${vendorOrgId}`),
        fetch(`${baseUrl}/recommendations?vendorOrgId=${vendorOrgId}`),
      ]);

      if (!overviewRes.ok || !attributionRes.ok || !competitiveRes.ok || !recommendationsRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const [overviewData, attributionData, competitiveData, recommendationsData] = await Promise.all([
        overviewRes.json(),
        attributionRes.json(),
        competitiveRes.json(),
        recommendationsRes.json(),
      ]);

      setOverview(overviewData);
      setAttribution(attributionData);
      setCompetitive(competitiveData);
      setRecommendations(recommendationsData);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [vendorOrgId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className={`p-8 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error loading analytics</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-8 max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track your performance in AI-powered search and recommendations
          </p>
        </div>

        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Search Appearances"
            value={formatNumber(overview.stats.searchAppearances)}
            subtitle="Times shown in AI results"
            trend={overview.trends?.searchAppearancesTrend}
          />
          <StatCard
            title="Cart Adds"
            value={formatNumber(overview.stats.cartAdds)}
            subtitle={`${overview.stats.conversionRate.toFixed(1)}% conversion`}
            trend={overview.trends?.cartAddsTrend}
          />
          <StatCard
            title="Average Rank"
            value={overview.stats.avgRank > 0 ? `#${overview.stats.avgRank.toFixed(1)}` : 'N/A'}
            subtitle="In search results"
          />
          <StatCard
            title="Revenue"
            value={`$${formatNumber(overview.stats.revenue)}`}
            subtitle={`${overview.stats.orders} orders`}
            trend={overview.trends?.revenueTrend}
          />
        </div>
      )}

      {/* AI Platform Attribution */}
      {attribution && attribution.byProvider.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Traffic by AI Platform
          </h2>
          <p className="text-gray-600 mb-6">
            See which AI assistants are driving traffic to your products
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {attribution.byProvider.map((provider: ProviderAttribution) => (
              <ProviderCard key={provider.provider} provider={provider} />
            ))}
          </div>
        </div>
      )}

      {/* Competition */}
      {competitive && competitive.competitors.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your Competition
          </h2>
          <p className="text-gray-600 mb-6">
            Vendors selling the same products as you
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr className="text-left text-sm font-medium text-gray-500">
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 px-4">Shared Products</th>
                  <th className="py-3 px-4">Avg Price</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 pl-4">Authenticated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {competitive.competitors.slice(0, 10).map((competitor: Competitor) => (
                  <CompetitorRow
                    key={competitor.vendorId}
                    competitor={competitor}
                    myAvgPrice={competitive.myStats.avgPrice}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {competitive.insights && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900">Market Position</h3>
              <p className="text-blue-700 text-sm mt-1">
                Your pricing is {competitive.insights.pricePosition} than average.
                Your rating is {competitive.insights.ratingPosition} than average.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Improve Your Ranking
              </h2>
              <p className="text-gray-600 mt-1">
                Actionable recommendations to boost your visibility
              </p>
            </div>
            {recommendations.totalPotentialBoost > 0 && (
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                +{recommendations.totalPotentialBoost} potential ranking points
              </div>
            )}
          </div>

          <div className="space-y-4">
            {recommendations.recommendations.map((rec: Recommendation, index: number) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function PeriodSelector({
  period,
  onChange,
}: {
  period: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}) {
  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ];

  return (
    <div className="flex gap-2">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            period === value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ title, value, subtitle, trend, trendLabel }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-sm font-medium ${
              trend > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      {trendLabel && <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>}
    </div>
  );
}

function ProviderCard({
  provider,
}: {
  provider: { provider: string; events: number; revenue: number; percentage: number };
}) {
  const providerNames: Record<string, { name: string; color: string }> = {
    anthropic: { name: 'Claude', color: 'bg-orange-100 text-orange-800' },
    openai: { name: 'ChatGPT', color: 'bg-green-100 text-green-800' },
    grok: { name: 'Grok', color: 'bg-blue-100 text-blue-800' },
    google: { name: 'Gemini', color: 'bg-purple-100 text-purple-800' },
    unknown: { name: 'Other', color: 'bg-gray-100 text-gray-800' },
  };

  const { name, color } = providerNames[provider.provider] || providerNames.unknown;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-1 rounded text-sm font-medium ${color}`}>
          {name}
        </span>
        <span className="text-sm text-gray-500">{provider.percentage.toFixed(1)}%</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Events</span>
          <span className="font-medium">{formatNumber(provider.events)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Revenue</span>
          <span className="font-medium">${formatNumber(provider.revenue)}</span>
        </div>
      </div>
    </div>
  );
}

function CompetitorRow({ competitor, myAvgPrice }: CompetitorRowProps) {
  const priceDiff = myAvgPrice && competitor.avgPrice
    ? ((competitor.avgPrice - myAvgPrice) / myAvgPrice) * 100
    : null;

  return (
    <tr className="text-sm">
      <td className="py-3 pr-4 font-medium text-gray-900">{competitor.vendorName}</td>
      <td className="py-3 px-4 text-gray-600">{competitor.sharedProducts}</td>
      <td className="py-3 px-4">
        <span className="text-gray-900">${competitor.avgPrice.toFixed(2)}</span>
        {priceDiff !== null && (
          <span
            className={`ml-2 text-xs ${
              priceDiff > 5 ? 'text-green-600' : priceDiff < -5 ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(0)}%
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-gray-600">
        {competitor.avgRating ? `⭐ ${competitor.avgRating.toFixed(1)}` : '—'}
      </td>
      <td className="py-3 pl-4">
        {competitor.authenticated ? (
          <span className="text-green-600">✓ Yes</span>
        ) : (
          <span className="text-gray-400">No</span>
        )}
      </td>
    </tr>
  );
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const priorityColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                priorityColors[recommendation.priority]
              }`}
            >
              {recommendation.priority.toUpperCase()}
            </span>
            <h3 className="font-semibold text-gray-900">{recommendation.title}</h3>
          </div>
          <p className="text-gray-600 mb-2">{recommendation.description}</p>
          <p className="text-sm text-green-600">
            <strong>Impact:</strong> {recommendation.impact}
          </p>
        </div>

        <a
          href={recommendation.action.url}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          {recommendation.action.label}
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

// ============================================================================
// Exports
// ============================================================================

export default MarketplaceAnalytics;

