import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Maximize, Minimize, Mouse, Keyboard, MonitorOff } from "lucide-react";
import { useLocation } from "wouter";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectionStatsDisplay } from "@/components/ConnectionStats";
import { type ConnectionStatus, type ConnectionStats, type WSMessage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/lib/useWebSocket";
import { WebRTCConnection } from "@/lib/webrtc";

export default function Viewer() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState("");
  const [inputSessionId, setInputSessionId] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseEnabled, setMouseEnabled] = useState(false);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [stats, setStats] = useState<ConnectionStats>({
    fps: 0,
    latency: 0,
    bandwidth: 0,
    quality: "excellent",
  });

  // Update connection stats periodically
  useEffect(() => {
    if (!peerConnectionRef.current || status !== "connected") return;

    const interval = setInterval(async () => {
      if (!peerConnectionRef.current) return;

      try {
        const statsReport = await peerConnectionRef.current.getStats();
        let bytesReceived = 0;
        let packetsLost = 0;
        let jitter = 0;
        let frameRate = 0;

        statsReport.forEach((report: any) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            bytesReceived = report.bytesReceived || 0;
            packetsLost = report.packetsLost || 0;
            jitter = report.jitter || 0;
            frameRate = report.framesPerSecond || 0;
          }
        });

        const bandwidth = Math.floor(bytesReceived / 10); // Approximate KB/s
        const latency = Math.floor(jitter * 1000); // Convert to ms
        let quality: ConnectionStats["quality"] = "excellent";
        
        if (packetsLost > 50 || latency > 200) quality = "poor";
        else if (packetsLost > 20 || latency > 100) quality = "fair";
        else if (packetsLost > 5 || latency > 50) quality = "good";

        setStats({
          fps: Math.floor(frameRate),
          latency,
          bandwidth,
          quality,
        });
      } catch (error) {
        console.error("Failed to get stats:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<WebRTCConnection | null>(null);
  const { toast } = useToast();

  const handleWebSocketMessage = async (message: WSMessage) => {
    switch (message.type) {
      case "session-joined":
        if (message.success && message.viewerId) {
          setViewerId(message.viewerId);
          setStatus("connected");
          toast({
            title: "Connected",
            description: "Successfully connected to remote desktop",
          });
        } else {
          setStatus("error");
          toast({
            title: "Connection failed",
            description: message.error || "Unknown error",
            variant: "destructive",
          });
          setSessionId("");
        }
        break;

      case "offer":
        if (message.viewerId === viewerId) {
          await handleOffer(message.sdp);
        }
        break;

      case "ice-candidate":
        if (message.viewerId === viewerId && peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(message.candidate);
        }
        break;
    }
  };

  const { isConnected, connect, disconnect, send } = useWebSocket(handleWebSocketMessage);

  const handleOffer = async (sdp: string) => {
    // Create peer connection
    const pc = new WebRTCConnection();
    peerConnectionRef.current = pc;

    // Handle incoming stream
    pc.onTrack((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    // Handle ICE candidates
    pc.onIceCandidate((candidate) => {
      if (viewerId) {
        send({
          type: "ice-candidate",
          candidate: candidate.toJSON(),
          viewerId,
        });
      }
    });

    // Set remote description and create answer
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();

    // Send answer back
    if (viewerId) {
      send({
        type: "answer",
        sdp: answer.sdp!,
        viewerId,
      });
    }
  };

  const joinSession = () => {
    if (!inputSessionId.trim()) {
      toast({
        title: "Session ID required",
        description: "Please enter a valid session ID",
        variant: "destructive",
      });
      return;
    }

    const trimmedSessionId = inputSessionId.trim().toUpperCase();
    setSessionId(trimmedSessionId);
    setStatus("connecting");

    // Connect WebSocket
    connect();

    // Wait for connection then join session
    const checkConnection = setInterval(() => {
      if (isConnected) {
        clearInterval(checkConnection);
        send({
          type: "join-session",
          sessionId: trimmedSessionId,
          role: "viewer",
        });
      }
    }, 100);
  };

  const disconnectSession = () => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Disconnect WebSocket
    disconnect();

    setSessionId("");
    setViewerId(null);
    setStatus("disconnected");
    setMouseEnabled(false);
    setKeyboardEnabled(false);

    toast({
      title: "Disconnected",
      description: "You have been disconnected from the session",
    });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Mouse and keyboard event handlers
  useEffect(() => {
    if (!mouseEnabled || !videoRef.current) return;

    const videoElement = videoRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = videoElement.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      send({
        type: "mouse-move",
        x,
        y,
      });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = videoElement.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      send({
        type: "mouse-click",
        button: e.button,
        x,
        y,
      });
    };

    videoElement.addEventListener("mousemove", handleMouseMove);
    videoElement.addEventListener("click", handleClick);

    return () => {
      videoElement.removeEventListener("mousemove", handleMouseMove);
      videoElement.removeEventListener("click", handleClick);
    };
  }, [mouseEnabled, send]);

  useEffect(() => {
    if (!keyboardEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      send({
        type: "keyboard",
        key: e.key,
        type: "keydown",
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      send({
        type: "keyboard",
        key: e.key,
        type: "keyup",
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [keyboardEnabled, send]);

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-semibold">View Remote Desktop</h1>
                <p className="text-muted-foreground">Connect to a shared screen</p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Main Content */}
          {!sessionId ? (
            <Card className="p-12">
              <div className="max-w-md mx-auto space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Join Session</h2>
                  <p className="text-muted-foreground">
                    Enter the session ID provided by the host
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-id">Session ID</Label>
                    <Input
                      id="session-id"
                      placeholder="Enter session ID"
                      value={inputSessionId}
                      onChange={(e) => setInputSessionId(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && joinSession()}
                      className="font-mono text-center text-lg"
                      data-testid="input-session-id"
                    />
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={joinSession}
                    disabled={status === "connecting"}
                    data-testid="button-join-session"
                  >
                    {status === "connecting" ? "Connecting..." : "Connect"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Remote Screen Display */}
              <Card className="p-0 overflow-hidden" ref={containerRef}>
                <div className="relative bg-black aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    data-testid="video-remote-screen"
                  />
                  
                  {status !== "connected" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <MonitorOff className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg">
                        {status === "connecting" ? "Connecting to remote desktop..." : "No signal"}
                      </p>
                    </div>
                  )}

                  {/* Floating Controls */}
                  {status === "connected" && (
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <Button
                        size="icon"
                        variant={mouseEnabled ? "default" : "secondary"}
                        className="backdrop-blur-md"
                        onClick={() => setMouseEnabled(!mouseEnabled)}
                        data-testid="button-toggle-mouse"
                      >
                        <Mouse className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant={keyboardEnabled ? "default" : "secondary"}
                        className="backdrop-blur-md"
                        onClick={() => setKeyboardEnabled(!keyboardEnabled)}
                        data-testid="button-toggle-keyboard"
                      >
                        <Keyboard className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="backdrop-blur-md"
                        onClick={toggleFullscreen}
                        data-testid="button-toggle-fullscreen"
                      >
                        {isFullscreen ? (
                          <Minimize className="w-4 h-4" />
                        ) : (
                          <Maximize className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Session Info and Controls */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Session Information</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Session ID</div>
                      <code className="text-sm font-mono" data-testid="text-connected-session-id">
                        {sessionId}
                      </code>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Controls</div>
                      <div className="flex gap-2 text-sm">
                        <span className={mouseEnabled ? "text-chart-2" : "text-muted-foreground"}>
                          Mouse {mouseEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className={keyboardEnabled ? "text-chart-2" : "text-muted-foreground"}>
                          Keyboard {keyboardEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full mt-4"
                    onClick={disconnectSession}
                    data-testid="button-disconnect"
                  >
                    Disconnect
                  </Button>
                </Card>

                <ConnectionStatsDisplay stats={stats} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
