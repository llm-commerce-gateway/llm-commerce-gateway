'use client';

import { useState } from 'react';
import type { ProductResult } from '../lib/parse-tool-results';

export function ProductCard({ product }: { product: ProductResult }) {
  const [cartState, setCartState] = useState<'idle' | 'added'>('idle');

  const price =
    product.price > 0
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: product.currency ?? 'USD',
        }).format(product.price)
      : null;

  function handleAddToCart() {
    if (cartState === 'added') return;
    setCartState('added');
    // Reset after 2s so the button is reusable during demo
    setTimeout(() => setCartState('idle'), 2000);
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:min-w-0">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="mb-1 h-32 w-full rounded-md object-cover"
        />
      ) : null}

      <p className="text-sm font-semibold leading-tight text-gray-900">{product.name}</p>

      {product.brand ? (
        <p className="text-xs text-gray-500">{product.brand}</p>
      ) : null}

      {price ? (
        <p className="text-sm font-medium text-gray-800">{price}</p>
      ) : null}

      {product.description ? (
        <p className="text-xs leading-snug text-gray-500 line-clamp-2">{product.description}</p>
      ) : null}

      <span
        className={`mt-1 text-xs font-medium ${
          product.inStock ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {product.inStock ? '● In stock' : '○ Out of stock'}
      </span>

      {product.sku ? (
        <p className="text-xs text-gray-400">SKU: {product.sku}</p>
      ) : null}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!product.inStock}
        className={`mt-2 rounded border px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
          !product.inStock
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
            : cartState === 'added'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
        }`}
      >
        {!product.inStock
          ? 'Unavailable'
          : cartState === 'added'
            ? '✓ Added to cart'
            : 'Add to cart'}
      </button>
    </div>
  );
}
