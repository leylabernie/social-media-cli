"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface ProductInputProps {
  onScrape: (url: string) => void;
  loading: boolean;
}

export default function ProductInput({ onScrape, loading }: ProductInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onScrape(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste your Shopify product URL..."
        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
        required
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium px-6 py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 min-w-[160px]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Scraping...
          </>
        ) : (
          "Scrape Product"
        )}
      </button>
    </form>
  );
}
