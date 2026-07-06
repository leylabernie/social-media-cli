"use client";

import { Check } from "lucide-react";

interface PlatformSelectorProps {
  selected: string[];
  onToggle: (platform: string) => void;
}

const platforms = [
  { id: "x", label: "X", color: "hover:border-gray-500" },
  { id: "instagram", label: "Instagram", color: "hover:border-pink-500" },
  { id: "facebook", label: "Facebook", color: "hover:border-blue-500" },
  { id: "pinterest", label: "Pinterest", color: "hover:border-red-500" },
  { id: "linkedin", label: "LinkedIn", color: "hover:border-blue-600" },
];

export default function PlatformSelector({ selected, onToggle }: PlatformSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-200">Select Platforms</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => onToggle(platform.id)}
              className={`relative flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all ${
                isSelected
                  ? "border-rose-500 bg-rose-500/10 text-rose-400"
                  : `border-gray-700 bg-gray-900 text-gray-400 ${platform.color}`
              }`}
            >
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
              <span className="capitalize">{platform.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
