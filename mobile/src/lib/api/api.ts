import { supabase } from '../supabase';

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

const getToken = async (forceRefresh = false): Promise<string | undefined> => {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const request = async <T>(
  url: string,
  options: { method?: string; body?: string } = {},
  retry = true
): Promise<T> => {
  const token = await getToken();
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // On 401, try refreshing the token once and retry the request
  if (response.status === 401 && retry && token) {
    const freshToken = await getToken(true);
    if (freshToken && freshToken !== token) {
      return request(url, options, false);
    }
  }

  if (response.status === 204) return null as T;

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    if (isJson) {
      try {
        const err = await response.json();
        message = err?.error?.message ?? message;
      } catch {}
    }
    throw new Error(message);
  }

  if (isJson) {
    const json = await response.json();
    return (json?.data !== undefined ? json.data : json) as T;
  }

  return null as T;
};

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: any) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body: any) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  patch: <T>(url: string, body: any) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
};

export type CallType = 'video' | 'audio';

export type CallUser = {
  id: string;
  username: string;
  name: string;
  image: string | null;
};

export type Call = {
  id: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: string;
  createdAt: string;
  caller?: CallUser;
  callee?: CallUser;
};

export const callsApi = {
  initiate: (calleeId: string, type: CallType) =>
    api.post<{ call: Call; token: string; wsUrl: string }>('/api/calls', { calleeId, type }),

  accept: (callId: string) =>
    api.post<{ token: string; wsUrl: string }>(`/api/calls/${callId}/accept`, {}),

  decline: (callId: string) =>
    api.post<null>(`/api/calls/${callId}/decline`, {}),

  end: (callId: string) =>
    api.post<null>(`/api/calls/${callId}/end`, {}),

  getIncoming: () =>
    api.get<{ call: (Call & { caller: CallUser }) | null }>('/api/calls/incoming'),

  getCall: (callId: string) =>
    api.get<{ call: Call }>(`/api/calls/${callId}`),
};
