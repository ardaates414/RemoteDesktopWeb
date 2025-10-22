import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { type WSMessage } from "@shared/schema";

// Client tracking
interface Client {
  ws: WebSocket;
  sessionId: string;
  role: "host" | "viewer";
  id: string;
}

const clients = new Map<string, Client>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Session Management API
  app.post("/api/sessions", async (req, res) => {
    try {
      const hostId = Math.random().toString(36).substring(2, 18);
      const session = await storage.createSession(hostId);
      
      // Return session with hostId for authentication
      res.json({ ...session, hostId });
    } catch (error) {
      console.error("Failed to create session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Failed to get session:", error);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      await storage.deleteSession(req.params.id);
      
      // Disconnect all clients in this session
      for (const [clientId, client] of clients.entries()) {
        if (client.sessionId === req.params.id) {
          client.ws.close();
          clients.delete(clientId);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket Server Setup
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`Client connected: ${clientId}`);

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case "join-session":
            await handleJoinSession(ws, clientId, message);
            break;
            
          case "offer":
          case "answer":
          case "ice-candidate":
            handleSignaling(clientId, message);
            break;
            
          case "mouse-move":
          case "mouse-click":
          case "keyboard":
            handleInputEvent(clientId, message);
            break;
            
          case "connection-stats":
            handleConnectionStats(clientId, message);
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      handleClientDisconnect(clientId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });

  async function handleJoinSession(
    ws: WebSocket,
    clientId: string,
    message: Extract<WSMessage, { type: "join-session" }>
  ) {
    const { sessionId, role, hostId } = message;
    
    // Verify session exists
    const session = await storage.getSession(sessionId);
    if (!session) {
      const response: Extract<WSMessage, { type: "session-joined" }> = {
        type: "session-joined",
        sessionId,
        success: false,
        error: "Session not found",
      };
      ws.send(JSON.stringify(response));
      return;
    }

    // Validate host identity
    if (role === "host") {
      if (!hostId || hostId !== session.hostId) {
        const response: Extract<WSMessage, { type: "session-joined" }> = {
          type: "session-joined",
          sessionId,
          success: false,
          error: "Invalid host credentials",
        };
        ws.send(JSON.stringify(response));
        return;
      }
    }

    // Register client
    clients.set(clientId, {
      ws,
      sessionId,
      role,
      id: clientId,
    });

    // Prepare response based on role
    if (role === "viewer") {
      // Send viewerId to viewer
      const response: Extract<WSMessage, { type: "session-joined" }> = {
        type: "session-joined",
        sessionId,
        success: true,
        viewerId: clientId,
      };
      ws.send(JSON.stringify(response));

      // Update viewer count
      const viewers = getSessionViewers(sessionId);
      await storage.updateViewerCount(sessionId, viewers.length);
      
      // Notify host of new viewer
      const notification: Extract<WSMessage, { type: "viewer-connected" }> = {
        type: "viewer-connected",
        viewerId: clientId,
      };
      broadcastToHost(sessionId, notification);
    } else {
      // Send existing viewer list to host
      const viewers = getSessionViewers(sessionId);
      const viewerIds = viewers.map(v => v.id);
      
      const response: Extract<WSMessage, { type: "session-joined" }> = {
        type: "session-joined",
        sessionId,
        success: true,
        existingViewers: viewerIds,
      };
      ws.send(JSON.stringify(response));
    }

    console.log(`Client ${clientId} joined session ${sessionId} as ${role}`);
  }

  function handleSignaling(
    clientId: string,
    message: Extract<WSMessage, { type: "offer" | "answer" | "ice-candidate" }>
  ) {
    const client = clients.get(clientId);
    if (!client) return;

    const { sessionId } = client;
    const { viewerId } = message;

    if (message.type === "offer") {
      // Host sends offer to specific viewer
      const viewerClient = Array.from(clients.values()).find(
        (c) => c.id === viewerId && c.sessionId === sessionId && c.role === "viewer"
      );
      if (viewerClient && viewerClient.ws.readyState === WebSocket.OPEN) {
        viewerClient.ws.send(JSON.stringify(message));
      }
    } else if (message.type === "answer") {
      // Viewer sends answer back to host
      broadcastToHost(sessionId, message);
    } else if (message.type === "ice-candidate") {
      // Exchange ICE candidates
      if (client.role === "host") {
        const viewerClient = Array.from(clients.values()).find(
          (c) => c.id === viewerId && c.sessionId === sessionId && c.role === "viewer"
        );
        if (viewerClient && viewerClient.ws.readyState === WebSocket.OPEN) {
          viewerClient.ws.send(JSON.stringify(message));
        }
      } else {
        broadcastToHost(sessionId, message);
      }
    }
  }

  function handleInputEvent(
    clientId: string,
    message: Extract<WSMessage, { type: "mouse-move" | "mouse-click" | "keyboard" }>
  ) {
    const client = clients.get(clientId);
    if (!client || client.role !== "viewer") return;

    // Forward input events to host
    broadcastToHost(client.sessionId, message);
  }

  function handleConnectionStats(
    clientId: string,
    message: Extract<WSMessage, { type: "connection-stats" }>
  ) {
    const client = clients.get(clientId);
    if (!client) return;

    // Broadcast stats to all clients in session
    broadcastToSession(client.sessionId, message);
  }

  function handleClientDisconnect(clientId: string) {
    const client = clients.get(clientId);
    if (!client) return;

    const { sessionId, role } = client;
    clients.delete(clientId);

    console.log(`Client ${clientId} disconnected from session ${sessionId}`);

    // If viewer disconnected, notify host and update count
    if (role === "viewer") {
      const viewers = getSessionViewers(sessionId);
      storage.updateViewerCount(sessionId, viewers.length);
      
      const notification: Extract<WSMessage, { type: "viewer-disconnected" }> = {
        type: "viewer-disconnected",
        viewerId: clientId,
      };
      
      broadcastToHost(sessionId, notification);
    }

    // If host disconnected, close session and disconnect all viewers
    if (role === "host") {
      storage.deleteSession(sessionId);
      
      for (const [cId, c] of clients.entries()) {
        if (c.sessionId === sessionId) {
          c.ws.close();
          clients.delete(cId);
        }
      }
    }
  }

  function getSessionViewers(sessionId: string): Client[] {
    return Array.from(clients.values()).filter(
      (c) => c.sessionId === sessionId && c.role === "viewer"
    );
  }

  function broadcastToHost(sessionId: string, message: WSMessage) {
    const host = Array.from(clients.values()).find(
      (c) => c.sessionId === sessionId && c.role === "host"
    );
    
    if (host && host.ws.readyState === WebSocket.OPEN) {
      host.ws.send(JSON.stringify(message));
    }
  }

  function broadcastToSession(sessionId: string, message: WSMessage) {
    for (const client of clients.values()) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  return httpServer;
}
