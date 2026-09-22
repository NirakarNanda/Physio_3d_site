"use client";

import { Html, useProgress } from "@react-three/drei";

export function AnatomyLoader() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex w-[220px] flex-col items-center gap-3 font-body">
        <span className="text-[11px] uppercase tracking-label text-[#B4B0A6]">
          Loading Anatomy
        </span>
        <div className="h-px w-full bg-white/15">
          <div
            className="h-px bg-accent transition-[width] duration-200 ease-editorial"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
      </div>
    </Html>
  );
}
