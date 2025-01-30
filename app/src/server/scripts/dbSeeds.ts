import type { User, ImageTemplate } from 'wasp/entities';
import { faker } from '@faker-js/faker';
import type { PrismaClient } from '@prisma/client';
import { getSubscriptionPaymentPlanIds, type SubscriptionStatus } from '../../payment/plans';

type MockUserData = Omit<User, 'id'>;

/**
 * This function, which we've imported in `app.db.seeds` in the `main.wasp` file,
 * seeds the database with mock users via the `wasp db seed` command.
 * For more info see: https://wasp-lang.dev/docs/data-model/backends#seeding-the-database
 */
export async function seedMockUsers(prismaClient: PrismaClient) {
  await Promise.all(generateMockUsersData(50).map((data) => prismaClient.user.create({ data })));
}

function generateMockUsersData(numOfUsers: number): MockUserData[] {
  return faker.helpers.multiple(generateMockUserData, { count: numOfUsers });
}

function generateMockUserData(): MockUserData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const subscriptionStatus = faker.helpers.arrayElement<SubscriptionStatus | null>(['active', 'cancel_at_period_end', 'past_due', 'deleted', null]);
  const now = new Date();
  const createdAt = faker.date.past({ refDate: now });
  const lastActiveTimestamp = faker.date.between({ from: createdAt, to: now });
  const credits = subscriptionStatus ? 0 : faker.number.int({ min: 0, max: 10 });
  const hasUserPaidOnStripe = !!subscriptionStatus || credits > 3;
  return {
    email: faker.internet.email({ firstName, lastName }),
    username: faker.internet.userName({ firstName, lastName }),
    createdAt,
    lastActiveTimestamp,
    isAdmin: false,
    sendNewsletter: false,
    credits,
    subscriptionStatus,
    lemonSqueezyCustomerPortalUrl: null,
    paymentProcessorUserId: hasUserPaidOnStripe ? `cus_test_${faker.string.uuid()}` : null,
    datePaid: hasUserPaidOnStripe ? faker.date.between({ from: createdAt, to: lastActiveTimestamp }) : null,
    subscriptionPlan: subscriptionStatus ? faker.helpers.arrayElement(getSubscriptionPaymentPlanIds()) : null,
  };
}

