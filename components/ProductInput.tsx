"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

interface ProductInputProps {
  onScrape: (url: string) => void;
  loading: boolean;
}

export default function ProductInput({ onScrape, loading }: ProductInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a product URL");
      return;
    }

    if (!url.includes("luxemia.shop")) {
      setError("URL must be from luxemia.shop");
      return;
    }

    onScrape(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="https://luxemia.shop/products/..."
            className="w-full rounded-lg bg-gray-900 border border-gray-700 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            "Scrape Product"
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}
