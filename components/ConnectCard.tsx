"use client";

import { Instagram, Facebook, Video, Pin } from "lucide-react";

interface ConnectCardProps {
  platform: string;
  displayName: string;
  icon: string;
  connected: boolean;
  connectedAt?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-6 h-6" />,
  facebook: <Facebook className="w-6 h-6" />,
  tiktok: <Video className="w-6 h-6" />,
  pinterest: <Pin className="w-6 h-6" />,
};

export default function ConnectCard({
  platform,
  displayName,
  icon,
  connected,
  connectedAt,
  onConnect,
  onDisconnect,
}: ConnectCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4 transition-all hover:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-rose-500">
            {iconMap[icon] || <Instagram className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{displayName}</h3>
            <p className="text-xs text-gray-500 capitalize">{platform}</p>
          </div>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            connected
              ? "bg-green-500/10 text-green-500"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {connected ? "Connected" : "Not Connected"}
        </span>
      </div>

      {connected && connectedAt && (
        <p className="text-xs text-gray-600">
          Connected on{" "}
          {new Date(connectedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      <button
        onClick={connected ? onDisconnect : onConnect}
        className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${
          connected
            ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            : "bg-rose-500 text-white hover:bg-rose-600"
        }`}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}
