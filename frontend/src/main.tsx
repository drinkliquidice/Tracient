import { lazy, ParentComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { Router, Route, useNavigate } from '@solidjs/router';
import { isLoggedIn } from '@/functional/utils';
import '@/index.css';

const SignupPage = lazy(() => import('@/admin/signup'));
const LoginPage = lazy(() => import('@/admin/login'));
const DashboardPage = lazy(() => import('@/admin/dashboard'));
const CreateOrganizationPage = lazy(() => import('@/admin/organizations/create'));
const MemberTapPage = lazy(() => import('@/user/index'));

const AuthWrapper: ParentComponent = (props) => {
    const navigate = useNavigate();
    if (!isLoggedIn()) {
        navigate('/login', { replace: true });
        return <></>;
    }
    return <>{props.children}</>;
};

const AppRoot: ParentComponent = (props) => (
    <div class="min-h-screen bg-bg text-text font-sans">
        {props.children}
    </div>
);

export const mountApp = () =>
    render(
        () => (
            <Router root={AppRoot}>
                <Route path="/login" component={LoginPage} />
                <Route path="/signup" component={SignupPage} />
                <Route path="/admin" component={AuthWrapper}>
                    <Route path="/dashboard" component={DashboardPage} />
                    <Route path="/organization/create" component={CreateOrganizationPage} />
                    <Route path="/member/:id" component={MemberTapPage} /> 
                </Route>
            </Router>
        ),
        document.getElementById('app')!,
    );