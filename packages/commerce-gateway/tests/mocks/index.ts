/**
 * @betterdata/llm-gateway - Test Mocks Index
 * 
 * Export all mocks for easy importing in tests.
 * 
 * @license MIT
 */

// Backend mocks
export {
  MockProductBackend,
  MockCartBackend,
  MockOrderBackend,
  MockLinkGenerator,
  MOCK_PRODUCTS,
  type MockProductBackendOptions,
  type MockCartBackendOptions,
  type MockOrderBackendOptions,
  type MockLinkGeneratorOptions,
} from './backends';

// Fixtures
export {
  // ID generation
  generateId,
  resetIdCounter,
  
  // Product fixtures
  createProduct,
  createProductBatch,
  type ProductFixtureOptions,
  
  // Cart fixtures
  createCart,
  createCartItem,
  createCartWithItems,
  type CartFixtureOptions,
  type CartItemFixtureOptions,
  
  // Order fixtures
  createOrder,
  type OrderFixtureOptions,
  
  // Inventory fixtures
  createInventoryStatus,
  type InventoryFixtureOptions,
  
  // Recommendation fixtures
  createRecommendation,
  createRecommendationBatch,
  type RecommendationFixtureOptions,
  
  // Link fixtures
  createShortLink,
  type ShortLinkFixtureOptions,
  
  // Request fixtures
  createToolCallRequest,
  createSessionRequest,
  
  // Response fixtures
  createSuccessResponse,
  createErrorResponse,
} from './fixtures';

