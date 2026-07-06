"use client";

import type { PostResult } from "@/lib/types";
import { CheckCircle2, XCircle, ExternalLink, ArrowRight } from "lucide-react";

interface ResultsPanelProps {
  results: PostResult[];
}

const platformLabels: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
};

export default function ResultsPanel({ results }: ResultsPanelProps) {
  if (results.length === 0) return null;

  const successCount = results.filter((r) => r.success).length;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-200">Post Results</h2>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            successCount === results.length
              ? "bg-green-500/10 text-green-400"
              : successCount > 0
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {successCount}/{results.length} posted
        </span>
      </div>
      <div className="divide-y divide-gray-800">
        {results.map((result) => (
          <div
            key={result.platform}
            className="flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-200 capitalize">
                  {platformLabels[result.platform] || result.platform}
                </p>
                {!result.success && result.error && (
                  <p className="text-xs text-red-400 mt-0.5">{result.error}</p>
                )}
              </div>
            </div>
            {result.success && result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                View Post
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
