"use client";

import type { CaptionResult } from "@/lib/types";
import { FileText } from "lucide-react";

interface CaptionReviewProps {
  captions: CaptionResult[];
  onEdit: (platform: string, caption: string) => void;
}

const platformStyles: Record<string, { label: string; color: string }> = {
  x: { label: "X", color: "bg-gray-700 text-white" },
  instagram: { label: "IG", color: "bg-pink-600 text-white" },
  facebook: { label: "FB", color: "bg-blue-600 text-white" },
  pinterest: { label: "PIN", color: "bg-red-600 text-white" },
  linkedin: { label: "IN", color: "bg-blue-700 text-white" },
};

export default function CaptionReview({ captions, onEdit }: CaptionReviewProps) {
  if (captions.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center">
          <FileText className="h-6 w-6 text-gray-600" />
        </div>
        <p className="text-sm text-gray-500">
          Scrape a product to generate AI captions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-200">AI-Generated Captions</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {captions.map((cap) => {
          const style = platformStyles[cap.platform] || {
            label: cap.platform.toUpperCase(),
            color: "bg-gray-700 text-white",
          };
          return (
            <div
              key={cap.platform}
              className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <span
                  className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${style.color}`}
                >
                  {style.label}
                </span>
                <span className="text-sm font-medium text-gray-300 capitalize">
                  {cap.platform}
                </span>
              </div>
              <div className="p-4">
                <textarea
                  value={cap.caption}
                  onChange={(e) => onEdit(cap.platform, e.target.value)}
                  rows={4}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none transition-all"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
