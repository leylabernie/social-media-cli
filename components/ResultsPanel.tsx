"use client";

import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { PostResult } from "@/lib/types";

interface ResultsPanelProps {
  results: PostResult[];
}

export default function ResultsPanel({ results }: ResultsPanelProps) {
  if (!results || results.length === 0) return null;

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Post Results
        </h3>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            successCount === totalCount
              ? "bg-green-500/10 text-green-500"
              : successCount > 0
              ? "bg-yellow-500/10 text-yellow-500"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {successCount}/{totalCount} posted
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.map((result) => (
          <div
            key={result.platform}
            className={`border rounded-xl p-4 transition-all ${
              result.success
                ? "bg-green-500/5 border-green-500/20"
                : "bg-red-500/5 border-red-500/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="font-medium text-white capitalize text-sm">
                {result.platform}
              </span>
              {result.success ? (
                <span className="text-xs text-green-500 font-medium ml-auto">
                  Success
                </span>
              ) : (
                <span className="text-xs text-red-500 font-medium ml-auto">
                  Failed
                </span>
              )}
            </div>

            {result.success && result.postUrl && (
              <a
                href={result.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                View Post <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {!result.success && result.error && (
              <p className="text-xs text-red-400">{result.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
