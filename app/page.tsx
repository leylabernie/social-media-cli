"use client";

import { useState, useEffect, useCallback } from "react";
import ProductInput from "@/components/ProductInput";
import ProductCard from "@/components/ProductCard";
import CaptionReview from "@/components/CaptionReview";
import PlatformSelector from "@/components/PlatformSelector";
import PostButton from "@/components/PostButton";
import ResultsPanel from "@/components/ResultsPanel";
import PostHistory from "@/components/PostHistory";
import StatusBar from "@/components/StatusBar";

interface ProductInfo {
  title: string;
  description: string;
  price: string;
  url: string;
  imageUrl: string;
  tags: string[];
}

interface CaptionResult {
  platform: string;
  caption: string;
}

interface PostResult {
  platform: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

interface PlatformStatus {
  platform: string;
  displayName: string;
  authenticated: boolean;
  lastCheck: string;
}

interface PostRecord {
  id: string;
  productUrl: string;
  productTitle: string;
  productImageUrl: string;
  createdAt: string;
  status: string;
  results: PostResult[];
}

const ALL_PLATFORMS = ["x", "instagram", "facebook", "pinterest", "linkedin"];

export default function Dashboard() {
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [captions, setCaptions] = useState<CaptionResult[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(ALL_PLATFORMS);
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState({
    scrape: false,
    caption: false,
    post: false,
  });
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (data.platforms) setPlatforms(data.platforms);
    } catch {
      // silent fail
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, [fetchStatus, fetchHistory]);

  const handleScrape = async (url: string) => {
    setError("");
    setLoading((p) => ({ ...p, scrape: true }));
    setCaptions([]);
    setResults(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scrape failed");
      setProduct(data.product);

      // Auto-generate captions
      setLoading((p) => ({ ...p, caption: true }));
      const capRes = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: data.product, platforms: ALL_PLATFORMS }),
      });
      const capData = await capRes.json();
      if (capData.captions) setCaptions(capData.captions);
    } catch (err: any) {
      setError(err.message || "Failed to scrape product");
    } finally {
      setLoading((p) => ({ ...p, scrape: false, caption: false }));
    }
  };

  const handleEditCaption = (platform: string, caption: string) => {
    setCaptions((prev) =>
      prev.map((c) => (c.platform === platform ? { ...c, caption } : c))
    );
  };

  const handleTogglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePost = async () => {
    if (!product || selectedPlatforms.length === 0) return;
    setError("");
    setLoading((p) => ({ ...p, post: true }));
    try {
      const captionMap: Record<string, string> = {};
      captions.forEach((c) => {
        if (selectedPlatforms.includes(c.platform)) {
          captionMap[c.platform] = c.caption;
        }
      });

      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          platforms: selectedPlatforms,
          captions: captionMap,
        }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        fetchHistory();
        fetchStatus();
      }
      if (!data.success) throw new Error(data.error || "Post failed");
    } catch (err: any) {
      setError(err.message || "Failed to post");
    } finally {
      setLoading((p) => ({ ...p, post: false }));
    }
  };

  const readyCount = platforms.filter((p) => p.authenticated).length;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">
              LuxeMia Social
            </h1>
            <p className="text-sm text-gray-400">
              Social media automation for{" "}
              <a
                href="https://luxemia.shop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-400 hover:underline"
              >
                luxemia.shop
              </a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBar platforms={platforms} />
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                readyCount === 5
                  ? "bg-green-500/20 text-green-400"
                  : readyCount > 0
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {readyCount}/5 ready
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Step 1: Product Input */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center">
              1
            </span>
            Enter Product URL
          </h2>
          <ProductInput onScrape={handleScrape} loading={loading.scrape} />
        </section>

        {/* Step 2: Product Preview */}
        {product && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center">
                2
              </span>
              Product Preview
            </h2>
            <ProductCard product={product} />
          </section>
        )}

        {/* Step 3: Caption Review */}
        {captions.length > 0 && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center">
                3
              </span>
              Review Captions
              {loading.caption && (
                <Loader className="w-4 h-4 animate-spin text-rose-400" />
              )}
            </h2>
            <CaptionReview captions={captions} onEdit={handleEditCaption} />
          </section>
        )}

        {/* Step 4: Platform Selection */}
        {captions.length > 0 && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center">
                4
              </span>
              Select Platforms
            </h2>
            <PlatformSelector
              selected={selectedPlatforms}
              onToggle={handleTogglePlatform}
            />
          </section>
        )}

        {/* Step 5: Post */}
        {captions.length > 0 && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center">
                5
              </span>
              Publish
            </h2>
            <PostButton
              onPost={handlePost}
              loading={loading.post}
              disabled={selectedPlatforms.length === 0}
              selectedCount={selectedPlatforms.length}
            />
          </section>
        )}

        {/* Results */}
        {results && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Post Results</h2>
            <ResultsPanel results={results} />
          </section>
        )}

        {/* History */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Post History</h2>
          <PostHistory posts={posts} />
        </section>
      </div>
    </main>
  );
}

// Inline loader component for caption generation
function Loader({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
