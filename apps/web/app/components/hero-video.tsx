'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

/**
 * Autoplay muted looping video with a minimal play/pause overlay. No
 * controls, no timeline, no volume. The button surfaces on hover while
 * playing and stays put while paused so the state is legible. Intersection
 * observer pauses playback when the video scrolls off screen to avoid
 * chewing battery on long pages.
 */
export function HeroVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.25 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  const showButton = !playing || hovered;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
        className="block w-full h-auto cursor-pointer"
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause video' : 'Play video'}
        className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          inline-flex items-center justify-center
          h-16 w-16 rounded-full
          bg-black/60 backdrop-blur-md
          border border-white/20
          text-white
          transition-all duration-200
          ${showButton ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}
          hover:bg-black/80 hover:scale-105
        `}
      >
        {playing ? (
          <Pause className="h-6 w-6" strokeWidth={2} fill="currentColor" />
        ) : (
          <Play className="h-6 w-6 ml-0.5" strokeWidth={2} fill="currentColor" />
        )}
      </button>
    </div>
  );
}
