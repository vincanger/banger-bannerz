import React from 'react';
import { Link as WaspRouterLink, routes } from 'wasp/client/router';

export function NotFoundPage() {

  return (
    <div className='flex items-center justify-center min-h-screen'>
      <div className='text-center'>
        <h1 className='text-6xl font-bold  mb-4'>404</h1>
        <p className='text-lg text-bodydark mb-8'>Oops! The page you're looking for doesn't exist.</p>
        <WaspRouterLink
          to={routes.GenerateImagePromptRoute.to}
          className='inline-block px-8 py-3 text-white font-semibold bg-yellow-500 rounded-lg hover:bg-yellow-400 transition duration-300'
        >
          Go Back Home
        </WaspRouterLink>
      </div>
    </div>
  );
}
