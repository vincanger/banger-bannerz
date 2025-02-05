import { FC, useEffect, useRef, useState, memo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'wasp/client/operations';
import { getGeneratedImageDataById, getImageProxy, getBrandThemeSettings } from 'wasp/client/operations';
import type { GeneratedImageData } from 'wasp/entities';
import { HexColorPicker } from 'react-colorful';

interface ColorButtonProps {
  color: string;
  label: string;
  onChange: (color: string) => void;
  isPickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}

const ColorButton: FC<ColorButtonProps> = ({ color, label, onChange, isPickerOpen, setPickerOpen }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Temporary state to hold the picker's value as the user interacts with it.
  const [tempColor, setTempColor] = useState(color);

  // Update the temporary color while the user is interacting.
  const handleColorChange = (newColor: string) => {
    setTempColor(newColor);
  };

  // Commit the color change only on mouseup.
  const handleMouseUp = () => {
    onChange(tempColor);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };

    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen, setPickerOpen]);

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className='relative inline-block'>
      <button onClick={() => setPickerOpen(!isPickerOpen)} className='flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 hover:border-yellow-500'>
        <div className='w-6 h-6 rounded-full border border-gray-300' style={{ backgroundColor: color }} />
        <span className='text-sm'>{label}</span>
      </button>

      {isPickerOpen && (
        // Attach the onMouseUp event here to ensure the change is only applied after the user releases the mouse.
        <div className='absolute z-50 mt-2 bg-white p-3 rounded-lg shadow-xl'>
          <HexColorPicker color={tempColor} onChange={handleColorChange} />
        </div>
      )}
    </div>
  );
};

const getDarkestColor = (colors: string[]): string => {
  if (!colors || colors.length === 0) return 'rgba(0, 0, 0, 0.85)';

  // Helper to get luminance for a hex color
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  return colors.reduce((darkest, current) => (getLuminance(current) < getLuminance(darkest) ? current : darkest));
};

