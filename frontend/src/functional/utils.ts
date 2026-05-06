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

export const backendRequest = async <T>(
    method: string,
    path: string,
    token: string | null,
    body?: unknown
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
    
    if (!res.ok) {
        const err = new Error(data?.detail || res.statusText);
        (err as any).status = res.status;
        throw err;
    }

    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    return data as T;
};