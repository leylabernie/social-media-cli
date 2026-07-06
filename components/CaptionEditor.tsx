"use client";

interface CaptionItem {
  platform: string;
  caption: string;
}

interface CaptionEditorProps {
  captions: CaptionItem[];
  onEdit: (platform: string, caption: string) => void;
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500",
  facebook: "bg-blue-500/10 text-blue-500",
  tiktok: "bg-cyan-500/10 text-cyan-500",
  pinterest: "bg-red-500/10 text-red-500",
};

export default function CaptionEditor({ captions, onEdit }: CaptionEditorProps) {
  if (captions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Review & Edit Captions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {captions.map((item) => (
          <div key={item.platform} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full mb-3 inline-block capitalize ${
                platformColors[item.platform] || "bg-gray-800 text-gray-400"
              }`}
            >
              {item.platform}
            </span>
            <textarea
              value={item.caption}
              onChange={(e) => onEdit(item.platform, e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none min-h-[120px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
