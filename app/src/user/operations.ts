import type { UpdateCurrentUserLastActiveTimestamp, UpdateUserIsAdminById, GetPaginatedUsers } from 'wasp/server/operations';
import { type User } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import { type SubscriptionStatus } from '../payment/plans';

export const updateUserIsAdminById: UpdateUserIsAdminById<{ id: User['id'], isAdmin: User['isAdmin'] }, User> = async ({ id, isAdmin }, context) => {
  if (!context.user) {
		throw new HttpError(401);
  }
  if (!context.user.isAdmin) {
		throw new HttpError(403);
  }
  if (!id || isAdmin === undefined) {
		throw new HttpError(400);
  }

  return context.entities.User.update({
		where: { id },
		data: { isAdmin },
  });
};

export const updateCurrentUserLastActiveTimestamp: UpdateCurrentUserLastActiveTimestamp<void, User> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.User.update({
    where: {
      id: context.user.id,
    },
    data: {
      lastActiveTimestamp: new Date(),
    },
  });
};

type GetPaginatedUsersInput = {
  skip: number;
  cursor?: number | undefined;
  emailContains?: string;
  isAdmin?: boolean;
  subscriptionStatus?: SubscriptionStatus[];
};
type GetPaginatedUsersOutput = {
  users: Pick<User, 'id' | 'email' | 'username' | 'lastActiveTimestamp' | 'subscriptionStatus' | 'paymentProcessorUserId'>[];
  totalPages: number;
};

export const getPaginatedUsers: GetPaginatedUsers<GetPaginatedUsersInput, GetPaginatedUsersOutput> = async (args, context) => {
  if (!context.user?.isAdmin) {
    throw new HttpError(401);
  }

  const allSubscriptionStatusOptions = args.subscriptionStatus as Array<string | null> | undefined;
  const hasNotSubscribed = allSubscriptionStatusOptions?.find((status) => status === null);
  let subscriptionStatusStrings = allSubscriptionStatusOptions?.filter((status) => status !== null) as string[] | undefined;

  const queryResults = await context.entities.User.findMany({
    skip: args.skip,
    take: 10,
    where: {
      AND: [
        {
          email: {
            contains: args.emailContains || undefined,
            mode: 'insensitive',
          },
          isAdmin: args.isAdmin,
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: subscriptionStatusStrings,
              },
            },
            {
              subscriptionStatus: {
                equals: hasNotSubscribed,
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      lastActiveTimestamp: true,
      subscriptionStatus: true,
      paymentProcessorUserId: true,
    },
    orderBy: {
      id: 'desc',
    },
  });

  const totalUserCount = await context.entities.User.count({
    where: {
      AND: [
        {
          email: {
            contains: args.emailContains || undefined,
            mode: 'insensitive',
          },
          isAdmin: args.isAdmin,
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: subscriptionStatusStrings,
              },
            },
            {
              subscriptionStatus: {
                equals: hasNotSubscribed,
              },
            },
          ],
        },
      ],
    },
  });
  const totalPages = Math.ceil(totalUserCount / 10);

  return {
    users: queryResults,
    totalPages,
  };
};
