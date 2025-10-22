import { Signal, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { type ConnectionQuality } from "@shared/schema";

interface QualityIndicatorProps {
  quality: ConnectionQuality;
  showLabel?: boolean;
}

export function QualityIndicator({ quality, showLabel = false }: QualityIndicatorProps) {
  const config = {
    excellent: {
      icon: SignalHigh,
      label: "Excellent",
      className: "text-chart-2",
    },
    good: {
      icon: Signal,
      label: "Good",
      className: "text-chart-2",
    },
    fair: {
      icon: SignalMedium,
      label: "Fair",
      className: "text-chart-3",
    },
    poor: {
      icon: SignalLow,
      label: "Poor",
      className: "text-chart-4",
    },
  };

  const { icon: Icon, label, className } = config[quality];

  return (
    <div className="flex items-center gap-1.5" data-testid={`indicator-quality-${quality}`}>
      <Icon className={`w-4 h-4 ${className}`} />
      {showLabel && (
        <span className={`text-sm font-medium ${className}`}>{label}</span>
      )}
    </div>
  );
}
