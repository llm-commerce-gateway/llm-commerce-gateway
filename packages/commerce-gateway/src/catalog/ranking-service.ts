/**
 * Ranking Service for Marketplace Search
 * 
 * Multi-factor ranking algorithm for search results.
 * 
 * @module catalog/ranking-service
 */

// ============================================================================
// Types
// ============================================================================

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface SearchResultRow {
  listingId: string;
  productMasterId: string;
  vendorOrgId: string;
  vendorName: string;
  vendorRating: number | null;
  platform?: string | null;
  merchantId?: string | null;
  platformProductId?: string | null;
  platformVariantId?: string | null;
  price: number;
  currency: string;
  authenticated: boolean;
  inStock: boolean;
  availableQuantity: number | null;
  locationLat: number | null;
  locationLng: number | null;
  city: string | null;
  state: string | null;
  distance?: number;
  relevance: number;
}

export interface RankedListing extends SearchResultRow {
  relevanceScore: number;
  rankFactors: RankFactors;
}

export interface RankFactors {
  relevance: number;
  price: number;
  distance: number;
  vendorRating: number;
  inStock: number;
  authenticated: number;
}

export interface RankingOptions {
  userLocation?: UserLocation;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'distance';
}

// ============================================================================
// Weight Configuration
// ============================================================================

const WEIGHTS = {
  relevance: 0.3,
  price: 0.2,
  distance: 0.15,
  vendorRating: 0.15,
  inStock: 0.1,
  authenticated: 0.1,
};

// ============================================================================
// Distance Calculation
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  from: UserLocation,
  to: { lat: number; lng: number }
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// Ranking Algorithm
// ============================================================================

/**
 * Rank search result listings using multi-factor scoring
 */
export function rankListings(
  listings: SearchResultRow[],
  options: RankingOptions = {}
): RankedListing[] {
  if (listings.length === 0) return [];

  // Calculate score ranges for normalization
  const prices = listings.map(l => l.price).filter(p => p > 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  const distances = listings
    .map(l => l.distance)
    .filter((d): d is number => d !== undefined && d > 0);
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 1;

  // Score each listing
  const rankedListings: RankedListing[] = listings.map(listing => {
    const factors: RankFactors = {
      relevance: listing.relevance,
      price: normalizePriceScore(listing.price, minPrice, maxPrice),
      distance: normalizeDistanceScore(listing.distance, maxDistance),
      vendorRating: normalizeRatingScore(listing.vendorRating),
      inStock: listing.inStock ? 1 : 0,
      authenticated: listing.authenticated ? 1 : 0,
    };

    const relevanceScore = calculateWeightedScore(factors);

    return {
      ...listing,
      relevanceScore,
      rankFactors: factors,
    };
  });

  // Sort based on options
  return sortListings(rankedListings, options);
}

function normalizePriceScore(price: number, min: number, max: number): number {
  if (max === min) return 1;
  // Lower price = higher score
  return 1 - (price - min) / (max - min);
}

function normalizeDistanceScore(distance: number | undefined, maxDistance: number): number {
  if (distance === undefined) return 0.5; // Neutral if no distance
  if (maxDistance === 0) return 1;
  // Closer = higher score
  return 1 - (distance / maxDistance);
}

function normalizeRatingScore(rating: number | null): number {
  if (rating === null) return 0.5; // Neutral if no rating
  return rating / 5; // Assuming 5-star scale
}

function calculateWeightedScore(factors: RankFactors): number {
  return (
    factors.relevance * WEIGHTS.relevance +
    factors.price * WEIGHTS.price +
    factors.distance * WEIGHTS.distance +
    factors.vendorRating * WEIGHTS.vendorRating +
    factors.inStock * WEIGHTS.inStock +
    factors.authenticated * WEIGHTS.authenticated
  );
}

function sortListings(listings: RankedListing[], options: RankingOptions): RankedListing[] {
  const sorted = [...listings];

  switch (options.sortBy) {
    case 'price_low':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price_high':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'distance':
      sorted.sort((a, b) => {
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return distA - distB;
      });
      break;
    case 'relevance':
    default:
      sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
      break;
  }

  return sorted;
}

