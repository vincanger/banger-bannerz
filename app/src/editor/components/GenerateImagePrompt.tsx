import type { FC } from 'react';
import { Tab } from '@headlessui/react';
import { useEffect, useState } from 'react';
import Editor from '../Editor';
import { generatePromptFromTitle, useQuery, getGeneratedImageDataById, generateBannerFromTemplate, getBrandThemeSettings } from 'wasp/client/operations';
import { ExampleImageUpload } from './ExampleImageUpload';
import { GeneratedImageData, ImageTemplate } from 'wasp/entities';
import { ImageGrid } from './ImageGrid';
import { RecentGeneratedImages } from './RecentGeneratedImages';
import { Modal } from './Modal';
import { useSearchParams, useParams } from 'react-router-dom';
import { FaEdit, FaHandSparkles, FaQuestionCircle } from 'react-icons/fa';
import { cn } from '../../client/cn';
import { set } from 'zod';

export type GenerateImageSource = 'topic' | 'prompt';

export interface GeneratedImageDataWithTemplate extends GeneratedImageData {
  imageTemplate: ImageTemplate | null;
}

export const GenerateImagePrompt: FC = () => {
  const [postTopic, setPostTopic] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageDataWithTemplate[]>([]);
  const [isUsingBrandSettings, setIsUsingBrandSettings] = useState(false);
  const [isUsingBrandColors, setIsUsingBrandColors] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numOutputs, setNumOutputs] = useState(3);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  const [searchParams] = useSearchParams();
  const generateBy = searchParams.get('generateBy') as GenerateImageSource;
  const imageId = searchParams.get('imageId');
  const imageTemplateId = searchParams.get('imageTemplateId');

  const { data: imageData, isLoading, error } = useQuery(getGeneratedImageDataById, { id: imageId ?? '' }, { enabled: !!imageId });
  const { data: brandTheme } = useQuery(getBrandThemeSettings);

  const selectedIndex = generateBy === 'prompt' ? 1 : 0;
  const [selectedTab, setSelectedTab] = useState(selectedIndex);

  useEffect(() => {
    if (generateBy === 'prompt' && imageId) {
      if (imageData && !isLoading) {
        setUserPrompt(imageData.userPrompt || '');
        setIsModalOpen(false);
      }
    } else {
      setUserPrompt('');
    }
    setSelectedTab(generateBy === 'prompt' ? 1 : 0);
  }, [generateBy, imageId, imageData, isLoading]);

  useEffect(() => {
    if (brandTheme) {
      setIsUsingBrandSettings(brandTheme.preferredStyles.length > 0 || brandTheme.mood.length > 0 || brandTheme.lighting.length > 0);
      setIsUsingBrandColors(brandTheme.colorScheme.length > 0);
    }
  }, [brandTheme]);

  const handleGenerateImageFromTitle = async () => {
    try {
      setIsGeneratingImages(true);
      if (!imageTemplateId) {
        throw new Error('Image template is required');
      }

      const generatedPrompts = await generatePromptFromTitle({
        title: postTopic,
        isUsingBrandSettings,
        isUsingBrandColors,
        imageTemplateId,
      });

      let combinedPrompts: string[] = [];

      combinedPrompts = generatedPrompts.promptData.map((data) => data.prompt);
      const generatedBannerArrays = await Promise.all(
        combinedPrompts.map((userPrompt) => {
          return generateBannerFromTemplate({
            imageTemplateId,
            userPrompt,
            numOutputs: 1,
            postTopic,
          });
        })
      );

      setGeneratedImages(generatedBannerArrays.flat());
    } catch (error) {
      console.error('Failed to generate prompt from title:', error);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleGenerateImageFromPrompt = async () => {
    console.log('userPrompt: ', userPrompt);
    if (!imageTemplateId) {
      throw new Error('Image template ID is required');
    }
    try {
      setIsGeneratingImages(true);
      const generatedImages = await generateBannerFromTemplate({
        userPrompt,
        imageTemplateId,
        numOutputs,
      });
      setGeneratedImages(generatedImages);
    } catch (error) {
      console.error('Failed to generate prompts:', error);
    } finally {
      setIsGeneratingImages(false);
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
                    <input
                      type='checkbox'
                      id='brand-colors'
                      checked={isUsingBrandColors}
                      onChange={(e) => setIsUsingBrandColors(e.target.checked)}
                      className='rounded border-gray-300 text-yellow-500 focus:ring-yellow-500'
                    />
                    <label htmlFor='brand-colors' className='ml-2 text-sm text-gray-700 dark:text-gray-200'>
                      Use brand color scheme
                    </label>
                  </div>
                </div>

                {/* Template Use Section */}
                <div></div>

                {/* Generate Button */}
                <LoadingButton
                  onClick={handleGenerateImageFromTitle}
                  disabled={!postTopic}
                  isLoading={isGeneratingImages}
                  text="Generate Images"
                />
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
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800'
                    rows={4}
                    placeholder={'Enter your prompt or choose a recent image above...'}
                  />
                </div>

                {/* Number of Outputs */}
                <div className='flex items-center space-x-2'>
                  <label htmlFor='num-outputs' className='text-sm text-gray-700 dark:text-gray-200'>
                    Number of Images to Generate
                  </label>
                  <input
                    type='number'
                    className='w-16 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                    value={numOutputs}
                    onChange={(e) => setNumOutputs(parseInt(e.target.value))}
                  />
                </div>

                {/* Generate Button */}
                <LoadingButton
                  onClick={handleGenerateImageFromPrompt}
                  disabled={!userPrompt}
                  isLoading={isGeneratingImages}
                  text="Generate Images"
                />
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

interface LoadingButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  text: string;
  className?: string;
}

export const LoadingButton: FC<LoadingButtonProps> = ({ onClick, disabled, isLoading, text, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn('w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center', className)}
    >
      {isLoading ? (
        <>
          <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-white' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
          </svg>
        </>
      ) : (
        text
      )}
    </button>
  );
};