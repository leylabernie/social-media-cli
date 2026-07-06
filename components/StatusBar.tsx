"use client";

import type { PlatformStatus } from "@/lib/types";
import { CheckCircle2, XCircle } from "lucide-react";

interface StatusBarProps {
  platforms: PlatformStatus[];
}

const platformLabels: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
};

export default function StatusBar({ platforms }: StatusBarProps) {
  const readyCount = platforms.filter((p) => p.authenticated).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">
        {readyCount}/{platforms.length} ready
      </span>
      {platforms.map((platform) => (
        <span
          key={platform.platform}
          className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium border border-gray-700"
        >
          {platform.authenticated ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          <span className={platform.authenticated ? "text-gray-200" : "text-gray-500"}>
            {platformLabels[platform.platform] || platform.platform}
          </span>
        </span>
      ))}
    </div>
  );
}
