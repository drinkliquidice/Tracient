import { createStore } from 'solid-js/store';
import { backendRequest } from '@/functional/utils';

export type AdminUser = {
    username: string;
    first_name: string;
    last_name: string;
    organizations: string[] | null;
};

const [user, setUser] = createStore<{ data: AdminUser | null; loading: boolean }>({
    data: null,
    loading: false,
});

export { user };

export const fetchUser = async (token: string) => {
    setUser('loading', true);
    try {
        const res = await backendRequest<AdminUser>('GET', '/api/admin/me', token);
        setUser('data', res);
    } catch {
        setUser('data', null);
    } finally {
        setUser('loading', false);
    }
};