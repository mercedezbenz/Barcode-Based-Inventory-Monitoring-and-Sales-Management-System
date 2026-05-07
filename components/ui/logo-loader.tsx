"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LogoLoaderProps {
  /**
   * The message displayed below the logo.
   * @default "Loading your workspace..."
   */
  message?: string;
  /**
   * Automatically forces the loader to fill the entire viewport with a backdrop blur overlay.
   * @default true
   */
  fullScreen?: boolean;
  /**
   * Additional class names for the container wrapper.
   */
  className?: string;
  /**
   * If true, suppresses the initial mount delay, rendering immediately.
   */
  immediate?: boolean;
}

export function LogoLoader({
  message = "Loading your workspace...",
  fullScreen = true,
  className,
  immediate = false,
}: LogoLoaderProps) {
  const [show, setShow] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    // Small delay before rendering to avoid UI flicker on very fast loading times
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, [immediate]);

  if (!show) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center z-[100] transition-all animate-in fade-in duration-700 ease-in-out",
        fullScreen
          ? "fixed inset-0 w-screen h-screen bg-slate-50/90 dark:bg-black/80 backdrop-blur-md"
          : "w-full h-full min-h-[400px]",
        className
      )}
    >
      <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
        {/* Subtle Glass/Glow Element Behind Logo */}
        <div className="absolute w-32 h-32 md:w-40 md:h-40 bg-sky-500/20 dark:bg-sky-400/10 blur-[40px] rounded-full animate-pulse top-[-20%] md:top-[-30%]" />

        {/* Rotating & Scaling Logo Wrapper */}
        <div
          className="relative flex items-center justify-center"
          style={{
            // Custom graceful 1.5s infinite rotation mapping to the prompt
            animation: "spin 1.5s linear infinite",
          }}
        >
          {/* Subtle heartbeat scale effect compounding with rotation */}
          <div
            className="relative w-16 h-16 md:w-20 md:h-20 drop-shadow-2xl"
            style={{
              animation: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          >
            <Image
              src="/logo.png" // Centralized logo asset mapping
              alt="Loading..."
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>

        {/* Text Presentation & Loading Indicator */}
        <div className="mt-8 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-700 delay-150">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 font-sans tracking-[0.15em] uppercase text-center max-w-[280px]">
            {message}
          </p>
          
          {/* Micro Animation Dots Indicator */}
          <div className="flex gap-1.5 items-center justify-center">
            <span className="w-1.5 h-1.5 bg-sky-500/60 dark:bg-sky-400/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-sky-500/80 dark:bg-sky-400/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-sky-500 dark:bg-sky-400 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
