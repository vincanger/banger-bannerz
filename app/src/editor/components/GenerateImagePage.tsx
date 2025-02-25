import type { FC } from 'react';
import type { FluxDevAspectRatio } from '../../banner/imageSettings';
import type { GeneratedImageData, ImageTemplate, User } from 'wasp/entities';
import type { VisualElementPromptIdea } from '../../banner/operations';

import { Tab } from '@headlessui/react';
import { useEffect, useState } from 'react';
import Editor from '../Editor';
import {
  getBannerIdeasFromTitle,
  useQuery,
  getGeneratedImageDataById,
  generateBannerFromTemplate,
  getBrandThemeSettings,
  getImageTemplateById,
  getRecentGeneratedImageData,
  generateAndRefinePrompts,
  generateAdditionalVisualElements,
} from 'wasp/client/operations';
import { ImageGrid } from './ImageGrid';
import { Modal } from './Modal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaEdit, FaHandSparkles, FaCheck, FaRainbow, FaExpand, FaImages, FaArrowRight, FaSpinner, FaLightbulb, FaPlus, FaComments, FaCoins } from 'react-icons/fa';
import { cn } from '../../client/cn';
import { Menu } from '@headlessui/react';
import { routes } from 'wasp/client/router';
import { PlatformAspectRatio } from '../../banner/imageSettings';
import { useAuth } from 'wasp/client/auth';
import toast from 'react-hot-toast';
import { AuthUser } from 'wasp/auth';

export type GenerateImageSource = 'topic' | 'prompt';

export interface GeneratedImageDataWithTemplate extends GeneratedImageData {
  imageTemplate: ImageTemplate | null;
}

class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

const CLIENT_ERRORS = {
  NO_USER: 'Please login to generate images',
  NO_IMAGE_TEMPLATE: 'Please choose an image style',
  NO_POST_TOPIC: 'Please enter a post topic',
  NO_CREDITS: 'Please buy more credits to generate images',
} as const;

