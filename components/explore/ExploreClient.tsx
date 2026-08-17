"use client";

import dynamic from "next/dynamic";

const ExploreApp = dynamic(() => import("./ExploreApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-[#0a0a0c]">
      <span className="label-caps animate-pulse">loading terrain…</span>
    </div>
  ),
});

export function ExploreClient() {
  return <ExploreApp />;
}
