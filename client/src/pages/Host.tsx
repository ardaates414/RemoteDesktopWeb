import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Monitor, Users } from "lucide-react";
import { useLocation } from "wouter";
import { SessionCard } from "@/components/SessionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectionStatsDisplay } from "@/components/ConnectionStats";
import { type ConnectionStatus, type ConnectionStats, type WSMessage } from "@shared/schema";
import { useWebSocket } from "@/lib/useWebSocket";
import { WebRTCConnection } from "@/lib/webrtc";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Host() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [viewerCount, setViewerCount] = useState(0);
  const [stats] = useState<ConnectionStats>({
    fps: 30,
    latency: 45,
    bandwidth: 2048,
    quality: "excellent",
  });
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const { toast } = useToast();

  const handleWebSocketMessage = async (message: WSMessage) => {
    switch (message.type) {
      case "session-joined":
        if (message.success) {
          setStatus("connected");
          if (message.existingViewers && message.existingViewers.length > 0) {
            // Send offers to existing viewers
            for (const viewerId of message.existingViewers) {
              await createOfferForViewer(viewerId);
            }
          }
        } else {
          setStatus("error");
          toast({
            title: "Failed to join session",
            description: message.error || "Unknown error",
            variant: "destructive",
          });
        }
        break;

      case "viewer-connected":
        setViewerCount((prev) => prev + 1);
        toast({
          title: "Viewer connected",
          description: "A new viewer has joined the session",
        });
        // Create offer for new viewer
        await createOfferForViewer(message.viewerId);
        break;

      case "viewer-disconnected":
        setViewerCount((prev) => Math.max(0, prev - 1));
        // Clean up peer connection
        const pc = peerConnectionsRef.current.get(message.viewerId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(message.viewerId);
        }
        break;

      case "answer":
        const answerPc = peerConnectionsRef.current.get(message.viewerId);
        if (answerPc) {
          await answerPc.setRemoteDescription({ type: "answer", sdp: message.sdp });
        }
        break;

      case "ice-candidate":
        const icePc = peerConnectionsRef.current.get(message.viewerId);
        if (icePc && message.candidate) {
          await icePc.addIceCandidate(message.candidate);
        }
        break;

      case "mouse-move":
        console.log(`Mouse moved to (${message.x.toFixed(2)}, ${message.y.toFixed(2)})`);
        // Note: Browser security prevents actual cursor control
        break;

      case "mouse-click":
        console.log(`Mouse clicked button ${message.button} at (${message.x.toFixed(2)}, ${message.y.toFixed(2)})`);
        // Note: Browser security prevents actual click synthesis
        break;

      case "keyboard":
        console.log(`Keyboard ${message.type}: ${message.key}`);
        // Note: Browser security prevents actual keyboard synthesis
        break;
    }
  };

  const { isConnected, connect, disconnect, send } = useWebSocket(handleWebSocketMessage);

  const createOfferForViewer = async (viewerId: string) => {
    if (!streamRef.current) return;

    const pc = new WebRTCConnection();
    peerConnectionsRef.current.set(viewerId, pc);

    // Add stream to peer connection
    pc.addStream(streamRef.current);

    // Handle ICE candidates
    pc.onIceCandidate((candidate) => {
      send({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
        viewerId,
      });
    });

    // Create and send offer
    const offer = await pc.createOffer();
    send({
      type: "offer",
      sdp: offer.sdp!,
      viewerId,
    });
  };

  const startSharing = async () => {
    setStatus("connecting");
    
    try {
      // Request screen capture permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen" as any,
        },
        audio: false,
      });

      streamRef.current = stream;

      // Create session
      const response = await apiRequest("POST", "/api/sessions", {});
      const session = response as { id: string; hostId: string };
      
      setSessionId(session.id);
      setHostId(session.hostId);

      // Connect WebSocket
      connect();

      // Wait for connection then join session
      const checkConnection = setInterval(() => {
        if (isConnected) {
          clearInterval(checkConnection);
          send({
            type: "join-session",
            sessionId: session.id,
            role: "host",
            hostId: session.hostId,
          });
        }
      }, 100);

      // Track stream end
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        endSession();
      });
    } catch (error) {
      console.error("Failed to start screen sharing:", error);
      setStatus("error");
      toast({
        title: "Screen sharing failed",
        description: "Please grant permission and try again",
        variant: "destructive",
      });
    }
  };

  const endSession = async () => {
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close all peer connections
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();

    // Disconnect WebSocket
    disconnect();

    // Delete session
    if (sessionId) {
      await apiRequest("DELETE", `/api/sessions/${sessionId}`, {});
    }

    setSessionId(null);
    setHostId(null);
    setStatus("disconnected");
    setViewerCount(0);
  };

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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
                <h1 className="text-3xl font-semibold">Host Session</h1>
                <p className="text-muted-foreground">Share your screen with others</p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Main Content */}
          {!sessionId ? (
            <Card className="p-12">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Ready to Share</h2>
                  <p className="text-muted-foreground max-w-md">
                    Click the button below to start sharing your screen. You'll receive a
                    session ID to share with viewers.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={startSharing}
                  disabled={status === "connecting"}
                  data-testid="button-start-sharing"
                >
                  {status === "connecting" ? "Starting..." : "Start Screen Sharing"}
                </Button>
                {status === "error" && (
                  <p className="text-sm text-destructive">
                    Failed to access screen. Please grant permission and try again.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Session Info */}
              <SessionCard
                sessionId={sessionId}
                viewerCount={viewerCount}
                onEndSession={endSession}
              />

              {/* Active Viewers */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Active Viewers</h3>
                </div>
                {viewerCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Waiting for viewers to connect...</p>
                    <p className="text-sm mt-2">Share your session ID to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {viewerCount} {viewerCount === 1 ? "viewer" : "viewers"} connected
                    </p>
                  </div>
                )}
              </Card>

              {/* Connection Stats */}
              {viewerCount > 0 && <ConnectionStatsDisplay stats={stats} />}

              {/* Instructions */}
              <Card className="p-6 bg-muted/50">
                <h3 className="font-semibold mb-3">Instructions</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Share the session ID with viewers to allow them to connect</li>
                  <li>• Your screen is being streamed in real-time to connected viewers</li>
                  <li>• Click "End Session" to stop sharing and disconnect all viewers</li>
                  <li>• Closing or minimizing the shared window will end the session</li>
                </ul>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
