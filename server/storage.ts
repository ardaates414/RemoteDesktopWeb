import { type Session } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createSession(hostId: string): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateViewerCount(id: string, count: number): Promise<void>;
  deleteSession(id: string): Promise<void>;
  getAllActiveSessions(): Promise<Session[]>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

  async createSession(hostId: string): Promise<Session> {
    const id = randomUUID().substring(0, 8).toUpperCase();
    const session: Session = {
      id,
      hostId,
      createdAt: Date.now(),
      isActive: true,
      viewerCount: 0,
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateViewerCount(id: string, count: number): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.viewerCount = count;
    }
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }
}

export const storage = new MemStorage();
