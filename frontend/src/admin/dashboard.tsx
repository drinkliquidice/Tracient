import { Component, createEffect, createSignal, Match, onCleanup, Switch } from 'solid-js';


import { backendRequest, getToken } from '@/functional/utils';
import { OrganizationInterfaceData} from '@/admin/organizations/functional/types';
import { DashboardBody } from './organizations/interface';
import { AppHeader } from '@/components/AppHeader';
import { useNavigate } from '@solidjs/router';

const NoOrganizationView: Component = () => (
    <div class="flex-1 flex flex-col items-center justify-center gap-3">
        <h2 class="text-2xl font-bold">No organization found</h2>
        <p class="font-mono text-sm text-text/60">Please click the button below to create one.</p>
        <a href="/admin/organization/create" class="px-6 py-4 bg-accent text-text rounded hover:bg-accent/90 transition-colors">
            Create Organization
        </a>
    </div>
);


const DashboardPage: Component = () => {
    const navigate = useNavigate();
    const navigateLogin = () => navigate('/login/');
    const tok = getToken();

    if (!tok) {
        navigateLogin();
    }

    const [pageData, setPageData] = createSignal<OrganizationInterfaceData | undefined>();
    const [error, setError] = createSignal<{ status?: number } | undefined>();
    const [initialLoading, setInitialLoading] = createSignal(true);
    let inflight = false;

    const load = async (silent = false) => {
        if (!tok || inflight) return;
        if (silent && document.hidden) return;
        inflight = true;
        if (!silent) setInitialLoading(true);
        try {
            const next = await backendRequest<OrganizationInterfaceData>('GET', '/api/admin/dashboard', tok);
            setPageData(next);
            setError(undefined);
        } catch (e: any) {
            setError(e);
            if (e?.status === 401) navigateLogin();
        } finally {
            inflight = false;
            setInitialLoading(false);
        }
    };

    void load(false);
    const timer = setInterval(() => { void load(true); }, 1800000);
    onCleanup(() => clearInterval(timer));

    createEffect(() => {
        if (error()?.status === 401) {
            navigateLogin();
        }
    });

    return (
        <div class="flex flex-col h-screen font-sans bg-bg text-text overflow-hidden">
            <AppHeader title="DASHBOARD" />
            <Switch>
                <Match when={initialLoading() && !pageData()}>
                    <div class="flex-1 flex items-center justify-center">
                        <span class="w-6 h-6 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </div> 
                </Match>

                <Match when={error()?.status === 412}>
                    <NoOrganizationView />
                </Match>
                <Match when={!!pageData()}>
                    <DashboardBody
                        data={() => pageData()!}
                        refetch={() => { void load(true); }}
                    />
                </Match>
            </Switch>
        </div>
    );
};

export default DashboardPage;
