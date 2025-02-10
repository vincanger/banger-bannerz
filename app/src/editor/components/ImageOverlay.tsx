import { FC, useEffect, useRef, useState, memo, act } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'wasp/client/operations';
import { getGeneratedImageDataById, getImageProxy, getBrandThemeSettings } from 'wasp/client/operations';
import type { GeneratedImageData, BrandTheme } from 'wasp/entities';
import { HexColorPicker } from 'react-colorful';
import * as fabric from 'fabric';
import { FabricImage, FabricObject } from 'fabric';
import { FaPlus, FaMinus, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import debounce from 'lodash/debounce';
import { cn } from '../../client/cn';

interface ColorButtonProps {
  color: string;
  label: string;
  onChange: (color: string) => void;
  isPickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}

const getDarkestColor = (colors: string[]): string => {
  if (!colors || colors.length === 0) return '#000000D9';

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

// Add available fonts
const AVAILABLE_FONTS = ['Noto Sans', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Roboto', 'Open Sans'];

interface SelectedObject {
  type: 'darkOverlay' | 'whiteOverlay' | 'text' | 'line' | 'logo' | 'companyName' | 'image' | 'group' | null;
  object: fabric.Object | null;
}

// Add these constants at the top of the file, after imports
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 630;

// Add interface for custom fabric object properties
interface CustomFabricObject extends fabric.Object {
  name?: string;
}

export const ImageOverlay: FC = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<SelectedObject>({ type: null, object: null });
  const [selectedFillColor, setSelectedFillColor] = useState('');

  const { data: imageData, isLoading: imageDataLoading, error: imageDataError } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });

  const { data: proxiedImageUrl, isLoading: proxyLoading, error: proxyError } = useQuery(getImageProxy, { url: imageData?.url || '' }, { enabled: !!imageData?.url });

  const { data: brandThemeSettings, isLoading: brandThemeSettingsLoading, error: brandThemeSettingsError } = 
    useQuery(getBrandThemeSettings);

  const [darkOverlayColor, setDarkOverlayColor] = useState('#000000D9');
  const [whiteOverlayColor, setWhiteOverlayColor] = useState('#FFFFFF');
  const [isDarkInitialized, setIsDarkInitialized] = useState(false);

  const saveCanvasState = (fabricCanvas: fabric.Canvas) => {
    // Use toObject to include custom properties like 'name'
    const jsonState = fabricCanvas.toObject(['name']);
    setHistory((prev) => [...prev, jsonState]);
  };

  const clearCanvas = (fabricCanvas: fabric.Canvas) => {
    fabricCanvas.remove(...fabricCanvas.getObjects());
  };

  const handleUndo = () => {
    if (!canvas || history.length <= 1) return;

    clearCanvas(canvas);
    const newHistory = [...history];
    newHistory.pop();
    setHistory(newHistory);

    canvas.off('object:added');
    const lastState = newHistory[newHistory.length - 1] as any;
    fabric.util.enlivenObjects(lastState.objects).then((objs) => {
      objs.forEach((obj: any) => canvas.add(obj));
      canvas.on('object:added', () => saveCanvasState(canvas));
      canvas.renderAll();
    });
  };

  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Check if Command (Mac) or Control (Windows/Linux) is pressed
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault(); // Prevent browser's default undo
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [canvas, history]); // Add dependencies that handleUndo uses

  useEffect(() => {
    if (!canvasRef.current || !proxiedImageUrl || !imageData) return;
    if (canvas) return; // Don't reinitialize the canvas if it already exists

    // Calculate container width and initial scale
    const containerWidth = canvasRef.current.parentElement?.clientWidth || TARGET_WIDTH;
    const initialScale = Math.min(1, containerWidth / TARGET_WIDTH);

    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      backgroundColor: 'white',
      preserveObjectStacking: true,
      devicePixelRatio: 1,
      selection: true
    });

    // Add selection and event listeners
    fabricCanvas.on('selection:created', handleObjectSelection);
    fabricCanvas.on('selection:updated', handleObjectSelection);

    const handleKeyDown = (e: KeyboardEvent) => {
      const MOVE_DISTANCE = e.shiftKey ? 10 : 1;
      const activeObject = fabricCanvas.getActiveObject();
      if (!activeObject) return;
      switch (e.key) {
        case 'ArrowLeft':
          activeObject.left! -= MOVE_DISTANCE / initialScale;
          break;
        case 'ArrowRight':
          activeObject.left! += MOVE_DISTANCE / initialScale;
          break;
        case 'ArrowUp':
          activeObject.top! -= MOVE_DISTANCE / initialScale;
          break;
        case 'ArrowDown':
          activeObject.top! += MOVE_DISTANCE / initialScale;
          break;
        default:
          return;
      }
      activeObject.setCoords();
      fabricCanvas.renderAll();
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);

    // Set display size and initial zoom
    fabricCanvas.setWidth(TARGET_WIDTH * initialScale);
    fabricCanvas.setHeight(TARGET_HEIGHT * initialScale);
    fabricCanvas.setZoom(initialScale);
    (fabricCanvas as any).initialScale = initialScale;

    // Mouse event handlers
    let isDragging = false;

    const originalFindTarget = fabricCanvas.findTarget.bind(fabricCanvas);
    fabricCanvas.findTarget = function(e: fabric.TPointerEvent) {
      if (isDragging) {
        return undefined;
      }
      return originalFindTarget(e);
    };

    setCanvas(fabricCanvas);

    FabricImage.fromObject({ type: 'image', src: proxiedImageUrl }).then((fabricImageFromUrl) => {
      const scale = Math.min(TARGET_WIDTH / fabricImageFromUrl.width!, TARGET_HEIGHT / fabricImageFromUrl.height!);
      fabricImageFromUrl.scaleX = scale;
      fabricImageFromUrl.scaleY = scale;
      fabricImageFromUrl.originX = 'center';
      fabricImageFromUrl.originY = 'center';
      const overlayWidth = TARGET_WIDTH / 3 + 40;
      fabricImageFromUrl.left = TARGET_WIDTH / 2 + overlayWidth / 2;
      fabricImageFromUrl.top = TARGET_HEIGHT / 2;
      fabricImageFromUrl.selectable = true;
      fabricImageFromUrl.hasControls = true;
      fabricImageFromUrl.setCoords();

      const background = new fabric.Rect({
        left: 0,
        top: 0,
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        fill: 'white',
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(background);
      fabricCanvas.add(fabricImageFromUrl);

      const darkOverlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: overlayWidth,
        height: TARGET_HEIGHT,
        fill: darkOverlayColor,
        selectable: true,
        hasControls: true,
        name: 'darkOverlay',
      });
      fabricCanvas.add(darkOverlay);

      const padding = 50;
      const whiteOverlay = new fabric.Rect({
        left: padding,
        top: padding,
        width: overlayWidth + padding,
        height: TARGET_HEIGHT - padding * 2,
        fill: whiteOverlayColor,
        rx: 15,
        ry: 15,
        selectable: true,
        hasControls: true,
        name: 'whiteOverlay',
      });
      fabricCanvas.add(whiteOverlay);

      // Add text
      const textColor = '#000000';
      const fontSize = 54;
      const fontFamily = 'Noto Sans';
      const text = imageData.postTopic || 'Add your text here';
      const textPadding = padding + 40;
      const maxWidth = overlayWidth + padding - textPadding;

      // Process text into lines
      const words = text.split(' ');
      let lines: string[] = [];
      let currentLine = '';
      const ctx = fabricCanvas.getContext();

      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        ctx.font = `bold ${fontSize}px Noto Sans`;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      lines.push(currentLine);

      // Create a single text block with line breaks
      const textContent = lines.join('\n');
      const textBlock = new fabric.Textbox(textContent, {
        left: textPadding,
        top: (TARGET_HEIGHT - lines.length * fontSize * 1.25) / 2 - 40,
        width: maxWidth,
        fill: textColor,
        fontSize: fontSize,
        fontFamily: fontFamily,
        fontWeight: 'bold',
        lineHeight: 1.25,
        selectable: true,
        hasControls: true,
        splitByGrapheme: false,
        lockScalingX: true,
      });
      fabricCanvas.add(textBlock);

      // Add horizontal line below the text block
      const lineY = textBlock.top! + textBlock.height! + 40;
      const horizontalLine = new fabric.Line([textPadding, lineY, textPadding + maxWidth - textPadding, lineY], {
        stroke: '#E5E7EB',
        strokeWidth: 2,
        selectable: true,
        hasControls: true,
      });
      fabricCanvas.add(horizontalLine);

      // Add company logo - either circle or image
      const logoY = lineY + 40;
      const desiredLogoSize = 44;

      if (brandThemeSettings?.logoUrl) {
        console.log('Brand theme settings:', brandThemeSettings);
        const imgElement = new Image();
        imgElement.src = brandThemeSettings.logoUrl;
        imgElement.onload = () => {
          const fabricImage = new fabric.Image(imgElement);
          // scale the image down to the desired size
          const scale = desiredLogoSize / Math.max(fabricImage.width!, fabricImage.height!);
          fabricImage.scaleX = scale;
          fabricImage.scaleY = scale;
          
          const clipPath = new fabric.Circle({
            radius: imgElement.width / 2,
            originX: 'center',
            originY: 'center',
          });

          fabricImage.set({
            left: textPadding,
            top: logoY,
            clipPath: clipPath,
            selectable: true,
            hasControls: true,
            name: 'logo',
          });

          fabricCanvas.add(fabricImage);
          fabricCanvas.renderAll();
          saveCanvasState(fabricCanvas);
        };
      } else {
        const logo = new fabric.Circle({
          left: textPadding,
          top: logoY,
          radius: desiredLogoSize / 2,
          fill: textColor,
          selectable: true,
          hasControls: true,
          name: 'logo',
        });
        fabricCanvas.add(logo);
      }

      // Add company name
      const companyNameText = 'Company or Author Name'; // TODO: imageData.companyName ||
      const companyNameFontSize = fontSize * 0.4;
      const companyNameWidth = companyNameText.length * companyNameFontSize;
      const companyName = new fabric.Textbox(companyNameText, {
        left: textPadding + desiredLogoSize + 15,
        // center the company name vertically
        top: logoY + (desiredLogoSize - companyNameFontSize) / 2,
        width: companyNameWidth,
        fill: textColor,
        fontSize: companyNameFontSize,
        fontFamily: 'Noto Sans',
        selectable: true,
        hasControls: true,
      });
      fabricCanvas.add(companyName);

      // After all objects are added, save initial state and add listeners for modifications:
      saveCanvasState(fabricCanvas);
      fabricCanvas.on('object:modified', () => saveCanvasState(fabricCanvas));
      fabricCanvas.on('object:removed', () => saveCanvasState(fabricCanvas));

      fabricCanvas.renderAll();
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
      setCanvas(null);
      setHistory([]);
      fabricCanvas.off('selection:created', handleObjectSelection);
      fabricCanvas.off('selection:updated', handleObjectSelection);
      fabricCanvas.off('selection:cleared');
    };
  }, [proxiedImageUrl, imageData]);

  useEffect(() => {
    if (!isDarkInitialized && !!brandThemeSettings && brandThemeSettings?.colorScheme?.length > 0) {
      const darkest = getDarkestColor(brandThemeSettings.colorScheme);
      setDarkOverlayColor(darkest);
      setIsDarkInitialized(true);
    }
  }, [brandThemeSettings, isDarkInitialized]);

  // New effect to update overlay colors without reinitializing the canvas
  useEffect(() => {
    if (!canvas) return;
    const darkOverlay = canvas.getObjects().find((obj) => (obj as any).name === 'darkOverlay');
    if (darkOverlay) {
      darkOverlay.set('fill', darkOverlayColor);
    }
    const whiteOverlay = canvas.getObjects().find((obj) => (obj as any).name === 'whiteOverlay');
    if (whiteOverlay) {
      whiteOverlay.set('fill', whiteOverlayColor);
    }
    canvas.renderAll();
  }, [darkOverlayColor, whiteOverlayColor, canvas]);

  const getObjectType = (target: fabric.Object, canvas: fabric.Canvas): SelectedObject['type'] => {
    if (target.type === 'activeSelection') return 'group';
    const name = (target as any).name;
    if (name === 'darkOverlay') return 'darkOverlay';
    if (name === 'whiteOverlay') return 'whiteOverlay';
    if (name === 'logo') return 'logo';
    switch (target.type) {
      case 'textbox':
        return 'text';
      case 'line':
        return 'line';
      case 'image':
        return 'image';
      case 'text':
        if (canvas && target !== canvas.getObjects().find((obj) => obj.type === 'textbox')) {
          return 'companyName';
        } else {
          return 'text';
        }
      default:
        return null;
    }
  };

  const updateSelection = (target: fabric.Object | null, canvas: fabric.Canvas) => {
    if (!target) {
      console.log('No target');
      setSelectedObject({ type: null, object: null });
      setSelectedFillColor('');
      return;
    }

    const objectType = getObjectType(target, canvas);
    console.log('Object type:', objectType);
    setSelectedObject({ type: objectType, object: target });
    setSelectedFillColor(target.get('fill') || '');
    target.lockMovementX = false;
    target.lockMovementY = false;
  };

  function handleObjectSelection(this: fabric.Canvas, e: { selected?: CustomFabricObject[] }) {
    console.log('Handle object selection');
    console.log('Canvas:', this);
    
    // Prioritize the canvas' active object (this supports group selections)
    const activeObject = this.getActiveObject();
    console.log('Active object:', activeObject);
    if (activeObject) {
      updateSelection(activeObject, this);
    } else {
      const selected = e.selected?.[0] || null;
      console.log('Selected:', selected);
      updateSelection(selected, this);
    }
  }

  // Add function to handle color changes
  const debouncedHandleColorChange = debounce((color: string) => {
    if (selectedObject.object && canvas) {
      // Handle edge cases for hex colors
      const validHexColor = color.startsWith('#') ? color : `#${color}`;
      if (validHexColor.length === 4 || validHexColor.length === 7) {
        selectedObject.object.set('fill', validHexColor);
        canvas.renderAll();
        saveCanvasState(canvas);
      }
    }
  }, 300);

  // Update FontControls to disable controls when nothing (or non-text) is selected.
  const FontControls = () => {
    // Check if a text object (i.e. a fabric textbox) is selected.
    const isTextSelected = selectedObject.type === 'text';

    return (
      <div className='flex gap-3 mb-4 items-center'>
        <select
          value={selectedObject.object?.get('fontFamily') || 'Noto Sans'}
          onChange={(e) => {
            const newFamily = e.target.value;
            if (isTextSelected) {
              updateTextStyles('fontFamily', newFamily);
            }
          }}
          className={cn(
            'px-3 py-2 rounded-md border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500',
            !isTextSelected && 'cursor-not-allowed opacity-50'
          )}
          disabled={!isTextSelected}
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
        <div className='flex items-center gap-2'>
          <input
            type='number'
            value={selectedObject.object?.get('fontSize') || 54}
            onChange={(e) => {
              const newSize = parseInt(e.target.value, 10);
              if (newSize > 0 && isTextSelected) {
                updateTextStyles('fontSize', newSize);
              }
            }}
            min='1'
            max='200'
            className={cn(
              'w-20 px-3 py-2 rounded-md border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500',
              !isTextSelected && 'cursor-not-allowed opacity-50'
            )}
            disabled={!isTextSelected}
          />
        </div>
      </div>
    );
  };

  const HistoryControls = () => (
    <div className='flex gap-3 mb-4'>
      <button onClick={handleUndo} disabled={history.length <= 1} className='px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'>
        Undo
      </button>
      <span className='self-center text-sm text-gray-500'>History States: {history.length}</span>
    </div>
  );

  const updateTextStyles = (property: 'fontSize' | 'fontFamily', value: number | string) => {
    if (!selectedObject.object || selectedObject.object.type !== 'textbox') return;

    // Update the selected object's property directly
    selectedObject.object.set(property, value);

    if (canvas) {
      canvas.renderAll();
      saveCanvasState(canvas);
    }
  };

  // Update the handleImageUpload function
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvas || !event.target.files?.[0]) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // Find and remove the existing circle logo
      const existingLogo = canvas.getObjects().find(obj => obj.type === 'circle') as fabric.Circle | undefined;
      if (existingLogo) {
        const { left, top } = existingLogo;
        canvas.remove(existingLogo);

        // Create a new image object
        const imgElement = new Image();
        imgElement.src = dataUrl;
        imgElement.onload = () => {
          const fabricImage = new fabric.Image(imgElement)
          
          // Create a circular clipPath with desired radius
          const clipPath = new fabric.Circle({
            radius: imgElement.width / 2,
            originX: 'center',
            originY: 'center'
          });

          fabricImage.set({
            left: left,
            top: top,
            clipPath: clipPath,
            selectable: true,
            hasControls: true,
            name: 'logo'
          });

          canvas.add(fabricImage);
          canvas.renderAll();
          saveCanvasState(canvas);
        };
      }
    };

    reader.readAsDataURL(file);
  };

  // Update the Sidebar component
  const Sidebar = () => {
    const getColorLabel = () => {
      if (selectedObject.type === 'group') {
        return 'Multiple Items Selected';
      }
      switch (selectedObject.type) {
        case 'darkOverlay':
          return 'Dark Overlay Color';
        case 'whiteOverlay':
          return 'Light Overlay Color';
        case 'text':
          return 'Text Color';
        case 'companyName':
          return 'Company Name Color';
        case 'logo':
          return 'Logo / Image';
        default:
          return 'Select an element';
      }
    };

    return (
      <div ref={sidebarRef} className='w-64 bg-white border-r border-gray-200 p-4 fixed left-0 top-0 h-full shadow-lg overflow-y-auto'>
        <h3 className='text-lg font-semibold mb-4'>Element Properties</h3>
        
        {selectedObject.type === 'logo' ? (
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{getColorLabel()}</label>
              {brandThemeSettings?.logoUrl && (
                <div className='mb-4'>
                  <img
                    src={brandThemeSettings.logoUrl}
                    alt="Current logo"
                    className="w-24 h-24 object-cover rounded-full mb-4"
                  />
                </div>
              )}
              
              <label className='block'>
                <span className='text-sm text-gray-600 mb-2 block'>Upload new image</span>
                <input
                  type='file'
                  accept='image/*'
                  onChange={handleImageUpload}
                  className='block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-yellow-50 file:text-yellow-700
                    hover:file:bg-yellow-100
                    cursor-pointer'
                />
              </label>
            </div>
          </div>
        ) : selectedObject.type && selectedObject.type !== 'image' && selectedObject.type !== 'group' ? (
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{getColorLabel()}</label>
              <div className='p-2 border rounded-md'>
                <HexColorPicker
                  color={selectedFillColor}
                  onChange={(color: string) => {
                    setSelectedFillColor(color);
                    debouncedHandleColorChange(color);
                  }}
                />
                <input
                  type='text'
                  value={selectedFillColor}
                  onChange={(e) => {
                    setSelectedFillColor(e.target.value);
                    debouncedHandleColorChange(e.target.value);
                  }}
                  className='mt-2 p-2 border rounded-md w-full'
                />
              </div>
            </div>
          </div>
        ) : selectedObject.type === 'group' ? (
          <p className='text-gray-500'>Multiple items selected. Deselect to edit properties individually.</p>
        ) : (
          <p className='text-gray-500'>Select an element to edit its properties</p>
        )}
      </div>
    );
  };

  // Add this new useEffect after your other useEffects
  useEffect(() => {
    if (!canvas || !canvasRef.current) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!canvasRef.current) return;
      
      // Get the upper canvas element (where Fabric.js renders objects and controls)
      const upperCanvas = canvasRef.current.parentElement?.querySelector('.upper-canvas');
      
      // Check if the click target is outside the canvas container, the upper canvas, the sidebar, and the controls container
      if (!canvasRef.current.parentElement?.contains(event.target as Node) && 
          !upperCanvas?.contains(event.target as Node) && 
          !sidebarRef.current?.contains(event.target as Node) &&
          !controlsRef.current?.contains(event.target as Node)) {
        canvas.discardActiveObject();
        setSelectedObject({ type: null, object: null });
        setSelectedFillColor('');
        canvas.renderAll();
      }
    };

    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [canvas]);

  // Update the handleWindowFocus function inside the useEffect
  useEffect(() => {
    const handleWindowFocus = () => {
      if (canvas) {
        // If the canvas objects are missing, try to restore from saved history
        if (canvas.getObjects().length === 0 && history.length > 0) {
          const lastState = history[history.length - 1];
          canvas.loadFromJSON(lastState, () => {
            canvas.renderAll();
            console.log('Canvas restored from history on window focus. Objects count:', canvas.getObjects().length);
          });
        } else {
          // Otherwise, just recalc offsets and render
          canvas.calcOffset();
          canvas.renderAll();
          console.log('Window focused, canvas recalculated and re-rendered. Objects count:', canvas.getObjects().length);
        }
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [canvas, history]);

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

  return (
    <div className='flex'>
      <Sidebar />
      <div className='flex-1 ml-64'>
        <div className='max-w-4xl mx-auto p-4'>
          <div className='space-y-4'>
            <div className='flex flex-wrap gap-3 mb-4'>
              <div ref={controlsRef}>
                <FontControls />
              </div>
              {/* <HistoryControls /> */}
            </div>

            <div className='shadow-lg border border-gray-300'>
              <canvas ref={canvasRef} />
              <div className='p-4 bg-gray-50 dark:bg-gray-800'>
                <p className='text-sm text-gray-600 dark:text-gray-300'>Processed Image with Overlay</p>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{imageData.userPrompt}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
