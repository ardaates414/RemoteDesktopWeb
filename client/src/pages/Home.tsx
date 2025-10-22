import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Monitor, Eye, Zap, Lock, Globe } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold mb-3" data-testid="text-title">
              Remote Desktop
            </h1>
            <p className="text-muted-foreground text-lg">
              Secure screen sharing and remote control powered by WebRTC
            </p>
          </div>

          {/* Main Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Host Card */}
            <Card className="p-8 hover-elevate" data-testid="card-host-option">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Share Screen</h2>
                  <p className="text-muted-foreground">
                    Start hosting and share your screen with others
                  </p>
                </div>
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => setLocation("/host")}
                  data-testid="button-start-host"
                >
                  Start Hosting
                </Button>
              </div>
            </Card>

            {/* Viewer Card */}
            <Card className="p-8 hover-elevate" data-testid="card-viewer-option">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">View Screen</h2>
                  <p className="text-muted-foreground">
                    Connect to a remote desktop session
                  </p>
                </div>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation("/viewer")}
                  data-testid="button-start-viewer"
                >
                  Join Session
                </Button>
              </div>
            </Card>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="font-semibold">Ultra-Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time streaming with WebRTC for minimal latency
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="font-semibold">Secure</h3>
                <p className="text-sm text-muted-foreground">
                  End-to-end encrypted connections for privacy
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="font-semibold">Browser-Based</h3>
                <p className="text-sm text-muted-foreground">
                  No downloads required, works in any modern browser
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
