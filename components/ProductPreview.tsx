"use client";

import Image from "next/image";
import { Tag } from "lucide-react";
import { ProductInfo } from "@/lib/types";

interface ProductPreviewProps {
  product: ProductInfo;
}

export default function ProductPreview({ product }: ProductPreviewProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="relative w-full h-64 bg-gray-800">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Tag className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-white text-lg mb-2">{product.title}</h3>
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{product.description}</p>
        <p className="text-rose-500 font-bold text-xl">{product.price}</p>
      </div>
    </div>
  );
}
