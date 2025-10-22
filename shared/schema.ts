import { z } from "zod";

// Session schema for remote desktop connections
export const sessionSchema = z.object({
  id: z.string(),
  hostId: z.string(),
  createdAt: z.number(),
  isActive: z.boolean(),
  viewerCount: z.number(),
});

export type Session = z.infer<typeof sessionSchema>;

export const insertSessionSchema = sessionSchema.omit({ 
  id: true, 
  createdAt: true,
  viewerCount: true 
});

export type InsertSession = z.infer<typeof insertSessionSchema>;

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

// WebSocket message types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join-session"),
    sessionId: z.string(),
    role: z.enum(["host", "viewer"]),
    hostId: z.string().optional(),
  }),
  z.object({
    type: z.literal("session-joined"),
    sessionId: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
    viewerId: z.string().optional(),
    existingViewers: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("viewer-connected"),
    viewerId: z.string(),
  }),
  z.object({
    type: z.literal("viewer-disconnected"),
    viewerId: z.string(),
  }),
  z.object({
    type: z.literal("offer"),
    sdp: z.string(),
    viewerId: z.string(),
  }),
  z.object({
    type: z.literal("answer"),
    sdp: z.string(),
    viewerId: z.string(),
  }),
  z.object({
    type: z.literal("ice-candidate"),
    candidate: z.any(),
    viewerId: z.string(),
  }),
  z.object({
    type: z.literal("mouse-move"),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("mouse-click"),
    button: z.number(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("keyboard"),
    key: z.string(),
    type: z.enum(["keydown", "keyup"]),
  }),
  z.object({
    type: z.literal("connection-stats"),
    fps: z.number(),
    latency: z.number(),
    bandwidth: z.number(),
    quality: z.enum(["excellent", "good", "fair", "poor"]),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;

// Stats for connection quality display
export interface ConnectionStats {
  fps: number;
  latency: number;
  bandwidth: number;
  quality: ConnectionQuality;
}
