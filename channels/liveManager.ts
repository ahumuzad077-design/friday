import { randomBytes } from 'crypto';

export interface LiveStreamSession {
  streamId: string;
  streamKey: string;
  title: string;
  broadcasterId: string;
  status: 'idle' | 'live' | 'ended';
  startedAt?: Date;
  viewerCount: number;
}

export class LiveStreamManager {
  private activeStreams: Map<string, LiveStreamSession> = new Map();

  /**
   * Initialize a new live stream session for a user or channel.
   */
  public createStream(title: string, broadcasterId: string): LiveStreamSession {
    const streamId = `stream_${randomBytes(4).toString('hex')}`;
    const streamKey = `live_${randomBytes(16).toString('hex')}`;

    const session: LiveStreamSession = {
      streamId,
      streamKey,
      title,
      broadcasterId,
      status: 'idle',
      viewerCount: 0,
    };

    this.activeStreams.set(streamId, session);
    return session;
  }

  /**
   * Authorize incoming ingestion stream key.
   */
  public authenticateStreamKey(streamKey: string): LiveStreamSession | null {
    for (const session of this.activeStreams.values()) {
      if (session.streamKey === streamKey) {
        session.status = 'live';
        session.startedAt = new Date();
        return session;
      }
    }
    return null;
  }

  /**
   * End an active broadcast.
   */
  public endStream(streamId: string): boolean {
    const session = this.activeStreams.get(streamId);
    if (session) {
      session.status = 'ended';
      return true;
    }
    return false;
  }

  public getStream(streamId: string): LiveStreamSession | undefined {
    return this.activeStreams.get(streamId);
  }
}
