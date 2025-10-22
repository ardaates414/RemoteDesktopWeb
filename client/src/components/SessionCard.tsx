import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SessionCardProps {
  sessionId: string;
  viewerCount: number;
  onEndSession?: () => void;
}

export function SessionCard({ sessionId, viewerCount, onEndSession }: SessionCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      toast({
        title: "Session ID copied",
        description: "Share this ID with viewers to connect",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the session ID manually",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6" data-testid="card-session">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Session ID</h3>
          <div className="flex items-center gap-2">
            <code 
              className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm" 
              data-testid="text-session-id"
            >
              {sessionId}
            </code>
            <Button
              size="icon"
              variant="outline"
              onClick={copySessionId}
              data-testid="button-copy-session-id"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-chart-2" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-sm text-muted-foreground">Active Viewers</div>
            <div className="text-2xl font-semibold" data-testid="text-viewer-count">
              {viewerCount}
            </div>
          </div>
          
          {onEndSession && (
            <Button 
              variant="destructive" 
              onClick={onEndSession}
              data-testid="button-end-session"
            >
              End Session
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
