import { BrandTheme } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import type { UpsertBrandTheme, CreateBrandTheme, UpdateBrandTheme, GetBrandTheme, DeleteBrandTheme } from 'wasp/server/operations';

type BrandThemeData = {
  id?: string;
  colorScheme?: string[];
  preferredStyles?: string[];
  mood?: string[];
  lighting?: string[];
};

export const upsertBrandTheme: UpsertBrandTheme<BrandThemeData, BrandTheme> = async ({ colorScheme, preferredStyles, mood, lighting }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.upsert({
    where: { id: context.user.id },
    update: { colorScheme, preferredStyles, mood, lighting },
    create: { colorScheme, preferredStyles, mood, lighting, user: { connect: { id: context.user.id } } },
  });
};

export const createBrandTheme: CreateBrandTheme<BrandThemeData, BrandTheme> = async ({ colorScheme, preferredStyles, mood, lighting }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.create({
    data: {
      colorScheme,
      preferredStyles,
      mood,
      lighting,
      user: { connect: { id: context.user.id } },
    },
  });
};

export const updateBrandTheme: UpdateBrandTheme<BrandThemeData, BrandTheme> = async ({ id, colorScheme, preferredStyles, mood, lighting }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.update({
    where: { 
      id,
      userId: context.user.id 
    },
    data: { colorScheme, preferredStyles, mood, lighting },
  });
};

export const deleteBrandTheme: DeleteBrandTheme<BrandTheme, BrandTheme> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.delete({
    where: { 
      id,
      userId: context.user.id 
    },
  });
};

export const getBrandTheme: GetBrandTheme<void, BrandTheme | null> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.findFirst({
    where: {
      userId: context.user.id,
    },
  });
};