export async function seedTemplates(prismaClient: PrismaClient) {
  const templateData: Omit<ImageTemplate, 'id' | 'createdAt'>[] = [
    {
      name: 'cardboard art',
      description: null,
      exampleImagePrompt: null,
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/LgHJ0QJxTEC-RNAMaystb.png',
      loraUrl: 'https://huggingface.co/strangerzonehf/Flux-Cardboard-Art-LoRA',
      loraTriggerWord: 'cardboard# art',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'pixel art',
      description: null,
      exampleImagePrompt:
        'An eye-level view of a mountain range, the mountain range is adorned with a vibrant shade of pink and purple. The mountains are set against a backdrop of a light blue sky, dotted with fluffy white clouds. In the foreground of the image, a field of wildflowers, a few houses, and a few trees are visible. The field is a vibrant green, and the houses are a reddish-brown color. The sky is a muted blue, with a few wispy clouds in the air.',
      exampleImageUrl:
        'https://cdn-lfs-us-1.hf.co/repos/fc/c5/fcc5cbe2164762ef9ecbc3f4d3f3d2a752519b507aa3214be49d51e2b5928db4/59ea49017d0683ecaa328c8a5918fc0d91226ee92be83e456468fa4e8aa5fcb5?response-content-disposition=inline%3B+filename*%3DUTF-8%27%274.png%3B+filename%3D%224.png%22%3B&response-content-type=image%2Fpng&Expires=1738161349&Policy=eyJTdGF0ZW1lbnQiOlt7IkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTczODE2MTM0OX19LCJSZXNvdXJjZSI6Imh0dHBzOi8vY2RuLWxmcy11cy0xLmhmLmNvL3JlcG9zL2ZjL2M1L2ZjYzVjYmUyMTY0NzYyZWY5ZWNiYzNmNGQzZjNkMmE3NTI1MTliNTA3YWEzMjE0YmU0OWQ1MWUyYjU5MjhkYjQvNTllYTQ5MDE3ZDA2ODNlY2FhMzI4YzhhNTkxOGZjMGQ5MTIyNmVlOTJiZTgzZTQ1NjQ2OGZhNGU4YWE1ZmNiNT9yZXNwb25zZS1jb250ZW50LWRpc3Bvc2l0aW9uPSomcmVzcG9uc2UtY29udGVudC10eXBlPSoifV19&Signature=SXUDYMZd2-DCRIt9nl-WtcDrLhaJyrwrRh7ITZuqLPVBW85GeqFVWV26KmgkmyGlXAGroec3ET6w3VnHIUhcDHdyNVTLa3E%7EH251cHUbmVeUg5nUGE1lfQiJiHv22P0IbDJX8g7g6bJT4azfxCwV-PbuFB0aWCrtdPtOwwpkMu%7EHH6rkcWHFtPm9UIZKoqvdFbKg6wVPhUaqYZUE5SGjQfFUREktcg043fgZPS%7Ehq2VzUaVnZZnV50wXCBIs8sbG0FfcTqFW68vTHMt8uk4X-mmgwaikxnpOLpMFBhaLPFVfGtHcLJSapwA6Hc80dxbKe8fxuO%7EziYkJoP5tdCLEzQ__&Key-Pair-Id=K24J24Z295AEI9',
      loraUrl: 'https://huggingface.co/strangerzonehf/Flux-Pixel-Background-LoRA',
      basePrompt: '',
      prefix: '',
      suffix: '',
      loraTriggerWord: 'Pixel Background',
    },
    {
      name: 'sketchy',
      description: 'A somewhat impressionistic colored pencil sketch, reminiscent of Van Gogh.',
      exampleImagePrompt:
        'A medium-sized painting of Wall-E, painted in shades of yellow and black. His eyes, large and round, are painted in a glossy silver, giving a curious and endearing expression. His body is detailed with scratches and rust, hinting at years of service. The small, claw-like hands are slightly raised, as if reaching for something. The background is a soft sandy beige, with faint hints of scattered stars and dust.',
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/PAH7Xx5AVf1FwtwdN-oDQ.png',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Sketch-Sized-LoRA',
      loraTriggerWord: 'Sketch Sized',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'icon art',
      description: 'Simply, shiny, icon art, reminiscent of modern video game icons, where a single object is the main focus.',
      exampleImagePrompt:
        'An eye-level view of a vibrant orange jack-o-lantern against a backdrop of a deep blue sky. The pumpkins face is angled towards the left, with a black outline around it. The eyes are squinted with white lines, creating a striking contrast with the orange and yellow of the pumpkin. The orange is adorned with black lines, adding a pop of color to the scene.',
      exampleImageUrl:
        'https://cdn-lfs-us-1.hf.co/repos/fb/f3/fbf31ec5a4448c9f9ac304f6c511597cd96eb67a978ba8f347237cae74e692d5/520680fb4add9f1140e4b198135249c7832ee88401ed448207bef183ee6602d6?response-content-disposition=inline%3B+filename*%3DUTF-8%27%276.png%3B+filename%3D%226.png%22%3B&response-content-type=image%2Fpng&Expires=1738236570&Policy=eyJTdGF0ZW1lbnQiOlt7IkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTczODIzNjU3MH19LCJSZXNvdXJjZSI6Imh0dHBzOi8vY2RuLWxmcy11cy0xLmhmLmNvL3JlcG9zL2ZiL2YzL2ZiZjMxZWM1YTQ0NDhjOWY5YWMzMDRmNmM1MTE1OTdjZDk2ZWI2N2E5NzhiYThmMzQ3MjM3Y2FlNzRlNjkyZDUvNTIwNjgwZmI0YWRkOWYxMTQwZTRiMTk4MTM1MjQ5Yzc4MzJlZTg4NDAxZWQ0NDgyMDdiZWYxODNlZTY2MDJkNj9yZXNwb25zZS1jb250ZW50LWRpc3Bvc2l0aW9uPSomcmVzcG9uc2UtY29udGVudC10eXBlPSoifV19&Signature=le2ydHLNtGCVNh6SC-PHMdpNsXHMdYXl2zHwT9Weo6BkFC8mF4gV0PjFz74eI0GWevmVTe1ol5%7EWBecLhyJEnyVKoMyys0ljGs9axy-57gt8QW9eUl0tk2wg73ca-TGmxHrIH5LKdU3GSdoUQVLalFsKov3k5LHRpXmFVgrDuLu0NsiJKbv7Mh4u4Uywo%7Eo3QmpARSoSgFWwebS3636mipoma6MM8g%7ETegTo7VJD34%7E4nGpEfeN0Xs0sPouaKTmJk7zmqHj0M5TbtIJMhfqZ4ENOR1d88PTorFFhOD%7EyCHjCAP0IvR762%7ERmzW4oRP2XKUadkrp8WYriSPCVfPeXvQ__&Key-Pair-Id=K24J24Z295AEI9',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Icon-Art-LoRA',
      loraTriggerWord: 'Icon Kit',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'clay art',
      description: null,
      exampleImagePrompt:
        'Captured from a high-angle perspective on a vibrant yellow backdrop, a medium-sized cartoon monkey is posed in front of the viewer. The monkey is adorned with a brown head, a brown vest, and brown pants. Its arms are draped over its chest, adding a touch of balance to the scene. A yellow bottle with a yellow label is positioned to the left of the monkey, positioned in a way that creates a stark contrast to the monkeys body. The bottles cap, a yellowish-orange color, adds a pop of color to the composition. Three bananas are arranged to the bottom right corner of the frame.',
      exampleImageUrl:
        'https://cdn-lfs-us-1.hf.co/repos/f5/0e/f50ea449283e41b156ba73f0568ef78fd46128d33657dbf32752b17c5c393392/e1f099fc957592c671760fb97c090dbcc1f65afbe4b22a45e2b9ebf6d4b7cefd?response-content-disposition=inline%3B+filename*%3DUTF-8%27%271.png%3B+filename%3D%221.png%22%3B&response-content-type=image%2Fpng&Expires=1738236594&Policy=eyJTdGF0ZW1lbnQiOlt7IkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTczODIzNjU5NH19LCJSZXNvdXJjZSI6Imh0dHBzOi8vY2RuLWxmcy11cy0xLmhmLmNvL3JlcG9zL2Y1LzBlL2Y1MGVhNDQ5MjgzZTQxYjE1NmJhNzNmMDU2OGVmNzhmZDQ2MTI4ZDMzNjU3ZGJmMzI3NTJiMTdjNWMzOTMzOTIvZTFmMDk5ZmM5NTc1OTJjNjcxNzYwZmI5N2MwOTBkYmNjMWY2NWFmYmU0YjIyYTQ1ZTJiOWViZjZkNGI3Y2VmZD9yZXNwb25zZS1jb250ZW50LWRpc3Bvc2l0aW9uPSomcmVzcG9uc2UtY29udGVudC10eXBlPSoifV19&Signature=JOd8NH3JagqYJelImCUnYMQqpXY1KMtMnYns3IbqRloFUGPWrxpid99ol5bUKIFu49ci4EnCA5KwyiL8Ol3lN-T4UBx9MhUng1gk6Wh58GwPegUoSg%7EQBkFhJlGyKe82Mlm7wFyy7UmmYkOL5H6XbaZ%7EwEz1Heooeo4rMcfhvA6WjMM70TWrb2pBMIA2TpxhK4vJFOMvV1BUAcHOMrGOoe%7EN7mll5Q4Ixa9M2ZGPZAK09OXHpAh6Ws1dKsKDNabR-wMpnj5zMEuE%7EeybdOuzeGaJgi1w%7E81YBK8eY4iR4l41BhG0znT65A04NwNaLeKviB50WXQqhla4U2vy55DUxQ__&Key-Pair-Id=K24J24Z295AEI9',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Claymation-XC-LoRA',
      loraTriggerWord: 'Claymation',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'pin art',
      description: 'An embossed metal and enamel style, with a glossy finish, reminiscent of a wearable pin.',
      exampleImagePrompt:
        'An eye-level view of a yellow wall featuring a black silhouette of a city skyline at the bottom. Above the skyline, a bright pink hot air balloon is floating, with tiny blue birds flying around it.',
      exampleImageUrl:
        'https://cdn-lfs-us-1.hf.co/repos/a3/88/a388a577ac48d053024f24752416554c5108acdc44ac6d8b20b8ff64b9ec2fb4/0efbbdbfc9d02e5c9ae69512a6d239ef7de386faf8d14dc91b8b5deeacfd0671?response-content-disposition=inline%3B+filename*%3DUTF-8%27%272.png%3B+filename%3D%222.png%22%3B&response-content-type=image%2Fpng&Expires=1738236679&Policy=eyJTdGF0ZW1lbnQiOlt7IkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTczODIzNjY3OX19LCJSZXNvdXJjZSI6Imh0dHBzOi8vY2RuLWxmcy11cy0xLmhmLmNvL3JlcG9zL2EzLzg4L2EzODhhNTc3YWM0OGQwNTMwMjRmMjQ3NTI0MTY1NTRjNTEwOGFjZGM0NGFjNmQ4YjIwYjhmZjY0YjllYzJmYjQvMGVmYmJkYmZjOWQwMmU1YzlhZTY5NTEyYTZkMjM5ZWY3ZGUzODZmYWY4ZDE0ZGM5MWI4YjVkZWVhY2ZkMDY3MT9yZXNwb25zZS1jb250ZW50LWRpc3Bvc2l0aW9uPSomcmVzcG9uc2UtY29udGVudC10eXBlPSoifV19&Signature=f812n4F68mUcXaEUuil6QffepNQFs0KhbfHaMXaNq7CsUg%7EE4WMllHb3qzTOBogIQcTQNSoZzYVWvFy%7EvFPTbFHGem7jyyZzrImhoMIlcAsJOJNiJ-C0pw01jaG3%7EiCvXqYNfUjl2ddzn0KJv%7En3k4h3wc2JmJv7QJOXnkGXFj961X%7Esm-hAELSIEr9b7X1CiA-o8uNAzOS-7kMv0ZPSHBCfT3DUloTYR4Aa4PvUyLIKcxUp6MN3UpXjSMzpcFpHhcKS1zzm3gBPWKjeNn8odDVbteJGHdloZB9kRPp6esxP4h9cuMRKD92u6LJRZoyQYr67mCPllyCfnmQ9x5Lj%7Eg__&Key-Pair-Id=K24J24Z295AEI9',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Enrich-Art-LoRA',
      loraTriggerWord: 'enrich art',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'mega mix',
      exampleImagePrompt:
        'a small figurine of a man in a space suit stands atop an ice cream cone, holding a flag with a red, white, and blue stripes. The man is dressed in a full suit, a helmet, and black pants, and is holding a gun in his right hand. The ice cream is covered in a thick layer of white ice cream, and the cone is adorned with a waffle-like texture. The background is a deep black, with a starry night sky in the upper right corner.',
      description: 'A mix of entirely unrelated things, creating a surreal image, e.g. an astronaut on a giant scoop of ice cream in space.',
      exampleImageUrl:
        'https://cdn-lfs-us-1.hf.co/repos/21/cf/21cf881dec84ccceaf310274b7cb2b3389dcbe2473e82967c587279297cd6c7a/4fd3d12dbc1d57c568e995ef2591f85db63312de6133649995ad68a76948dc69?response-content-disposition=inline%3B+filename*%3DUTF-8%27%27SB1.png%3B+filename%3D%22SB1.png%22%3B&response-content-type=image%2Fpng&Expires=1738236695&Policy=eyJTdGF0ZW1lbnQiOlt7IkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTczODIzNjY5NX19LCJSZXNvdXJjZSI6Imh0dHBzOi8vY2RuLWxmcy11cy0xLmhmLmNvL3JlcG9zLzIxL2NmLzIxY2Y4ODFkZWM4NGNjY2VhZjMxMDI3NGI3Y2IyYjMzODlkY2JlMjQ3M2U4Mjk2N2M1ODcyNzkyOTdjZDZjN2EvNGZkM2QxMmRiYzFkNTdjNTY4ZTk5NWVmMjU5MWY4NWRiNjMzMTJkZTYxMzM2NDk5OTVhZDY4YTc2OTQ4ZGM2OT9yZXNwb25zZS1jb250ZW50LWRpc3Bvc2l0aW9uPSomcmVzcG9uc2UtY29udGVudC10eXBlPSoifV19&Signature=ZbmRaNydqgiH1MuHiA3WvW-JDGp7uCPU7y-3B55XQEioyhqz3TWFNJQhBQJfDH8eN4d2W24DufBSs%7Ei6pGWSQ7Aw%7Ek7-GtEkzpHsPmEcwF7htN-36oYoCM6divPoqfHNCXK1H4Xae5vta-ImdvdbWuxLd4AVQ9GcTz6Qh5l8i1olmjk7GSI5x9fzKa99gBFUrUq0GjRbhlCc1FituvgCHwNL6BaPchscZ30od8aJw1VJdgTSt-0G5oITYefXnRLuDc7EMGMwFjRJa6rooJVkoVxOHH18e1-DI8hBJNcYDZFnRAR740WX3S5Q%7Eh1LoGhSyP9cViHvbaT2hh4DxtbKfw__&Key-Pair-Id=K24J24Z295AEI9',
      loraUrl: 'https://huggingface.co/strangerzonehf/Flux-Super-Blend-LoRA',
      loraTriggerWord: 'Super Blend',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'modern banner',
      description: 'A minimalist banner with a modern design, with a heavy emphasis on lines and shapes.',
      exampleImagePrompt: null,
      exampleImageUrl: '',
      loraUrl: 'replicate.com/vincanger/modern-banner',
      loraTriggerWord: 'MDRNBNNR',
      basePrompt: null,
      prefix: null,
      suffix: null,
    },
  ];

  await Promise.all(
    templateData.map((data) =>
      prismaClient.imageTemplate.create({
        data: data,
      })
    )
  );
}
