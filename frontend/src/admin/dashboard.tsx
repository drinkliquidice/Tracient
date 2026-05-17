import { Component, createEffect, createResource, Match, Switch } from 'solid-js';


import { backendRequest, getToken, logout } from '@/functional/utils';
import { OrganizationInterfaceData} from '@/admin/organizations/functional/types';
import { DashboardBody } from './organizations/interface';
import { _mergeSearchString, useNavigate } from '@solidjs/router';

const HeaderCard: Component<{
    navigateLogin: () => void;
}> = (props) => (
    <div class="w-full h-20 bg-accent overflow-hidden flex items-center justify-between relative px-2">
        {/* Dot grid */}
        <div class="absolute inset-0 grid grid-cols-[repeat(32,1fr)] p-3 gap-3 opacity-[0.18] pointer-events-none" aria-hidden="true">
            {Array.from({ length: 64 }).map((_, i) => (
                <div
                    class="w-0.75 h-0.75 rounded-full bg-text self-center justify-self-center animate-pulse"
                    style={{ 'animation-delay': `${(i * 0.07) % 3}s` }}
                />
            ))}
        </div>

        <div class="mx-7 z-10 h-full flex flex-row gap-2 items-center">
            <span 
                class="font-mono font-bold text-lg tracking-[0.25em] text-text"
                style={{ "padding-left": "1rem" }}
            >
                DASHBOARD
            </span>
        </div>

        {/* Right — username + logout */}
        <div class="z-10 flex items-center gap-4 px-6">
            <span class="font-mono text-lg tracking-[0.15em] text-text/60">
                ADMIN
            </span>
            <div class="w-px h-4 bg-text/15" />
            <span 
                class="font-mono text-l tracking-[0.15em] text-text/60 hover:text-text transition-colors cursor-pointer"
                onClick={() => { logout(); props.navigateLogin(); }}
            >
                LOG OUT
            </span>
        </div>

    </div>
);

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
        window.location.href = '/login';
    }

    createEffect(() => {
        if ((pageData.error as any)?.status === 401) {
            navigateLogin();
        }
    });

    const [pageData] = createResource(
        async () => {
            return await backendRequest<OrganizationInterfaceData>('GET', '/api/admin/dashboard', tok!);
        }
    );

    return (
        <div class="flex flex-col min-h-screen font-sans bg-bg text-text">
            <HeaderCard navigateLogin={navigateLogin} />
            <Switch>
                <Match when={pageData.loading}>
                    <div class="flex-1 flex items-center justify-center">
                        <span class="w-6 h-6 border-2 border-text/20 border-t-text rounded-full animate-spin" />
                    </div> 
                </Match>

                <Match when={(pageData.error as any)?.status === 412}>
                    <NoOrganizationView />
                </Match>
                <Match when={pageData()}>
                    <DashboardBody data={pageData()!} />
                </Match>
            </Switch>
        </div>
    );
};

export default DashboardPage;