import type { NavigationItem } from '../NavBar/NavBar';
import { routes } from 'wasp/client/router';

export const appNavigationItems: NavigationItem[] = [
  { name: 'Image Generator', to: routes.GenerateImagePromptRoute.to },
  { name: 'Pricing', to: routes.PricingPageRoute.to },
];
