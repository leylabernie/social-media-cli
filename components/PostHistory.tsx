"use client";

import { useState } from "react";
import type { PostRecord } from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface PostHistoryProps {
  posts: PostRecord[];
}

const platformLabels: Record<string, string> = {
  x: "X",
  instagram: "IG",
  facebook: "FB",
  pinterest: "PIN",
  linkedin: "IN",
};

function getStatusBadge(post: PostRecord) {
  const total = post.results.length;
  const success = post.results.filter((r) => r.success).length;

  if (success === total && total > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Posted
      </span>
    );
  } else if (success > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
        <AlertCircle className="h-3 w-3" />
        Partial
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
}

export default function PostHistory({ posts }: PostHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 flex flex-col items-center justify-center text-center gap-3">
        <Clock className="h-6 w-6 text-gray-600" />
        <p className="text-sm text-gray-500">No posts yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-base font-semibold text-gray-200">Post History</h2>
        <p className="text-xs text-gray-500 mt-1">
          Showing last {posts.length} posts
        </p>
      </div>
      <div className="divide-y divide-gray-800">
        {posts.map((post) => {
          const isExpanded = expandedId === post.id;
          return (
            <div key={post.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {post.product}
                    </p>
                    {getStatusBadge(post)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(post.date).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <div className="flex -space-x-1">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[9px] font-bold text-gray-300 border border-gray-900"
                      >
                        {(platformLabels[p] || p).charAt(0)}
                      </span>
                    ))}
                    {post.platforms.length > 3 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[9px] font-bold text-gray-400 border border-gray-900">
                        +{post.platforms.length - 3}
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <a
                      href={post.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Product Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="space-y-1.5">
                    {post.results.map((result) => (
                      <div
                        key={result.platform}
                        className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2"
                      >
                        <span className="text-xs font-medium text-gray-300 capitalize">
                          {platformLabels[result.platform] || result.platform}
                        </span>
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              {result.url && (
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-rose-400 hover:text-rose-300"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                              <span className="text-xs text-red-400">
                                {result.error || "Failed"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
