"use client";

import { Component, type ReactNode } from "react";
import { Html } from "@react-three/drei";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Wraps <SkeletonModel/> inside the Canvas. If /models/skeleton.glb is
 * missing or fails to parse, this renders `fallback` instead of crashing
 * the page (Section 24). Class component because React error boundaries
 * still require the class API.
 */
export class AnatomyErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[AnatomyErrorBoundary] Falling back — skeleton.glb failed to load.", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function AnatomyUnavailableMessage() {
  return (
    <Html center>
      <div className="w-[260px] text-center font-body">
        <p className="text-[11px] uppercase tracking-label text-ink-muted">
          3D anatomy model unavailable
        </p>
        <p className="mt-2 text-xs text-ink-muted/80">
          Place a model at /public/models/skeleton.glb to activate the full experience.
        </p>
      </div>
    </Html>
  );
}
