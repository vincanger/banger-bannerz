import type { FC } from 'react';
import { Tab } from '@headlessui/react';
import { useEffect, useState } from 'react';
import Editor from '../Editor';
import { generatePromptFromTitle, generateBanner, useQuery, getGeneratedImageDataById, getBrandTheme, getBrandThemeSettings } from 'wasp/client/operations';
import { ExampleImageUpload } from './ExampleImageUpload';
import { GeneratedImageData } from 'wasp/entities';
import { ImageGrid } from './ImageGrid';
import { RecentGeneratedImages } from './RecentGeneratedImages';
import { Modal } from './Modal';
import { useSearchParams } from 'react-router-dom';
import { FaEdit, FaHandSparkles, FaQuestionCircle } from 'react-icons/fa';
import { cn } from '../../client/cn';

export type GenerateImageSource = 'topic' | 'prompt';

export const GenerateImagePrompt: FC = () => {
  const [postTopic, setPostTopic] = useState('');
  const [exampleImagePrompt, setExampleImagePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);
  const [isUsingBrandSettings, setIsUsingBrandSettings] = useState(false);
  const [isUsingBrandColors, setIsUsingBrandColors] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const generateBy = searchParams.get('generateBy') as GenerateImageSource;
  const imageId = searchParams.get('imageId');

  const { data: imageData, isLoading, error } = useQuery(getGeneratedImageDataById, { id: imageId ?? '' }, { enabled: !!imageId });
  const { data: brandTheme } = useQuery(getBrandThemeSettings);

  const selectedIndex = generateBy === 'prompt' ? 1 : 0;
  const [selectedTab, setSelectedTab] = useState(selectedIndex);

  useEffect(() => {
    if (generateBy === 'prompt' && imageId) {
      if (imageData && !isLoading) {
        setCustomPrompt(imageData.prompt);
        setIsModalOpen(false);
      }
    } else {
      setCustomPrompt('');
    }
    setSelectedTab(generateBy === 'prompt' ? 1 : 0);
  }, [generateBy, imageId, imageData, isLoading]);

  useEffect(() => {
    if (brandTheme) {
      setIsUsingBrandSettings(brandTheme.preferredStyles.length > 0 || brandTheme.mood.length > 0 || brandTheme.lighting.length > 0);
      setIsUsingBrandColors(brandTheme.colorScheme.length > 0);
    }
  }, [brandTheme]);

  const handleGenerateImageFromTopic = async () => {
    try {
      const generatedPrompts = await generatePromptFromTitle({
        title: postTopic,
        isUsingBrandSettings,
      });


      const generatedBanners = await generateBanner({
        centerInfoPrompts: generatedPrompts.promptData.map((data) => data.prompt),
        useBrandSettings: isUsingBrandSettings,
        useBrandColors: isUsingBrandColors,
      });

      setGeneratedImages(generatedBanners);
    } catch (error) {
      console.error('Failed to generate prompt from title:', error);
    }
  };

  const handleGenerateImageFromPrompt = async () => {
    try {
      // TODO: implement a generate image from pure prompt operation
      // const generatedImages =
      // setGeneratedImages([generatedImages]);
    } catch (error) {
      console.error('Failed to generate image from prompt:', error);
    }
  };

  return (
    <Editor>
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <div className='rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'>
          <Tab.List className='flex rounded-t-lg'>
            <Tab
              className={({ selected }) =>
                cn('w-full px-4 py-2 text-sm font-medium leading-5 focus:outline-none flex items-center justify-center gap-2 border-b-2', {
                  'text-yellow-600 dark:text-yellow-500 border-yellow-600 dark:border-yellow-500': selected,
                  'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ': !selected,
                })
              }
            >
              <FaEdit className='h-4 w-4' />
              By Topic
            </Tab>
            <Tab
              className={({ selected }) =>
                cn('w-full px-4 py-2 text-sm font-medium leading-5 focus:outline-none flex items-center justify-center gap-2 border-b-2', {
                  'text-yellow-600 dark:text-yellow-500 border-yellow-600 dark:border-yellow-500': selected,
                  'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ': !selected,
                })
              }
            >
              <FaHandSparkles className='h-4 w-4' />
              From Prompt
            </Tab>
          </Tab.List>

          <Tab.Panels className='p-4'>
            <Tab.Panel>
              <div className='space-y-4'>
                {/* Instruction Tooltip */}
                <div className='flex justify-end'>
                  <div className='relative group'>
                    <FaQuestionCircle className='relative group h-5 w-5 text-gray-400 hover:text-yellow-500 cursor-help transition-colors duration-200' />
                    <div className='absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg'>
                      <p className='text-sm text-gray-600 dark:text-gray-300'>
                        Enter the title or topic of your accompanying post, and we'll generate the prompts for your AI images so that they match your content. Enable brand settings to maintain your visual identity, or
                        even upload an example image to guide the style.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <input
                    type='text'
                    id='prompt-title'
                    value={postTopic}
                    onChange={(e) => setPostTopic(e.target.value)}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                    placeholder='Enter the title or topic of your post'
                  />
                </div>

                {/* Brand Settings Checkboxes */}
                <div className='space-y-2'>
                  <div className='flex items-center'>
                    <input
                      type='checkbox'
                      id='brand-settings'
                      checked={isUsingBrandSettings}
                      onChange={(e) => setIsUsingBrandSettings(e.target.checked)}
                      className='rounded border-gray-300 text-yellow-500 focus:ring-yellow-500'
                    />
                    <label htmlFor='brand-settings' className='ml-2 text-sm text-gray-700 dark:text-gray-200'>
                      Use brand image settings
                    </label>
                  </div>
                  <div className='flex items-center'>
                    <input type='checkbox' id='brand-colors' checked={isUsingBrandColors} onChange={(e) => setIsUsingBrandColors(e.target.checked)} className='rounded border-gray-300 text-yellow-500 focus:ring-yellow-500' />
                    <label htmlFor='brand-colors' className='ml-2 text-sm text-gray-700 dark:text-gray-200'>
                      Use brand color scheme
                    </label>
                  </div>
                </div>

                {/* Example Image Section */}
                <details className='mb-4'>
                  <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'>Use an example image as a guide?</summary>
                  <div className='mt-2'>
                    <ExampleImageUpload setExampleImagePrompt={setExampleImagePrompt} />
                  </div>
                </details>

                {/* Generate Button */}
                <button onClick={handleGenerateImageFromTopic} disabled={!postTopic} className='w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'>
                  Generate Images
                </button>
              </div>
            </Tab.Panel>

            <Tab.Panel>
              <div className='space-y-4'>
                {/* Instruction Tooltip */}
                <div className='flex justify-end'>
                  <div className='relative group'>
                    <FaQuestionCircle className='h-5 w-5 text-gray-400 hover:text-yellow-500 cursor-help transition-colors duration-200' />
                    <div className='absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg'>
                      <p className='text-sm text-gray-600 dark:text-gray-300'>
                        Have a specific vision in mind? Write your own custom prompt or choose a prompt from one of your recently generated images to create exactly what you're looking for.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Images Button */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className='w-full flex items-center justify-center space-x-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-yellow-500 hover:text-yellow-600 transition-colors duration-200'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                    <path fillRule='evenodd' d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' clipRule='evenodd' />
                  </svg>
                  <span>Choose a prompt from recently generated images</span>
                </button>

                {/* Prompt Textarea */}
                <div>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800'
                    rows={4}
                    placeholder={'Enter your prompt or choose a recent image above...'}
                  />
                </div>

                {/* Generate Button */}
                <button disabled={!customPrompt} onClick={handleGenerateImageFromPrompt} className='w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'>
                  Generate Images
                </button>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </div>
      </Tab.Group>

      {/* Results Grid */}
      {generatedImages.length > 0 && <ImageGrid images={generatedImages} />}

      {/* Modal for Recently Generated Images */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'Recently Generated Images'}>
        <RecentGeneratedImages />
      </Modal>
    </Editor>
  );
};