export const GenerateImagePage: FC = () => {
  const { data: user, isLoading: userLoading, error: userError } = useAuth();

  const [postTopic, setPostTopic] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageDataWithTemplate[]>([]);
  const [isUsingBrandSettings, setIsUsingBrandSettings] = useState(false);
  const [isUsingBrandColors, setIsUsingBrandColors] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numOutputs, setNumOutputs] = useState(3);
  const [postMainIdeas, setPostMainIdeas] = useState('');
  const [visualElementPromptIdeas, setVisualElementPromptIdeas] = useState<VisualElementPromptIdea[]>([]);
  const [isVisualElementsModalOpen, setIsVisualElementsModalOpen] = useState(false);
  const [discardedVisualElements, setDiscardedVisualElements] = useState<VisualElementPromptIdea[]>([]);
  const [isGeneratingAdditionalVisualElements, setIsGeneratingAdditionalVisualElements] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<FluxDevAspectRatio>(PlatformAspectRatio['Twitter Landscape']);
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PlatformAspectRatio>('Twitter Landscape');
  const [isGeneratingImagesButtonText, setIsGeneratingImagesButtonText] = useState('Generating...');

  const [searchParams, setSearchParams] = useSearchParams();
  const generateImageBy = searchParams.get('generateBy') as GenerateImageSource;
  const imageTemplateId = searchParams.get('imageTemplateId');
  const imageId = searchParams.get('imageId');

  const { data: imageData, isLoading, error } = useQuery(getGeneratedImageDataById, { id: imageId ?? '' }, { enabled: !!imageId });
  const { data: brandTheme } = useQuery(getBrandThemeSettings);
  const { data: selectedImageTemplate } = useQuery(getImageTemplateById, { id: imageTemplateId ?? '' }, { enabled: !!imageTemplateId });
  const { data: recentImages } = useQuery(getRecentGeneratedImageData, undefined, { enabled: !isModalOpen });

  const navigate = useNavigate();

  useEffect(() => {
    if (generateImageBy === 'prompt' && imageId) {
      if (imageData && !isLoading) {
        setUserPrompt(imageData.userPrompt || '');
        setIsModalOpen(false);
      }
    }
  }, [generateImageBy, imageId, imageData, isLoading]);

  useEffect(() => {
    if (brandTheme) {
      setIsUsingBrandSettings(!!brandTheme.imageTemplateId || brandTheme.mood.length > 0);
      setIsUsingBrandColors(brandTheme.colorScheme.length > 0);
    }
  }, [brandTheme]);

  useEffect(() => {
    const postTopic = localStorage.getItem('postTopic');
    const userPrompt = localStorage.getItem('userPrompt');
    if (postTopic) {
      setPostTopic(postTopic);
    }
    if (userPrompt) {
      setUserPrompt(userPrompt);
    }
  }, []);

  const handleTabChange = (index: number) => {
    setSearchParams((params) => {
      params.set('generateBy', index === 1 ? 'prompt' : 'topic');
      return params;
    });
  };

  useEffect(() => {
    console.log('visualElementPromptIdeas: ', visualElementPromptIdeas);
    console.log(
      'accepted visualElementPromptIdeas: ',
      visualElementPromptIdeas.filter((el) => el.isChecked)
    );
  }, [visualElementPromptIdeas]);

  useEffect(() => {
    console.log('discardedVisualElements: ', discardedVisualElements);
  }, [discardedVisualElements]);

  const doesUserHaveEnoughCredits = () => {
    if (!user) {
      return false;
    }
    return user.credits >= numOutputs;
  };

  const handleGenerateAndSetVisualElements = async () => {
    try {
      if (!user) {
        throw new ClientError(CLIENT_ERRORS.NO_USER);
      }
      setIsGeneratingImagesButtonText('Brainstorming ideas...');
      setIsGeneratingImages(true);
      if (!imageTemplateId || !selectedImageTemplate?.id) {
        throw new ClientError(CLIENT_ERRORS.NO_IMAGE_TEMPLATE);
      }

      if (!doesUserHaveEnoughCredits()) {
        throw new ClientError(CLIENT_ERRORS.NO_CREDITS);
      }

      const { mainIdeas, visualElements } = await getBannerIdeasFromTitle({
        title: postTopic,
        imageTemplateId: selectedImageTemplate.id,
        numOfVisualElementIdeas: 10,
      });
      setPostMainIdeas(mainIdeas);
      setVisualElementPromptIdeas(visualElements);
      setIsVisualElementsModalOpen(true);
    } catch (error: any) {
      console.log('here');
      if (error instanceof ClientError) {
        toast.error(error.message);
        if (error.message === CLIENT_ERRORS.NO_USER) {
          navigate(routes.LoginRoute.to);
        }
        if (error.message === CLIENT_ERRORS.NO_CREDITS) {
          navigate(routes.PricingPageRoute.to);
        }
      } else {
        toast.error('An unexpected error occurred');
        console.error('Unexpected error:', error);
      }
    } finally {
      setIsGeneratingImages(false);
      setIsGeneratingImagesButtonText('Generate Images');
    }
  };

  const handleGenerateAndSetImages = async () => {
    try {
      setIsGeneratingImages(true);
      setIsGeneratingImagesButtonText('Generating Images...');
      if (!user) {
        throw new ClientError(CLIENT_ERRORS.NO_USER);
      }
      if (!imageTemplateId || !selectedImageTemplate?.id) {
        throw new ClientError(CLIENT_ERRORS.NO_IMAGE_TEMPLATE);
      }

      if (!doesUserHaveEnoughCredits()) {
        throw new ClientError(CLIENT_ERRORS.NO_CREDITS);
      }

      const { mostSuitablePromptsArray } = await generateAndRefinePrompts({
        title: postTopic,
        isUsingBrandSettings,
        isUsingBrandColors,
        imageTemplateId: selectedImageTemplate.id,
        numOutputs,
        mainIdeas: postMainIdeas,
        visualElements: visualElementPromptIdeas.filter((el) => el.isChecked),
      });

      const allGeneratedImages = [];
      for (const prompt of mostSuitablePromptsArray) {
        const generatedImage = await generateBannerFromTemplate({
          imageTemplateId: selectedImageTemplate.id,
          userPrompt: prompt.prompt,
          numOutputs: 1,
          postTopic,
          aspectRatio: selectedAspectRatio,
        });
        allGeneratedImages.push(...generatedImage);
        setGeneratedImages([...allGeneratedImages]); // Update state after each image
      }
    } catch (error: any) {
      if (error instanceof ClientError) {
        toast.error(error.message);
        if (error.message === CLIENT_ERRORS.NO_USER) {
          setTimeout(() => {
            navigate(routes.LoginRoute.to);
          }, 2000);
        }
        if (error.message === CLIENT_ERRORS.NO_CREDITS) {
          setTimeout(() => {
            navigate(routes.PricingPageRoute.to);
          }, 3000);
        }
      } else {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsGeneratingImages(false);
      setIsGeneratingImagesButtonText('Generating Images...');
    }
  };

  const handleGenerateImageFromPrompt = async () => {
    try {
      if (!user) {
        throw new ClientError(CLIENT_ERRORS.NO_USER);
      }
      if (!imageTemplateId || !selectedImageTemplate?.id) {
        throw new ClientError(CLIENT_ERRORS.NO_IMAGE_TEMPLATE);
      }
      if (!doesUserHaveEnoughCredits()) {
        throw new ClientError(CLIENT_ERRORS.NO_CREDITS);
      }
      setIsGeneratingImages(true);
      const generatedImages = await generateBannerFromTemplate({
        userPrompt,
        imageTemplateId: selectedImageTemplate.id,
        numOutputs,
        aspectRatio: selectedAspectRatio,
      });
      setGeneratedImages(generatedImages);
      setSearchParams((params) => {
        params.set('imageId', generatedImages[0].id);
        return params;
      });
      setUserPrompt(generatedImages[0].userPrompt);
    } catch (error) {
      console.error('Failed to generate prompts:', error);
      if (error instanceof ClientError) {
        toast.error(error.message);
        if (error.message === CLIENT_ERRORS.NO_USER) {
          navigate(routes.LoginRoute.to);
        }
        if (error.message === CLIENT_ERRORS.NO_CREDITS) {
          navigate(routes.PricingPageRoute.to);
        }
      } else {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsGeneratingImages(false);
    }
  };

  return (
    <Editor>
      <Tab.Group selectedIndex={generateImageBy === 'prompt' ? 1 : 0} onChange={handleTabChange}>
        <div className='flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'>
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

          <Tab.Panels className='flex flex-col w-full 2xl:w-[65%] mx-auto p-4'>
            <Tab.Panel>
              <div className='space-y-4'>
                {/* Title Input */}
                <div className='group relative'>
                  <input
                    type='text'
                    id='prompt-title'
                    title={`Enter the title or topic of your post, and we'll help generate the prompts for your AI images so that they match your content.`}
                    value={postTopic}
                    onChange={(e) => {
                      localStorage.setItem('postTopic', e.target.value);
                      setPostTopic(e.target.value);
                    }}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                    placeholder='Enter the title or topic of your post'
                  />
                </div>

                {/* Brand Settings Buttons with Dropdowns */}
                <SettingsButtons
                  selectedPlatform={selectedPlatform}
                  setSelectedAspectRatio={setSelectedAspectRatio}
                  setSelectedPlatform={setSelectedPlatform}
                  numOutputs={numOutputs}
                  setNumOutputs={setNumOutputs}
                  selectedImageTemplate={selectedImageTemplate}
                  user={user}
                />

                {/* Generate Button */}
                <LoadingButton
                  onClick={handleGenerateAndSetVisualElements}
                  disabled={postTopic.length === 0 || !selectedImageTemplate}
                  isLoading={isGeneratingImages}
                  text='Generate Images'
                  loadingText={isGeneratingImagesButtonText}
                />
              </div>
            </Tab.Panel>

            <Tab.Panel>
              <div className='space-y-4'>
                {/* Recent Images Button */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className='w-full flex items-center justify-center space-x-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-yellow-500 hover:text-yellow-600 transition-colors duration-200'
                >
                  <FaComments className='h-4 w-4' />
                  <span>Choose prompt from a recently generated image</span>
                </button>

                {/* Prompt Textarea */}
                <div>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => {
                      localStorage.setItem('userPrompt', e.target.value);
                      setUserPrompt(e.target.value);
                    }}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800'
                    rows={4}
                    placeholder={'Enter your prompt or choose a recent image above...'}
                  />
                </div>

                {/* Brand Settings Buttons with Dropdowns */}
                <SettingsButtons
                  user={user}
                  selectedPlatform={selectedPlatform}
                  setSelectedAspectRatio={setSelectedAspectRatio}
                  setSelectedPlatform={setSelectedPlatform}
                  numOutputs={numOutputs}
                  setNumOutputs={setNumOutputs}
                  selectedImageTemplate={selectedImageTemplate}
                />

                {/* Generate Button */}
                <LoadingButton onClick={handleGenerateImageFromPrompt} disabled={!userPrompt} isLoading={isGeneratingImages} text='Generate Images' />
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </div>
      </Tab.Group>

      {/* Results Grid with Generate More Button */}
      {generatedImages.length > 0 && (
        <div className='p-4'>
          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm italic text-gray-600'>
              The images below are temporary and will be <b>deleted after 1 hour</b> if they are not added to your library.
            </p>
          </div>
          <ImageGrid images={generatedImages} />
        </div>
      )}

      {/* Modal for Recently Generated Images */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'Recently Generated Images'}>
        {recentImages && <ImageGrid images={recentImages} />}
      </Modal>

      {/* Modal for Visual Element Prompt Ideas */}
      <Modal isOpen={isVisualElementsModalOpen} onClose={() => setIsVisualElementsModalOpen(false)} title={'Visual Element Ideas'}>
        <div className='flex flex-col gap-4'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='text-md text-gray-800'>
                  Select {numOutputs} {numOutputs === 1 ? 'element' : 'elements'}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!imageTemplateId || !selectedImageTemplate?.id) {
                    throw new Error('Image template is required');
                  }
                  try {
                    setIsGeneratingAdditionalVisualElements(true);
                    const newlyDiscardedVisualElements = visualElementPromptIdeas.filter((el) => !el.isChecked);
                    setDiscardedVisualElements((prev) => [...prev, ...newlyDiscardedVisualElements]);
                    const { visualElements: additionalVisualElements } = await generateAdditionalVisualElements({
                      visualElements: [...visualElementPromptIdeas, ...discardedVisualElements],
                      imageTemplateId: selectedImageTemplate.id,
                      title: postTopic,
                    });
                    const checkedVisualElements = visualElementPromptIdeas.filter((el) => el.isChecked);
                    setVisualElementPromptIdeas([...checkedVisualElements, ...additionalVisualElements]);
                  } catch (error) {
                    console.error('Failed to generate additional visual elements:', error);
                  } finally {
                    setIsGeneratingAdditionalVisualElements(false);
                  }
                }}
                disabled={isGeneratingAdditionalVisualElements}
                className='flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50'
              >
                {isGeneratingAdditionalVisualElements ? <FaSpinner className='h-4 w-4 animate-spin' /> : <FaLightbulb className='h-4 w-4' />}
                <span>Get Different Ideas</span>
              </button>
            </div>

            <div className='flex flex-wrap gap-3 p-4 dark:bg-gray-800 rounded-lg max-h-[600px] overflow-y-auto'>
              <div className='flex flex-col justify-between items-end gap-2 w-[155px] p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-dashed border-yellow-500 dark:border-yellow-500'>
                <div className='group relative'>
                  <input
                    type='text'
                    placeholder='Add element'
                    className=' w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-600 focus:border-yellow-500 focus:outline-none'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        const checkedCount = visualElementPromptIdeas.filter((el) => el.isChecked).length;
                        if (checkedCount >= numOutputs) {
                          toast.error(`You can only select up to ${numOutputs} elements`);
                          return;
                        }
                        const newElement = {
                          visualElement: e.currentTarget.value.trim(),
                          isChecked: true,
                          isUserSubmitted: true,
                        };
                        setVisualElementPromptIdeas((prev) => [...prev, newElement]);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <Tooltip text='Add your own visual element idea to the list.' show={true} />
                </div>
                <button className='flex items-center gap-2 text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'>
                  <FaPlus className='h-4 w-4' />
                </button>
              </div>

              {visualElementPromptIdeas.map((idea) => (
                <div
                  key={idea.visualElement}
                  className={cn(
                    'flex flex-col w-[155px] p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm border cursor-pointer transition-colors relative',
                    idea.isChecked ? 'border-green-500 dark:border-green-500' : 'border-gray-200 dark:border-gray-600 hover:border-yellow-500 dark:hover:border-yellow-500',
                    (isGeneratingAdditionalVisualElements || (!idea.isChecked && visualElementPromptIdeas.filter((el) => el.isChecked).length >= numOutputs)) && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => {
                    if (isGeneratingAdditionalVisualElements) return;

                    const checkedCount = visualElementPromptIdeas.filter((el) => el.isChecked).length;
                    if (!idea.isChecked && checkedCount >= numOutputs) {
                      toast.error(`You can only select up to ${numOutputs} elements`);
                      return;
                    }

                    setVisualElementPromptIdeas(visualElementPromptIdeas.map((el) => (el.visualElement === idea.visualElement ? { ...el, isChecked: !el.isChecked } : el)));
                  }}
                >
                  <span className='font-medium text-sm pr-6'>{idea.visualElement}</span>
                  {idea.isChecked && (
                    <div className='absolute top-2 right-2'>
                      <FaCheck className='h-4 w-4 text-green-500' />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className='flex justify-end'>
            <button
              onClick={() => {
                const checkedCount = visualElementPromptIdeas.filter((el) => el.isChecked).length;
                if (checkedCount < numOutputs) {
                  toast.error(`Please select at least ${numOutputs} visual element ideas`);
                  return;
                }
                handleGenerateAndSetImages();
                setIsVisualElementsModalOpen(false);
              }}
              disabled={visualElementPromptIdeas.filter((el) => el.isChecked).length < 1}
              className={cn('flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors', {
                'opacity-50 cursor-not-allowed': visualElementPromptIdeas.filter((el) => el.isChecked).length < 1,
              })}
            >
              <FaHandSparkles className='h-4 w-4' />
              <span>Continue with Selected Elements</span>
            </button>
          </div>
        </div>
      </Modal>
    </Editor>
  );
};

interface TooltipProps {
  text: string;
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: FC<TooltipProps> = ({ text, show, position = 'bottom' }) => {
  if (!show) return null;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[8px] border-t-black/90 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[8px] border-b-black/90 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[8px] border-l-black/90 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[8px] border-r-black/90 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent',
  };

  return (
    <div className={`absolute ${positionClasses[position]} z-10 hidden group-hover:block w-48`}>
      <div className='relative bg-black/90 rounded-lg shadow-lg p-3'>
        <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
        <p className='text-sm text-white'>{text}</p>
      </div>
    </div>
  );
};

interface LoadingButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  text: string;
  loadingText?: string;
  className?: string;
}

export const LoadingButton: FC<LoadingButtonProps> = ({ onClick, disabled, isLoading, text, loadingText = 'Generating...', className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn('w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2', className)}
    >
      {isLoading ? (
        <>
          <svg className='animate-spin h-5 w-5 text-white' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        text
      )}
    </button>
  );
};

interface SettingsButtonProps {
  brandTheme?: any;
  isUsingBrandSettings: boolean;
  isUsingBrandColors: boolean;
  setIsUsingBrandSettings: (value: boolean) => void;
  setIsUsingBrandColors: (value: boolean) => void;
}

export const BrandIdentityButton: FC<SettingsButtonProps> = ({ brandTheme, isUsingBrandSettings, isUsingBrandColors, setIsUsingBrandSettings, setIsUsingBrandColors }) => {
  const navigate = useNavigate();
  return (
    <div className='relative'>
      <Menu>
        {({ open }) => (
          <div className='relative'>
            <Menu.Button
              className={cn(
                'group flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700',
                (isUsingBrandSettings || isUsingBrandColors) && 'text-yellow-500 border-yellow-500'
              )}
            >
              <FaRainbow className='h-4 w-4' />
              <span className='text-sm'>Brand Identity</span>
              <Tooltip text='Set and use the preferred defaults for your brand identity' show={!open} />
            </Menu.Button>
            <Menu.Items className='absolute z-20 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 focus:outline-none'>
              <div className='p-1'>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center px-3 py-2 text-sm rounded-md', active && 'bg-gray-100 dark:bg-gray-700', !brandTheme && 'opacity-50 cursor-not-allowed')}
                      onClick={() => brandTheme && setIsUsingBrandSettings(!isUsingBrandSettings)}
                      disabled={!brandTheme}
                    >
                      <span>Use Brand Settings</span>
                      {isUsingBrandSettings && brandTheme && <FaCheck className='ml-2 h-4 w-4 text-yellow-500' />}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center px-3 py-2 text-sm rounded-md', active && 'bg-gray-100 dark:bg-gray-700', !brandTheme && 'opacity-50 cursor-not-allowed')}
                      onClick={() => brandTheme && setIsUsingBrandColors(!isUsingBrandColors)}
                      disabled={!brandTheme}
                    >
                      <span>Use Brand Colors</span>
                      {isUsingBrandColors && brandTheme && <FaCheck className='ml-2 h-4 w-4 text-yellow-500' />}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center px-3 py-2 text-sm rounded-md border-t border-gray-200 dark:border-gray-700', active && 'bg-gray-100 dark:bg-gray-700')}
                      onClick={() => navigate(routes.BrandRoute.to)}
                    >
                      <span>Set Brand Identity</span>
                      <FaArrowRight className='ml-2 h-4 w-4' />
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </div>
        )}
      </Menu>
    </div>
  );
};

interface AspectRatioButtonProps {
  selectedPlatform: string;
  setSelectedAspectRatio: (ratio: FluxDevAspectRatio) => void;
  setSelectedPlatform: (platform: string) => void;
}

export const AspectRatioButton: FC<AspectRatioButtonProps> = ({ selectedPlatform, setSelectedAspectRatio, setSelectedPlatform }) => {
  return (
    <div className='relative'>
      <Menu>
        {({ open }) => (
          <div className='relative'>
            <Menu.Button className='group flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'>
              <FaExpand className='h-4 w-4' />
              <span className='text-sm'>Aspect Ratio</span>
              <Tooltip text="Choose which platform you're creating this banner for. Note: you can export the final image for multiple blog formats." show={!open} />
            </Menu.Button>
            <Menu.Items className='absolute z-20 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 focus:outline-none'>
              <div className='p-1'>
                {Object.entries(PlatformAspectRatio).map(([label, ratio]) => (
                  <Menu.Item key={label}>
                    {({ active }) => (
                      <button
                        className={cn('flex w-full justify-between items-center px-3 py-2 text-sm rounded-md', active && 'bg-gray-100 dark:bg-gray-700')}
                        onClick={() => {
                          setSelectedAspectRatio(ratio);
                          setSelectedPlatform(label);
                        }}
                      >
                        <span>{label}</span>
                        {selectedPlatform === label && <FaCheck className='h-4 w-4 text-yellow-500' />}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </div>
        )}
      </Menu>
    </div>
  );
};

interface OutputsButtonProps {
  numOutputs: number;
  setNumOutputs: (num: number) => void;
}

export const OutputsButton: FC<OutputsButtonProps> = ({ numOutputs, setNumOutputs }) => {
  return (
    <div className='relative'>
      <Menu>
        {({ open }) => (
          <div className='relative'>
            <Menu.Button className='group flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'>
              <FaImages className='h-4 w-4' />
              <span className='text-sm'>Outputs: {numOutputs}</span>
              <Tooltip text='Choose how many image variations to generate at once' show={!open} />
            </Menu.Button>
            <Menu.Items className='absolute z-20 mt-2 w-40 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 focus:outline-none'>
              <div className='p-1'>
                {[1, 2, 3, 4].map((number) => (
                  <Menu.Item key={number}>
                    {({ active }) => (
                      <button className={cn('flex w-full justify-between items-center px-3 py-2 text-sm rounded-md', active && 'bg-gray-100 dark:bg-gray-700')} onClick={() => setNumOutputs(number)}>
                        <span>
                          {number} {number === 1 ? 'Image' : 'Images'}
                        </span>
                        {numOutputs === number && <FaCheck className='h-4 w-4 text-yellow-500' />}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </div>
        )}
      </Menu>
    </div>
  );
};

interface SettingsButtonsProps {
  user: AuthUser | null | undefined;
  selectedPlatform: string;
  setSelectedAspectRatio: (ratio: FluxDevAspectRatio) => void;
  setSelectedPlatform: (platform: string) => void;
  numOutputs: number;
  setNumOutputs: (num: number) => void;
  selectedImageTemplate: any;
}

export const SettingsButtons: FC<SettingsButtonsProps> = ({ user, selectedPlatform, setSelectedAspectRatio, setSelectedPlatform, numOutputs, setNumOutputs }) => (
  <div className='flex items-center justify-between gap-2'>
    <div className='flex items-center gap-2'>
      <AspectRatioButton selectedPlatform={selectedPlatform} setSelectedAspectRatio={setSelectedAspectRatio} setSelectedPlatform={setSelectedPlatform} />
      <OutputsButton numOutputs={numOutputs} setNumOutputs={setNumOutputs} />
    </div>
    {user && user.credits !== undefined && (
      <div className='flex items-center gap-2 px-3 py-2 rounded-md'>
        <FaCoins size='1.1rem' />
        <span className='text-sm dark:text-white whitespace-nowrap'>Credits: {user.credits} </span>
      </div>
    )}
  </div>
);
