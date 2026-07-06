"use client";

import type { ProductInfo } from "@/lib/types";
import { Package, ExternalLink } from "lucide-react";
import Image from "next/image";

interface ProductCardProps {
  product: ProductInfo | null;
}

export default function ProductCard({ product }: ProductCardProps) {
  if (!product) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center">
          <Package className="h-6 w-6 text-gray-600" />
        </div>
        <p className="text-sm text-gray-500">
          Enter a product URL above to see the preview
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-48 h-48 bg-gray-800 flex-shrink-0">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-10 w-10 text-gray-600" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center p-5 gap-2">
          <h3 className="text-lg font-semibold text-white leading-snug">
            {product.title}
          </h3>
          <p className="text-xl font-bold text-rose-500">{product.price}</p>
          {product.description && (
            <p className="text-sm text-gray-400 line-clamp-2">
              {product.description}
            </p>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 transition-colors mt-1"
          >
            View Product
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
