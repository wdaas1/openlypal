import { api } from './api';

export interface RelationshipStat {
  user: { id: string; name: string; username: string | null; image: string | null };
  lastInteractionAt: string | null;
  daysSince: number;
  messageCount: number;
  likeCount: number;
  commentCount: number;
  strengthScore: number; // 0–100
  isDrifting: boolean;
}

export const relationshipsApi = {
  getAll: () => api.get<RelationshipStat[]>('/api/relationships'),
  getNudges: () => api.get<RelationshipStat[]>('/api/relationships/nudges'),
};
