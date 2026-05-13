"use client";

import { useEffect, useState } from "react";

export type BreakpointState = {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  isLandscape: boolean;
};

function compute(width: number, height: number): BreakpointState {
  const isMobile = width <= 640;
  const isTablet = width >= 641 && width <= 1024;
  const isDesktop = width >= 1025;
  const isWide = width >= 1440;
  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isLandscape: width > height,
  };
}

export function useBreakpoint(): BreakpointState {
  const [state, setState] = useState<BreakpointState>(() => compute(0, 0));

  useEffect(() => {
    const update = () => {
      setState(compute(window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
