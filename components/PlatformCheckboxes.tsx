"use client";

import { Check } from "lucide-react";
import { ConnectedAccount } from "@/lib/types";

interface PlatformCheckboxesProps {
  platforms: string[];
  selected: string[];
  onToggle: (platform: string) => void;
  accounts: ConnectedAccount[];
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

export default function PlatformCheckboxes({
  platforms,
  selected,
  onToggle,
  accounts,
}: PlatformCheckboxesProps) {
  const connectedPlatforms = accounts
    .filter((a) => a.connected)
    .map((a) => a.platform);

  const availablePlatforms = platforms.filter((p) =>
    connectedPlatforms.includes(p)
  );

  if (availablePlatforms.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">
          No connected platforms. Connect at least one platform above to start posting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Select Platforms to Post
      </h3>
      <div className="flex flex-wrap gap-3">
        {availablePlatforms.map((platform) => {
          const isSelected = selected.includes(platform);
          return (
            <button
              key={platform}
              onClick={() => onToggle(platform)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                isSelected
                  ? "border-rose-500 bg-rose-500/10 text-rose-500"
                  : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? "border-rose-500 bg-rose-500"
                    : "border-gray-700"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="capitalize">
                {platformLabels[platform] || platform}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
