/**
 * Simple Product Search Example - Product Data
 * 
 * A minimal 10-product catalog for demonstration.
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  inStock: boolean;
}

export const products: Product[] = [
  {
    id: 'shoe-001',
    name: 'CloudRunner Pro',
    description: 'Lightweight running shoes with responsive cushioning',
    price: 89.99,
    category: 'Footwear',
    tags: ['running', 'athletic', 'lightweight'],
    inStock: true,
  },
  {
    id: 'shoe-002',
    name: 'TrailMaster X',
    description: 'Rugged hiking boots for any terrain',
    price: 149.99,
    category: 'Footwear',
    tags: ['hiking', 'outdoor', 'waterproof'],
    inStock: true,
  },
  {
    id: 'jacket-001',
    name: 'Alpine Fleece',
    description: 'Cozy fleece jacket for cold weather',
    price: 79.99,
    category: 'Outerwear',
    tags: ['fleece', 'warm', 'casual'],
    inStock: true,
  },
  {
    id: 'jacket-002',
    name: 'StormShield Rain Jacket',
    description: 'Waterproof jacket with sealed seams',
    price: 129.99,
    category: 'Outerwear',
    tags: ['rain', 'waterproof', 'lightweight'],
    inStock: false,
  },
  {
    id: 'pants-001',
    name: 'FlexFit Joggers',
    description: 'Comfortable joggers with 4-way stretch',
    price: 54.99,
    category: 'Pants',
    tags: ['athletic', 'casual', 'comfortable'],
    inStock: true,
  },
  {
    id: 'pants-002',
    name: 'Summit Cargo Pants',
    description: 'Durable cargo pants with multiple pockets',
    price: 69.99,
    category: 'Pants',
    tags: ['outdoor', 'durable', 'cargo'],
    inStock: true,
  },
  {
    id: 'shirt-001',
    name: 'BreatheTech Tee',
    description: 'Moisture-wicking performance t-shirt',
    price: 29.99,
    category: 'Tops',
    tags: ['athletic', 'moisture-wicking', 'lightweight'],
    inStock: true,
  },
  {
    id: 'shirt-002',
    name: 'Merino Base Layer',
    description: 'Premium wool base layer for cold weather',
    price: 89.99,
    category: 'Tops',
    tags: ['wool', 'warm', 'base-layer'],
    inStock: true,
  },
  {
    id: 'bag-001',
    name: 'DayPack 25L',
    description: 'Versatile daypack for hiking and travel',
    price: 99.99,
    category: 'Bags',
    tags: ['backpack', 'hiking', 'travel'],
    inStock: true,
  },
  {
    id: 'acc-001',
    name: 'Summit Sunglasses',
    description: 'Polarized sunglasses with UV protection',
    price: 59.99,
    category: 'Accessories',
    tags: ['sunglasses', 'outdoor', 'polarized'],
    inStock: true,
  },
];

