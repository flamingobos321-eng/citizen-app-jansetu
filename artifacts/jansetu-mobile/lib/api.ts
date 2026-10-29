export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const injectedDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
const normalizedDomain = injectedDomain
  ?.replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');

export const API_BASE_URL = normalizedDomain
  ? `https://${normalizedDomain}/api`
  : null;

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      'The API address is not configured for this build. Restart the mobile preview and try again.',
    );
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      requestBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      body: requestBody,
    });
  } catch {
    throw new ApiError(
      'JanSetu could not reach its service. Check your connection and try again.',
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.detail === 'string'
        ? payload.detail
        : typeof payload?.message === 'string'
          ? payload.message
          : `Request failed (${response.status})`;
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}

export type Portal = {
  office_code?: string;
  slug?: string;
  constituency_name?: string;
  politician_name?: string;
  theme_color?: string;
  portal_status?: string;
};

export type Citizen = {
  id: string;
  name: string;
  role: string;
  mobile?: string;
  address?: string;
  gender?: string;
  region_type?: string;
  house_number?: string;
  ward_id?: string;
  village_id?: string;
  tenant_id?: string;
};

export type Issue = {
  id: string;
  issue_code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at?: string;
  location_address?: string;
  timeline?: Array<{ status: string; at: string; by?: string; note?: string }>;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  notif_type: string;
  created_at: string;
};

export type CitizenStats = {
  total: number;
  resolved: number;
  pending: number;
};
