"use client";

import { Loader2, Send } from "lucide-react";

interface PostButtonProps {
  onPost: () => void;
  loading: boolean;
  disabled: boolean;
  count: number;
}

export default function PostButton({
  onPost,
  loading,
  disabled,
  count,
}: PostButtonProps) {
  return (
    <button
      onClick={onPost}
      disabled={disabled || loading || count === 0}
      className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-4 px-8 rounded-xl text-base transition-all flex items-center justify-center gap-3"
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Posting to {count} platform{count !== 1 ? "s" : ""}...
        </>
      ) : (
        <>
          <Send className="w-5 h-5" />
          Post to {count} Platform{count !== 1 ? "s" : ""}
        </>
      )}
    </button>
  );
}
