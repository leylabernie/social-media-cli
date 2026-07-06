"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Instagram,
  Facebook,
  Video,
  Pin,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";
import ConnectCard from "@/components/ConnectCard";
import ProductInput from "@/components/ProductInput";
import ProductPreview from "@/components/ProductPreview";
import CaptionEditor from "@/components/CaptionEditor";
import PlatformCheckboxes from "@/components/PlatformCheckboxes";
import PostButton from "@/components/PostButton";
import ResultsPanel from "@/components/ResultsPanel";
import HistoryTable from "@/components/HistoryTable";
import {
  ConnectedAccount,
  ProductInfo,
  PostResult,
  PostRecord,
} from "@/lib/types";

const PLATFORM_LIST = ["instagram", "facebook", "tiktok", "pinterest"];

const DEFAULT_ACCOUNTS: ConnectedAccount[] = [
  { platform: "instagram", displayName: "Instagram", icon: "instagram", connected: false },
  { platform: "facebook", displayName: "Facebook", icon: "facebook", connected: false },
  { platform: "tiktok", displayName: "TikTok", icon: "tiktok", connected: false },
  { platform: "pinterest", displayName: "Pinterest", icon: "pinterest", connected: false },
];

export default function DashboardPage() {
  // ── State ────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(DEFAULT_ACCOUNTS);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [captions, setCaptions] = useState<Array<{ platform: string; caption: string }>>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState({
    scrape: false,
    caption: false,
    post: false,
    fetch: true,
  });
  const [error, setError] = useState<string>("");

  // ── Fetch accounts & history on mount ────────────────────
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      if (data.accounts && data.accounts.length > 0) {
        // Merge with defaults to ensure all 4 platforms show
        const merged = DEFAULT_ACCOUNTS.map((def) => {
          const found = data.accounts.find(
            (a: ConnectedAccount) => a.platform === def.platform
          );
          return found || def;
        });
        setAccounts(merged);
      }
    } catch {
      // Silent fail — keep default disconnected state
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAccounts(), fetchHistory()]).finally(() => {
      setLoading((prev) => ({ ...prev, fetch: false }));
    });
  }, [fetchAccounts, fetchHistory]);

  // ── Actions ──────────────────────────────────────────────
  const handleConnect = (platform: string) => {
    window.location.href = `/api/auth/${platform}`;
  };

  const handleDisconnect = async (platform: string) => {
    try {
      const res = await fetch("/api/auth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) throw new Error("Disconnect failed");
      setAccounts((prev) =>
        prev.map((a) =>
          a.platform === platform ? { ...a, connected: false, connectedAt: undefined } : a
        )
      );
      setSelectedPlatforms((prev) => prev.filter((p) => p !== platform));
    } catch {
      setError(`Failed to disconnect ${platform}. Please try again.`);
      setTimeout(() => setError(""), 4000);
    }
  };

  const handleScrape = async (url: string) => {
    setError("");
    setLoading((prev) => ({ ...prev, scrape: true }));
    setResults(null);
    setCaptions([]);
    setSelectedPlatforms([]);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to scrape product");
      }
      const data = await res.json();
      setProduct(data.product);

      // Auto-generate captions after successful scrape
      await handleGenerateCaptions(data.product);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to scrape product";
      setError(message);
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading((prev) => ({ ...prev, scrape: false }));
    }
  };

  const handleGenerateCaptions = async (prod: ProductInfo) => {
    setLoading((prev) => ({ ...prev, caption: true }));
    try {
      const connected = accounts.filter((a) => a.connected).map((a) => a.platform);
      if (connected.length === 0) {
        setCaptions([]);
        return;
      }
      const res = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: prod, platforms: connected }),
      });
      if (!res.ok) throw new Error("Failed to generate captions");
      const data = await res.json();
      setCaptions(data.captions || []);
      // Auto-select all connected platforms
      setSelectedPlatforms(connected);
    } catch {
      // Non-fatal: user can still post without captions
      setCaptions([]);
    } finally {
      setLoading((prev) => ({ ...prev, caption: false }));
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
    setLoading((prev) => ({ ...prev, post: true }));
    setResults(null);

    try {
      // Build captions map for selected platforms
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to post");
      }
      const data = await res.json();
      setResults(data.results || []);
      // Refresh history
      await fetchHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to post to platforms";
      setError(message);
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading((prev) => ({ ...prev, post: false }));
    }
  };

  const connectedCount = accounts.filter((a) => a.connected).length;

  // ── Render ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">LuxeMia Social</h1>
              <p className="text-sm text-gray-500">
                Social media automation for{" "}
                <span className="text-rose-500">luxemia.shop</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-full px-4 py-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectedCount > 0 ? "bg-green-500" : "bg-gray-600"
              }`}
            />
            <span className="text-sm text-gray-400">
              {connectedCount} account{connectedCount !== 1 ? "s" : ""} connected
            </span>
          </div>
        </header>

        {/* ── Error Alert ────────────────────────────────── */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-10">
          {/* ── Section 1: Platform Connect Grid ─────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              Connect Your Accounts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {accounts.map((account) => (
                <ConnectCard
                  key={account.platform}
                  platform={account.platform}
                  displayName={account.displayName}
                  icon={account.icon || account.platform}
                  connected={account.connected}
                  connectedAt={account.connectedAt}
                  onConnect={() => handleConnect(account.platform)}
                  onDisconnect={() => handleDisconnect(account.platform)}
                />
              ))}
            </div>
          </section>

          {/* ── Section 2: Product URL Input ─────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              Scrape Product
            </h2>
            <ProductInput onScrape={handleScrape} loading={loading.scrape} />
          </section>

          {/* ── Loading: Caption Generation ──────────────── */}
          {loading.caption && (
            <div className="flex items-center justify-center gap-3 py-8 bg-gray-900/50 border border-gray-800 rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
              <p className="text-sm text-gray-400">Generating captions...</p>
            </div>
          )}

          {/* ── Section 3: Product Preview ───────────────── */}
          {product && !loading.caption && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                Product Preview
              </h2>
              <ProductPreview product={product} />
            </section>
          )}

          {/* ── Section 4: Caption Review ────────────────── */}
          {captions.length > 0 && !loading.caption && (
            <section>
              <CaptionEditor captions={captions} onEdit={handleEditCaption} />
            </section>
          )}

          {/* ── Section 5: Platform Selection ────────────── */}
          {product && captions.length > 0 && !loading.caption && (
            <section>
              <PlatformCheckboxes
                platforms={PLATFORM_LIST}
                selected={selectedPlatforms}
                onToggle={handleTogglePlatform}
                accounts={accounts}
              />
            </section>
          )}

          {/* ── Section 6: Post Button ───────────────────── */}
          {product && captions.length > 0 && !loading.caption && (
            <section>
              <PostButton
                onPost={handlePost}
                loading={loading.post}
                disabled={selectedPlatforms.length === 0}
                count={selectedPlatforms.length}
              />
            </section>
          )}

          {/* ── Section 7: Results ───────────────────────── */}
          {results && <ResultsPanel results={results} />}

          {/* ── Section 8: History ───────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Post History</h2>
            {loading.fetch ? (
              <div className="flex items-center justify-center py-12 bg-gray-900/50 border border-gray-800 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-rose-500 mr-2" />
                <p className="text-sm text-gray-500">Loading history...</p>
              </div>
            ) : (
              <HistoryTable posts={posts} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
