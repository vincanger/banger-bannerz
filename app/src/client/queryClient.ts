import { configureQueryClient } from 'wasp/client/operations';

export async function setupQueryClient(): Promise<void> {
  configureQueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
}