import { Card } from "@/components/ui/card";
import { Activity, Clock, Wifi } from "lucide-react";
import { type ConnectionStats } from "@shared/schema";
import { QualityIndicator } from "./QualityIndicator";

interface ConnectionStatsProps {
  stats: ConnectionStats;
}

export function ConnectionStatsDisplay({ stats }: ConnectionStatsProps) {
  return (
    <Card className="p-4" data-testid="card-connection-stats">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">FPS</div>
            <div className="text-sm font-mono font-medium" data-testid="text-fps">
              {stats.fps}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Latency</div>
            <div className="text-sm font-mono font-medium" data-testid="text-latency">
              {stats.latency}ms
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Bandwidth</div>
            <div className="text-sm font-mono font-medium" data-testid="text-bandwidth">
              {(stats.bandwidth / 1024).toFixed(1)} KB/s
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" />
          <div>
            <div className="text-xs text-muted-foreground">Quality</div>
            <div className="mt-0.5">
              <QualityIndicator quality={stats.quality} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
