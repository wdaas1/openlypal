import { api } from './api';

export type ModuleType = 'project' | 'goal' | 'mood' | 'learning' | 'availability';

export interface ProfileModule {
  id: string;
  userId: string;
  type: ModuleType;
  content: string; // JSON string
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const profileModulesApi = {
  getOwn: () => api.get<ProfileModule[]>('/api/profile-modules'),
  getForUser: (userId: string) =>
    api.get<ProfileModule[]>(`/api/profile-modules/user/${userId}`),
  create: (data: { type: ModuleType; content: string }) =>
    api.post<ProfileModule>('/api/profile-modules', data),
  update: (id: string, data: { content?: string; position?: number }) =>
    api.put<ProfileModule>(`/api/profile-modules/${id}`, data),
  delete: (id: string) => api.delete<null>(`/api/profile-modules/${id}`),
};
