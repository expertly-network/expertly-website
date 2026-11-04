'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { linkedinUrlGuide, MOBILE_GUIDE_QUERY, type GuideDevice } from '@/lib/guides';

const OTHER: Record<GuideDevice, GuideDevice> = { desktop: 'mobile', mobile: 'desktop' };
const SWITCH_LABEL: Record<GuideDevice, string> = {
  desktop: 'Computer version',
  mobile: 'Phone version',
};

// Shown if the video can't load, so the applicant still has the steps.
const TEXT_STEPS: Record<GuideDevice, string[]> = {
  desktop: [
    'On linkedin.com, click Me → View Profile.',
    'Copy the link from the address bar (linkedin.com/in/…).',
    'Paste it into the field below.',
  ],
  mobile: [
    'In the LinkedIn app, tap your photo → View profile.',
    'Tap ⋯ → Share via… → Copy.',
    'Paste it into the field below.',
  ],
};

// iOS Safari only fullscreens the <video> itself, through this non-standard method.
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function PlayIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 12 14" fill="currentColor">
      <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5Z" />
    </svg>
  );
}

// The guides are silent, captioned walkthroughs, so the player is deliberately minimal: it loops on
// its own, tap pauses/resumes, plus a seek bar and fullscreen — no volume control for a silent track.
function GuidePlayer({
  device,
  autoPlay,
  onFailed,
  corner,
}: {
  device: GuideDevice;
  autoPlay: boolean;
  onFailed: () => void;
  // Rendered over the top-right corner, above the tap-to-pause layer.
  corner?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<WebkitVideo>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { videoSrc, posterSrc } = linkedinUrlGuide(device);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }

  function seek(ratio: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = ratio * video.duration;
    setProgress(ratio);
  }

  function fullscreen() {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (frame?.requestFullscreen) void frame.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    else video?.webkitEnterFullscreen?.();
  }

  return (
    <div ref={frameRef} className="group relative aspect-video w-full overflow-hidden bg-bg-alt">
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        className="h-full w-full"
        autoPlay={autoPlay}
        loop
        muted
        playsInline
        preload={autoPlay ? 'auto' : 'metadata'}
        onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          if (duration) setProgress(currentTime / duration);
        }}
        onError={onFailed}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause guide' : 'Play guide'}
        className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
      >
        {!ready ? (
          <span
            aria-hidden="true"
            className="h-7 w-7 animate-spin rounded-full border-2 border-line-2 border-t-accent"
          />
        ) : (
          !playing && (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent pl-0.5 text-bg shadow-lg transition-transform group-hover:scale-105"
            >
              <PlayIcon />
            </span>
          )
        )}
      </button>

      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-ink/25 to-transparent px-3 pb-1.5 pt-5 transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : 'opacity-100'}`}
      >
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Seek"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-accent"
        />
        <button
          type="button"
          onClick={fullscreen}
          aria-label="Full screen"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-bg hover:bg-bg/15"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>

      {corner && <div className="absolute right-2 top-2">{corner}</div>}
    </div>
  );
}

// Always-visible how-to above the LinkedIn URL field. Phones/tablets get the LinkedIn-app walkthrough,
// everything else the browser one — decided before any video loads, so a phone never fetches the
// desktop file first. It loops muted on its own unless the visitor prefers reduced motion.
export function LinkedInUrlGuide() {
  // null until the browser has told us which device this is (unknown during server render).
  const [device, setDevice] = useState<GuideDevice | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDevice(window.matchMedia(MOBILE_GUIDE_QUERY).matches ? 'mobile' : 'desktop');
    setAutoPlay(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const switchChip = device && (
    <button
      type="button"
      onClick={() => {
        setDevice(OTHER[device]);
        setFailed(false);
      }}
      className="rounded-full border border-line bg-bg-card/90 px-2.5 py-1 text-xs font-medium text-ink-2 shadow-sm backdrop-blur transition-colors hover:border-accent hover:text-ink"
    >
      {SWITCH_LABEL[OTHER[device]]}
    </button>
  );

  // Below md there's no room beside the video, so it plays on its own (steps only if it fails).
  const steps = device && (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-2 marker:font-semibold marker:text-accent">
      {TEXT_STEPS[device].map((step) => (
        <li key={step} className="pl-1">
          {step}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-7">
      {!failed && (
        <div className="w-full overflow-hidden rounded-input border border-line bg-bg-card md:w-[60%] md:max-w-[520px] md:shrink-0">
          {device ? (
            <GuidePlayer
              key={device}
              device={device}
              autoPlay={autoPlay}
              onFailed={() => setFailed(true)}
              corner={switchChip}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-bg-alt">
              <span
                aria-hidden="true"
                className="h-7 w-7 animate-spin rounded-full border-2 border-line-2 border-t-accent"
              />
            </div>
          )}
        </div>
      )}
      {device && (
        <div className={`min-w-0 flex-1 flex-col items-start gap-3 ${failed ? 'flex' : 'hidden md:flex'}`}>
          {steps}
          {failed && switchChip}
        </div>
      )}
    </div>
  );
}
