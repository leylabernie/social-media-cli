"use client";

import { Loader2, Send } from "lucide-react";

interface PostButtonProps {
  onPost: () => void;
  loading: boolean;
  disabled: boolean;
  selectedCount: number;
}

export default function PostButton({
  onPost,
  loading,
  disabled,
  selectedCount,
}: PostButtonProps) {
  return (
    <button
      onClick={onPost}
      disabled={disabled || loading}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-8 py-4 text-base font-bold text-white hover:bg-rose-600 active:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-rose-500/20"
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Posting to {selectedCount} platform{selectedCount !== 1 ? "s" : ""}...
        </>
      ) : (
        <>
          <Send className="h-5 w-5" />
          {selectedCount > 0
            ? `Post to ${selectedCount} Platform${selectedCount !== 1 ? "s" : ""}`
            : "Select Platforms to Post"}
        </>
      )}
    </button>
  );
}
