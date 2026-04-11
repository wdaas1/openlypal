import { api } from './api';
import type { LiveMoment, LiveMomentMessage } from '../types';

export const liveMomentsApi = {
  getAll: () => api.get<LiveMoment[]>('/api/live-moments'),
  getOne: (id: string) => api.get<LiveMoment>(`/api/live-moments/${id}`),
  create: (data: { title: string; expiresAfter: number; invitedUserIds: string[]; roomId?: string }) =>
    api.post<LiveMoment>('/api/live-moments', data),
  end: (id: string) => api.patch<LiveMoment>(`/api/live-moments/${id}`, { status: 'ended' }),
  goLive: (id: string) => api.patch<LiveMoment>(`/api/live-moments/${id}/go-live`, {}),
  getMessages: (id: string) => api.get<LiveMomentMessage[]>(`/api/live-moments/${id}/messages`),
  sendMessage: (id: string, data: { content: string; type: string; contentUrl?: string }) =>
    api.post<LiveMomentMessage>(`/api/live-moments/${id}/messages`, data),
  join: (id: string) => api.post<{ viewerCount: number }>(`/api/live-moments/${id}/join`, {}),
  leave: (id: string) => api.post<{ viewerCount: number }>(`/api/live-moments/${id}/leave`, {}),
  invite: (id: string, userIds: string[]) =>
    api.post<LiveMoment>(`/api/live-moments/${id}/invite`, { userIds }),
  getArchive: () => api.get<LiveMoment[]>('/api/live-moments/archive'),
  restart: (id: string) => api.post<LiveMoment>(`/api/live-moments/${id}/restart`, {}),
};