export const ImageOverlay: FC = () => {
  const { id } = useParams();
  const {
    data: imageData,
    isLoading: imageDataLoading,
    error: imageDataError,
  } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });

  const {
    data: proxiedImageUrl,
    isLoading: proxyLoading,
    error: proxyError,
  } = useQuery(getImageProxy, { url: imageData?.url || '' }, { enabled: !!imageData?.url });

  const {
    data: brandThemeSettings,
    isLoading: brandThemeSettingsLoading,
    error: brandThemeSettingsError,
  } = useQuery(getBrandThemeSettings);

  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [darkOverlayColor, setDarkOverlayColor] = useState('rgba(0, 0, 0, 0.85)');
  const [whiteOverlayColor, setWhiteOverlayColor] = useState('rgba(255, 255, 255, 1)');
  const [textColor, setTextColor] = useState('rgb(0, 0, 0)');
  const [isDarkInitialized, setIsDarkInitialized] = useState(false);

  // New state for managing the individual color picker popups.
  const [darkPickerOpen, setDarkPickerOpen] = useState(false);
  const [whitePickerOpen, setWhitePickerOpen] = useState(false);
  const [textPickerOpen, setTextPickerOpen] = useState(false);

  // NEW: State for background image offset.
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 250, y: 0 });
  // NEW: Drag state management.
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  // NEW: State for zoom level.
  const [zoomLevel, setZoomLevel] = useState(1);

  const processImage = (imageUrl: string, text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        try {
          const targetWidth = 1200;
          const targetHeight = 630;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Determine the base scale to fit the image within the canvas.
          const baseScale = Math.min(targetWidth / img.width, targetHeight / img.height);
          // Adjust the scale using zoomLevel.
          const scale = baseScale * zoomLevel;
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;

          // Use the drag offset values to reposition the background image.
          const x = (targetWidth - scaledWidth) / 2 + imageOffset.x;
          const y = (targetHeight - scaledHeight) / 2 + imageOffset.y;

          // Fill background with white
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Draw the original image with adjusted position and zoom.
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

          // Create dark overlay behind (wider than the white one)
          const overlayWidth = targetWidth / 3; // One third of the image width
          const darkOverlayWidth = overlayWidth + 40;

          ctx.fillStyle = darkOverlayColor;
          ctx.fillRect(0, 0, darkOverlayWidth, targetHeight);

          // White overlay with rounded edges and padding
          const padding = 50;
          const whiteOverlayX = padding;
          const whiteOverlayY = padding;
          const whiteOverlayWidth = darkOverlayWidth + padding; // Slightly wider than before, but with padding
          const whiteOverlayHeight = targetHeight - padding * 2;
          const cornerRadius = 15;

          ctx.fillStyle = whiteOverlayColor;
          ctx.beginPath();
          ctx.roundRect(whiteOverlayX, whiteOverlayY, whiteOverlayWidth, whiteOverlayHeight, cornerRadius);
          ctx.fill();

          // Update text position to account for new padding
          const textPadding = padding + 40;
          const textX = textPadding;
          const maxWidth = whiteOverlayWidth - textPadding;

          ctx.fillStyle = textColor;
          const fontSize = 54;
          ctx.font = `bold ${fontSize}px Noto Sans`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          // Process text into lines
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';

          words.forEach((word) => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          lines.push(currentLine);

          // Draw each line
          const lineHeight = fontSize * 1.25;
          const totalTextHeight = lines.length * lineHeight;
          const startY = (targetHeight - totalTextHeight) / 2 - 40; // Moved up to make room for company info

          lines.forEach((line, index) => {
            ctx.fillText(line, textX, startY + index * lineHeight + lineHeight / 2);
          });

          // Add horizontal line
          const lineY = startY + totalTextHeight + 40;
          ctx.beginPath();
          ctx.strokeStyle = '#E5E7EB'; // Light gray color
          ctx.lineWidth = 2;
          ctx.moveTo(textX, lineY);
          ctx.lineTo(textX + maxWidth - textPadding, lineY);
          ctx.stroke();

          // Add company logo (circle placeholder)
          const logoSize = 24;
          const logoY = lineY + 40;
          ctx.beginPath();
          ctx.arc(textX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = textColor.replace(')', ', 0.75)').replace('rgb', 'rgba'); // 75% opacity version
          ctx.fill();

          // Add company name
          ctx.fillStyle = textColor.replace(')', ', 0.55)').replace('rgb', 'rgba');
          ctx.font = `400 ${fontSize * 0.4}px Noto Sans`;
          ctx.fillText('Company Name', textX + logoSize + 15, logoY + logoSize / 2 + 2);

          const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
          resolve(dataUrl);
        } catch (error: any) {
          reject(new Error(`Error processing image: ${error.message}`));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image. Please ensure the image URL is accessible.'));
      };

      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    const processImageData = async () => {
      if (proxiedImageUrl && imageData) {
        try {
          const processed = await processImage(proxiedImageUrl, imageData.postTopic || 'test');
          setProcessedImageUrl(processed);
        } catch (error) {
          console.error('Failed to process image:', error);
          setProcessedImageUrl(null);
        }
      }
    };

    processImageData();
  }, [proxiedImageUrl, imageData, darkOverlayColor, whiteOverlayColor, textColor, imageOffset, zoomLevel]);

  useEffect(() => {
    if (!isDarkInitialized && !!brandThemeSettings && brandThemeSettings?.colorScheme?.length > 0) {
      const darkest = getDarkestColor(brandThemeSettings.colorScheme);
      setDarkOverlayColor(darkest);
      setIsDarkInitialized(true);
    }
  }, [brandThemeSettings, isDarkInitialized]);

  if (imageDataLoading || proxyLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>Loading image...</p>
      </div>
    );
  }

  if (imageDataError || proxyError) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-red-500'>Error loading image: {imageDataError?.message || proxyError?.message}</p>
      </div>
    );
  }

  if (!imageData || !proxiedImageUrl) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>No image found</p>
      </div>
    );
  }

  const ColorControls = () => (
    <div className='flex gap-3 mb-4'>
      <ColorButton
        color={darkOverlayColor}
        label='Dark Overlay'
        onChange={setDarkOverlayColor}
        isPickerOpen={darkPickerOpen}
        setPickerOpen={setDarkPickerOpen}
      />
      <ColorButton
        color={whiteOverlayColor}
        label='Light Overlay'
        onChange={setWhiteOverlayColor}
        isPickerOpen={whitePickerOpen}
        setPickerOpen={setWhitePickerOpen}
      />
      <ColorButton
        color={textColor}
        label='Text Color'
        onChange={setTextColor}
        isPickerOpen={textPickerOpen}
        setPickerOpen={setTextPickerOpen}
      />
    </div>
  );

  // NEW: Zoom controls for zooming in and out.
  const ZoomControls = () => (
    <div className='flex gap-3 mb-4'>
      <button
        onClick={() => setZoomLevel((prev) => Math.min(prev + 0.1, 3))}
        className='px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100'
      >
        Zoom In
      </button>
      <button
        onClick={() => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5))}
        className='px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100'
      >
        Zoom Out
      </button>
      <span className='self-center'>Zoom: {zoomLevel.toFixed(1)}x</span>
    </div>
  );

  // NEW: Mouse event handlers for dragging the background image.
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setImageOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  return (
    <div className='max-w-4xl mx-auto p-4'>
      <div className='space-y-4'>
        <ColorControls />
        <ZoomControls />

        {/* Processed Image with draggable container */}
        {processedImageUrl && (
          <div
            className={`shadow-lg border border-gray-300 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <img
              src={processedImageUrl}
              alt='Processed image with overlay and text'
              className='w-full h-auto'
              draggable={false}
            />
            <div className='p-4 bg-gray-50 dark:bg-gray-800'>
              <p className='text-sm text-gray-600 dark:text-gray-300'>Processed Image with Overlay</p>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{imageData.userPrompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
