import React from "react";

type GradientBarsBackgroundProps = {
  /** Number of bars across the screen */
  bars?: number;
  /** Base/background color behind the bars */
  baseClassName?: string;
  /** Bar gradient CSS (defaults to orange -> transparent) */
  gradient?: string;
  /** Extra className for the wrapper */
  className?: string;
};

export function GradientBarsBackground({
  bars = 15,
  baseClassName = "bg-gray-950",
  gradient = "linear-gradient(to top, rgb(255, 60, 0), transparent)",
  className = "",
}: GradientBarsBackgroundProps) {
  const calculateHeight = (index: number, total: number) => {
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;

    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);

    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* base background */}
      <div className={`absolute inset-0 ${baseClassName}`} />

      {/* bars */}
      <div
        className="absolute inset-0"
        style={{
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div className="flex h-full w-full">
          {Array.from({ length: bars }).map((_, index) => {
            const height = calculateHeight(index, bars);
            const barStyle: React.CSSProperties & { ["--bar-scale"]: number } = {
              flex: `1 0 calc(100% / ${bars})`,
              maxWidth: `calc(100% / ${bars})`,
              height: "100%",
              background: gradient,
              transformOrigin: "bottom",
              transition: "transform 0.5s ease-in-out",
              animation: "pulseBar 2s ease-in-out infinite alternate",
              animationDelay: `${index * 0.1}s`,
              outline: "1px solid rgba(0, 0, 0, 0)",
              boxSizing: "border-box",
              ["--bar-scale"]: height / 100,
            };

            return (
              <div
                key={index}
                style={barStyle}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
