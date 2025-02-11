import type { FC } from 'react';
import type { FluxDevAspectRatio } from '../../banner/imageSettings';

import { Tab } from '@headlessui/react';
import { useEffect, useState } from 'react';
import Editor from '../Editor';
import { generatePromptFromTitle, useQuery, getGeneratedImageDataById, generateBannerFromTemplate, getBrandThemeSettings, getImageTemplateById, getRecentGeneratedImageData } from 'wasp/client/operations';
import { GeneratedImageData, ImageTemplate } from 'wasp/entities';
import { ImageGrid } from './ImageGrid';
import { Modal } from './Modal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaEdit, FaHandSparkles, FaQuestionCircle, FaPalette, FaCheck, FaRainbow, FaExpand, FaImages, FaArrowRight } from 'react-icons/fa';
import { cn } from '../../client/cn';
import { Menu } from '@headlessui/react';
import { routes } from 'wasp/client/router';
import { PlatformAspectRatio } from '../../banner/imageSettings';
import { useAuth } from 'wasp/client/auth';
import toast from 'react-hot-toast';

export type GenerateImageSource = 'topic' | 'prompt';

export interface GeneratedImageDataWithTemplate extends GeneratedImageData {
  imageTemplate: ImageTemplate | null;
}

export const GenerateImagePrompt: FC = () => {
  const { data: user, isLoading: userLoading, error: userError } = useAuth();

  const [postTopic, setPostTopic] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageDataWithTemplate[]>([]);
  const [isUsingBrandSettings, setIsUsingBrandSettings] = useState(false);
  const [isUsingBrandColors, setIsUsingBrandColors] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numOutputs, setNumOutputs] = useState(3);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<FluxDevAspectRatio>(PlatformAspectRatio['Twitter Landscape']);
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PlatformAspectRatio>('Twitter Landscape');

  const [searchParams, setSearchParams] = useSearchParams();
  const generateImageBy = searchParams.get('generateBy') as GenerateImageSource;
  const imageTemplateId = searchParams.get('imageTemplateId');
  const imageId = searchParams.get('imageId');

  const { data: imageData, isLoading, error } = useQuery(getGeneratedImageDataById, { id: imageId ?? '' }, { enabled: !!imageId });
  const { data: brandTheme } = useQuery(getBrandThemeSettings);
  const { data: selectedImageTemplate } = useQuery(getImageTemplateById, { id: imageTemplateId ?? '' }, { enabled: !!imageTemplateId });
  const { data: recentImages } = useQuery(getRecentGeneratedImageData, undefined, { enabled: !isModalOpen });

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

  const handleTabChange = (index: number) => {
    setSearchParams((params) => {
      params.set('generateBy', index === 1 ? 'prompt' : 'topic');
      return params;
    });
  };

  const handleGenerateImageFromTitle = async () => {
    if (!user) toast.error('Please login to generate images');
    try {
      setIsGeneratingImages(true);
      if (!imageTemplateId || !selectedImageTemplate?.id) {
        throw new Error('Image template is required');
      }

      const { promptArray } = await generatePromptFromTitle({
        title: postTopic,
        isUsingBrandSettings,
        isUsingBrandColors,
        imageTemplateId: selectedImageTemplate.id,
        numOutputs,
      });

      const allGeneratedImages = [];
      for (const prompt of promptArray) {
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
    } catch (error) {
      console.error('Failed to generate prompt from title:', error);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleGenerateImageFromPrompt = async () => {
    if (!user) toast.error('Please login to generate images');
    if (!imageTemplateId || !selectedImageTemplate?.id) {
      throw new Error('Image template ID is required');
    }
    try {
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
    } finally {
      setIsGeneratingImages(false);
    }
  };

  return (
    <Editor>
      <Tab.Group selectedIndex={generateImageBy === 'prompt' ? 1 : 0} onChange={handleTabChange}>
        <div className='flex flex-col 2xl:w-[65%] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'>
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
                    <FaQuestionCircle className='h-5 w-5 text-gray-400 hover:text-yellow-500 cursor-help transition-colors duration-200' />
                    <div className='absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-4 bg-black/90 rounded-lg shadow-lg'>
                      <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0'></div>
                      <p className='text-sm text-white'>
                        Enter the title or topic of your accompanying post, and we'll generate the prompts for your AI images so that they match your content. Enable brand settings to maintain your visual identity and
                        guide the style.
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

                {/* Brand Settings Buttons with Dropdowns */}
                <SettingsButtons
                  brandTheme={brandTheme}
                  isUsingBrandSettings={isUsingBrandSettings}
                  isUsingBrandColors={isUsingBrandColors}
                  setIsUsingBrandSettings={setIsUsingBrandSettings}
                  setIsUsingBrandColors={setIsUsingBrandColors}
                  selectedPlatform={selectedPlatform}
                  setSelectedAspectRatio={setSelectedAspectRatio}
                  setSelectedPlatform={setSelectedPlatform}
                  numOutputs={numOutputs}
                  setNumOutputs={setNumOutputs}
                  selectedImageTemplate={selectedImageTemplate}
                />

                {/* Template Use Section */}
                <div></div>

                {/* Generate Button */}
                <LoadingButton onClick={handleGenerateImageFromTitle} disabled={!postTopic || !imageTemplateId} isLoading={isGeneratingImages} text='Generate Images' />
              </div>
            </Tab.Panel>

            <Tab.Panel>
              <div className='space-y-4'>
                {/* Instruction Tooltip */}
                <div className='flex justify-end'>
                  <div className='relative group'>
                    <FaQuestionCircle className='h-5 w-5 text-gray-400 hover:text-yellow-500 cursor-help transition-colors duration-200' />
                    <div className='absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-4 bg-black/90 rounded-lg shadow-lg'>
                      <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0'></div>
                      <p className='text-sm text-white'>Write your own custom prompt or choose a prompt from one of your recently generated images to create exactly what you're looking for.</p>
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

                {/* Brand Settings Buttons with Dropdowns */}
                <SettingsButtons
                  brandTheme={brandTheme}
                  isUsingBrandSettings={isUsingBrandSettings}
                  isUsingBrandColors={isUsingBrandColors}
                  setIsUsingBrandSettings={setIsUsingBrandSettings}
                  setIsUsingBrandColors={setIsUsingBrandColors}
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

      {/* Results Grid */}
      {generatedImages.length > 0 && (
        <div className='p-4'>
          <p className='text-sm italic text-gray-600 mb-4'>
            The generated images below are temporary and will be <b>deleted after 24 hours</b> if they are not saved.
          </p>
          <ImageGrid images={generatedImages} />
        </div>
      )}

      {/* Modal for Recently Generated Images */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'Recently Generated Images'}>
        {recentImages && <ImageGrid images={recentImages} />}
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

interface SettingsButtonProps {
  brandTheme?: any;
  isUsingBrandSettings: boolean;
  isUsingBrandColors: boolean;
  setIsUsingBrandSettings: (value: boolean) => void;
  setIsUsingBrandColors: (value: boolean) => void;
}

const BrandIdentityButton: FC<SettingsButtonProps> = ({ brandTheme, isUsingBrandSettings, isUsingBrandColors, setIsUsingBrandSettings, setIsUsingBrandColors }) => {
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
              {!open && (
                <div className='absolute top-full left-1/2 -translate-x-1/2 mt-4 z-10 hidden group-hover:block w-48 p-3 bg-black/90 rounded-lg shadow-lg'>
                  <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-black/90'></div>
                  <p className='text-sm text-white'>Set and use the preferred defaults for your brand identity</p>
                </div>
              )}
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
              {!open && (
                <div className='absolute top-full left-1/2 -translate-x-1/2 mt-4 z-10 hidden group-hover:block w-52 p-3 bg-black/90 rounded-lg shadow-lg'>
                  <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-black/90'></div>
                  <p className='text-sm text-white'>Choose which platform you're creating this banner for. Note: you can export the final image for multiple blog formats.</p>
                </div>
              )}
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
              {!open && (
                <div className='absolute top-full left-1/2 -translate-x-1/2 mt-4 z-10 hidden group-hover:block w-48 p-3 bg-black/90 rounded-lg shadow-lg'>
                  <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-black/90'></div>
                  <p className='text-sm text-white'>Choose how many image variations to generate at once</p>
                </div>
              )}
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

interface StyleButtonProps {
  selectedImageTemplate: any;
}

export const StyleButton: FC<StyleButtonProps> = ({ selectedImageTemplate }) => (
  <div className='relative'>
    <button className='group flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-500'>
      <FaPalette className='h-4 w-4' />
      <span className='text-sm'>Style: {selectedImageTemplate?.name || 'None'}</span>
      <div className='absolute top-full left-1/2 -translate-x-1/2 mt-4 z-10 hidden group-hover:block w-48 p-3 bg-black/90 rounded-lg shadow-lg'>
        <div className='absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-black/90'></div>
        <p className='text-sm text-white'>{selectedImageTemplate ? "This is the image style you'd like your banner to have" : 'Please choose an image style on the left sidebar'}</p>
      </div>
    </button>
  </div>
);

interface SettingsButtonsProps {
  brandTheme?: any;
  isUsingBrandSettings: boolean;
  isUsingBrandColors: boolean;
  setIsUsingBrandSettings: (value: boolean) => void;
  setIsUsingBrandColors: (value: boolean) => void;
  selectedPlatform: string;
  setSelectedAspectRatio: (ratio: FluxDevAspectRatio) => void;
  setSelectedPlatform: (platform: string) => void;
  numOutputs: number;
  setNumOutputs: (num: number) => void;
  selectedImageTemplate: any;
}

export const SettingsButtons: FC<SettingsButtonsProps> = ({
  brandTheme,
  isUsingBrandSettings,
  isUsingBrandColors,
  setIsUsingBrandSettings,
  setIsUsingBrandColors,
  selectedPlatform,
  setSelectedAspectRatio,
  setSelectedPlatform,
  numOutputs,
  setNumOutputs,
  selectedImageTemplate,
}) => (
  <div className='flex items-center justify-between gap-2'>
    <div className='flex items-center gap-2'>
      <BrandIdentityButton
        brandTheme={brandTheme}
        isUsingBrandSettings={isUsingBrandSettings}
        isUsingBrandColors={isUsingBrandColors}
        setIsUsingBrandSettings={setIsUsingBrandSettings}
        setIsUsingBrandColors={setIsUsingBrandColors}
      />
      <AspectRatioButton selectedPlatform={selectedPlatform} setSelectedAspectRatio={setSelectedAspectRatio} setSelectedPlatform={setSelectedPlatform} />
      <OutputsButton numOutputs={numOutputs} setNumOutputs={setNumOutputs} />
    </div>
    <StyleButton selectedImageTemplate={selectedImageTemplate} />
  </div>
);
