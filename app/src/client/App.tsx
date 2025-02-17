import type { AuthUser } from 'wasp/auth';

import './Main.css';
import NavBar from './components/NavBar/NavBar';
import CookieConsentBanner from './components/cookie-consent/Banner';
import { appNavigationItems } from './components/NavBar/contentSections';
import { landingPageNavigationItems } from '../landing-page/contentSections';
import { useMemo, useEffect } from 'react';
import { routes } from 'wasp/client/router';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from 'wasp/client/auth';
import { useIsLandingPage } from './hooks/useIsLandingPage';
import { updateCurrentUserLastActiveTimestamp } from 'wasp/client/operations';
import { Toaster } from 'react-hot-toast';
import { BiLogIn } from 'react-icons/bi';
import { Link as WaspRouterLink } from 'wasp/client/router';
import DropdownUser from '../user/DropdownUser';
import AppNavBar from './components/NavBar/NavBar';

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const isLandingPage = useIsLandingPage();
  const { data: user, isLoading: isUserLoading, isError: isUserError } = useAuth();
  const navigationItems = isLandingPage ? landingPageNavigationItems : appNavigationItems;

  const shouldDisplayAppNavBar = useMemo(() => {
    return location.pathname !== routes.LoginRoute.build() && location.pathname !== routes.SignupRoute.build();
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location]);

  useEffect(() => {
    if (user) {
      const lastSeenAt = new Date(user.lastActiveTimestamp);
      const today = new Date();
      if (today.getTime() - lastSeenAt.getTime() > 5 * 60 * 1000) {
        updateCurrentUserLastActiveTimestamp(); // <- no args needed
      }
    }
  }, [user]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  return (
    <>
      <div className='min-h-screen mt-2 dark:text-white dark:bg-boxdark-2'>
        {isAdminDashboard ? (
          <Outlet />
        ) : (
          <>
            <div>
              <Outlet />
              <FloatingUserMenu isUserLoading={isUserLoading} user={user} />
            </div>
          </>
        )}
      </div>
      <Toaster position='bottom-center' />
    </>
  );
}

const FloatingUserMenu = ({ isUserLoading, user }: { isUserLoading: boolean; user?: AuthUser | null }) => {
  return (
    <div className='fixed bottom-4 left-4 z-50'>
      {isUserLoading ? null : !user ? (
        <WaspRouterLink to={routes.LoginRoute.to}>
          <div className='w-14 h-14 flex items-center justify-center bg-yellow-500 rounded-full shadow-lg hover:bg-yellow-600'>
            <BiLogIn size='1.5rem' className='mr-1 text-white' />
          </div>
        </WaspRouterLink>
      ) : (
        <div className='w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg'>
          <DropdownUser user={user} />
        </div>
      )}
    </div>
  );
};
