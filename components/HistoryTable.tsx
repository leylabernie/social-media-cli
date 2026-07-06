"use client";

import { PostRecord } from "@/lib/types";

interface HistoryTableProps {
  posts: PostRecord[];
}

function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    posted: "bg-green-500/10 text-green-500",
    partial: "bg-yellow-500/10 text-yellow-500",
    failed: "bg-red-500/10 text-red-500",
    pending: "bg-blue-500/10 text-blue-500",
  };

  return (
    <span
      className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
        statusStyles[status.toLowerCase()] || "bg-gray-800 text-gray-400"
      }`}
    >
      {status}
    </span>
  );
}

export default function HistoryTable({ posts }: HistoryTableProps) {
  if (!posts || posts.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No posts yet. Start by scraping a product!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3.5 text-gray-400 font-medium">
                Date
              </th>
              <th className="text-left px-5 py-3.5 text-gray-400 font-medium">
                Product
              </th>
              <th className="text-left px-5 py-3.5 text-gray-400 font-medium">
                Platforms
              </th>
              <th className="text-left px-5 py-3.5 text-gray-400 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-4">
                  <a
                    href={post.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-rose-500 transition-colors font-medium"
                  >
                    {post.productTitle}
                  </a>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {post.results.map((r) => (
                      <span
                        key={r.platform}
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          r.success
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {r.platform}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={post.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
