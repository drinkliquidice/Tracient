export const saveToken = (token: string, refreshToken?: string) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
};

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5173';
export const getToken = () => localStorage.getItem('token');
export const getRefreshToken = () => localStorage.getItem('refresh_token');
export const isLoggedIn = () => !!getToken();

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
};

const AUTH_PATHS = new Set([
    '/api/admin/login',
    '/api/admin/signup',
    '/api/admin/refresh',
]);

/** Shared in-flight refresh so parallel 401s only hit /refresh once. */
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${BASE_URL}/api/admin/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data?.token) return null;

        saveToken(data.token);
        return data.token as string;
    } catch {
        return null;
    }
};

const getRefreshedAccessToken = async (): Promise<string | null> => {
    if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
};

const forceLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
};

export const backendRequest = async <T>(
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
    retried = false,
): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Read as text first so we can safely attempt JSON parse
    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        // Server returned non-JSON (HTML error page, plain text, etc.)
        const err = new Error(text || res.statusText);
        (err as any).status = res.status;
        throw err;
    }

    if (res.status === 401 && !retried && !AUTH_PATHS.has(path)) {
        const newToken = await getRefreshedAccessToken();
        if (newToken) {
            return backendRequest<T>(method, path, newToken, body, true);
        }
        forceLogout();
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const err = new Error(data?.detail || res.statusText);
        (err as any).status = res.status;
        throw err;
    }

    return data as T;
};
