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
      exampleImagePrompt:
        'a cartoon depiction of a man with a beard and mustache is seen eating a hamburger. The mans face is white, with brown hair, and his eyes are closed. His hands are positioned on either side of the hamburger, and he is wearing a light blue long-sleeved shirt. The hamburger is adorned with a variety of toppings, including hamburgers, cheese, and tomatoes. The background is a pale yellow, and the mans arms are positioned in front of him, adding a pop of color to the composition.',
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/LgHJ0QJxTEC-RNAMaystb.png',
      loraUrl: 'https://huggingface.co/strangerzonehf/Flux-Cardboard-Art-LoRA/resolve/main/cardboard%23%20art.safetensors',
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
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/06YuYGWFZOfxsiijacHPw.png',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Pixel-Background-LoRA',
      basePrompt: '',
      prefix: '',
      suffix: '',
      loraTriggerWord: 'Pixel Background',
    },
    {
      name: 'sketchy',
      description: 'A somewhat impressionistic colored pencil sketch.',
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
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/G_QXbbtYT1YFflykerj-m.png',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Icon-Kit-LoRA',
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
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/RQ7BhPk1nGo03cOTCxoKC.png',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Claymation-XC-LoRA',
      loraTriggerWord: 'Claymation',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'pin art',
      description: 'An enamel style, with a glossy finish, reminiscent of a wearable pin.',
      exampleImagePrompt:
        'An eye-level view of a yellow wall featuring a black silhouette of a city skyline at the bottom. Above the skyline, a bright pink hot air balloon is floating, with tiny blue birds flying around it.',
      exampleImageUrl: 'https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/VlxvRBX55rW5mOsw8WDIS.png',
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
      exampleImageUrl: 'https://huggingface.co/strangerzonehf/Flux-Super-Blend-LoRA/resolve/main/images/SB1.png',
      loraUrl: 'huggingface.co/strangerzonehf/Flux-Super-Blend-LoRA',
      loraTriggerWord: 'Super Blend',
      basePrompt: '',
      prefix: '',
      suffix: '',
    },
    {
      name: 'modern banner',
      description: 'A minimalist banner with a modern design, with a heavy emphasis on lines and shapes.',
      exampleImagePrompt: 'representation of a growth chart in minimal fine lines without axes. center the image in the middle and leave the sides empty.',
      exampleImageUrl: 'https://banger-bannerz.s3.us-east-1.amazonaws.com/default-imgs/minimalbanner.png',
      loraUrl: 'vincanger/modern-banner',
      loraTriggerWord: 'MDRNBNNR',
      basePrompt: null,
      prefix: null,
      suffix: null,
    },
    {
      name: 'simple illustration',
      description: 'A minimalist banner with a modern design, with a heavy emphasis on lines and shapes.',
      exampleImagePrompt: 'the London skyline, illustration, thick black lines on a white background',
      exampleImageUrl: 'https://huggingface.co/dvyio/flux-lora-simple-illustration/resolve/main/images/HXUchW9Fp2hp6jDnDIeIT_1f56ae684f7445c8bc75910ec48bfdab.jpg',
      loraUrl: 'huggingface.co/dvyio/flux-lora-simple-illustration',
      loraTriggerWord: 'illustration in the style of SMPL',
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
