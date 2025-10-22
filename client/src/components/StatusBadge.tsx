import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";
import { type ConnectionStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: ConnectionStatus;
  showDot?: boolean;
}

export function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const config = {
    connecting: {
      label: "Connecting",
      className: "bg-chart-3/20 text-chart-3 border-chart-3/30",
    },
    connected: {
      label: "Connected",
      className: "bg-chart-2/20 text-chart-2 border-chart-2/30",
    },
    disconnected: {
      label: "Disconnected",
      className: "bg-muted text-muted-foreground border-border",
    },
    error: {
      label: "Error",
      className: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={className} data-testid={`badge-status-${status}`}>
      {showDot && (
        <Circle 
          className={`w-2 h-2 mr-1.5 ${status === 'connected' ? 'animate-pulse' : ''}`} 
          fill="currentColor" 
        />
      )}
      {label}
    </Badge>
  );
}
