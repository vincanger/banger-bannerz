import { type DeleteOldGeneratedImagesJob } from 'wasp/server/jobs';

export const deleteOldGeneratedImagesWorker: DeleteOldGeneratedImagesJob<never, void> = async (_args, context) => {
  try {
    console.log('Running deleteOldGeneratedImagesWorker');
    const thresholdDate = new Date(Date.now() - 23 * 60 * 60 * 1000);

    const imagesToDelete = await context.entities.GeneratedImageData.findMany({
      where: {
        saved: false,
        createdAt: { lt: thresholdDate },
      },
    });

    for (const image of imagesToDelete) {
      await context.entities.GeneratedImageData.delete({
        where: { id: image.id },
      });
      console.log(`Deleted generated image with id: ${image.id}`);
    }
  } catch (error) {
    console.error('Error in deleteOldGeneratedImagesWorker:', error);
  }
};
