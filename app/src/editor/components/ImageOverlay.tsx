import { FC, useEffect, useRef, useState, memo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'wasp/client/operations';
import { getGeneratedImageDataById, getImageProxy, getBrandThemeSettings } from 'wasp/client/operations';
import type { GeneratedImageData } from 'wasp/entities';
import { HexColorPicker } from 'react-colorful';
import * as fabric from 'fabric';
import { FabricImage, FabricObject } from 'fabric';
import { FaPlus, FaMinus, FaChevronDown } from 'react-icons/fa';
import debounce from 'lodash/debounce';

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
  type: 'darkOverlay' | 'whiteOverlay' | 'text' | 'line' | 'logo' | 'companyName' | 'image' | null;
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
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<SelectedObject>({ type: null, object: null });

  const { data: imageData, isLoading: imageDataLoading, error: imageDataError } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });

  const { data: proxiedImageUrl, isLoading: proxyLoading, error: proxyError } = useQuery(getImageProxy, { url: imageData?.url || '' }, { enabled: !!imageData?.url });

  const { data: brandThemeSettings, isLoading: brandThemeSettingsLoading, error: brandThemeSettingsError } = useQuery(getBrandThemeSettings);

  const [darkOverlayColor, setDarkOverlayColor] = useState('#000000D9');
  const [whiteOverlayColor, setWhiteOverlayColor] = useState('#FFFFFF');
  const [isDarkInitialized, setIsDarkInitialized] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

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

    // Use TARGET_WIDTH and TARGET_HEIGHT instead throughout the effect

    // Cleanup any existing canvas
    if (canvas) {
      canvas.dispose();
    }

    // Calculate container width and scale
    const containerWidth = canvasRef.current.parentElement?.clientWidth || TARGET_WIDTH;
    const scale = Math.min(1, containerWidth / TARGET_WIDTH);

    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      backgroundColor: 'white',
      preserveObjectStacking: true,
      devicePixelRatio: 1,
    });

    // Add selection event listeners right after canvas initialization
    fabricCanvas.on('selection:created', handleObjectSelection);
    fabricCanvas.on('selection:updated', handleObjectSelection);

    // Add keyboard event listener
    const handleKeyDown = (e: KeyboardEvent) => {
      const MOVE_DISTANCE = e.shiftKey ? 10 : 1;
      const activeObject = fabricCanvas.getActiveObject();

      if (!activeObject) return;

      switch (e.key) {
        case 'ArrowLeft':
          activeObject.left! -= MOVE_DISTANCE / scale;
          break;
        case 'ArrowRight':
          activeObject.left! += MOVE_DISTANCE / scale;
          break;
        case 'ArrowUp':
          activeObject.top! -= MOVE_DISTANCE / scale;
          break;
        case 'ArrowDown':
          activeObject.top! += MOVE_DISTANCE / scale;
          break;
        default:
          return;
      }

      activeObject.setCoords();
      fabricCanvas.renderAll();
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);

    // Set the display size
    fabricCanvas.setWidth(TARGET_WIDTH * scale);
    fabricCanvas.setHeight(TARGET_HEIGHT * scale);
    fabricCanvas.setZoom(scale);

    setCanvas(fabricCanvas);

    FabricImage.fromObject({ type: 'image', src: proxiedImageUrl }).then((fabricImageFromUrl) => {
      const scale = Math.min(TARGET_WIDTH / fabricImageFromUrl.width!, TARGET_HEIGHT / fabricImageFromUrl.height!);
      fabricImageFromUrl.scaleX = scale * zoomLevel;
      fabricImageFromUrl.scaleY = scale * zoomLevel;
      fabricImageFromUrl.originX = 'center';
      fabricImageFromUrl.originY = 'center';
      const overlayWidth = TARGET_WIDTH / 3 + 40;
      fabricImageFromUrl.left = TARGET_WIDTH / 2 + overlayWidth / 2;
      fabricImageFromUrl.top = TARGET_HEIGHT / 2;
      fabricImageFromUrl.selectable = true;
      fabricImageFromUrl.hasControls = true;
      fabricImageFromUrl.setCoords();
      // Fill white background first
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

      // Add image next
      fabricCanvas.add(fabricImageFromUrl);

      // Create dark overlay
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

      // Create white overlay with rounded corners
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

      // Add company logo circle
      const logoSize = 24;
      const logoY = lineY + 40;
      const logo = new fabric.Circle({
        left: textPadding,
        top: logoY,
        radius: logoSize / 2,
        fill: textColor,
        selectable: true,
        hasControls: true,
      });
      fabricCanvas.add(logo);

      // Add company name
      const companyNameText = 'Company Name'; // TODO: imageData.companyName ||
      const companyNameFontSize = fontSize * 0.4;
      const companyNameWidth = companyNameText.length * companyNameFontSize;
      const companyName = new fabric.Textbox(companyNameText, {
        left: textPadding + logoSize + 15,
        top: logoY,
        width: companyNameWidth,
        fill: textColor,
        fontSize: companyNameFontSize,
        fontFamily: 'Noto Sans',
        selectable: true,
        hasControls: true,
      });
      fabricCanvas.add(companyName);

      // After all objects are added and setup is complete, save initial state and add listeners
      saveCanvasState(fabricCanvas); // Save initial state

      // Add event listeners for future modifications only
      fabricCanvas.on('object:modified', () => saveCanvasState(fabricCanvas));
      fabricCanvas.on('object:removed', () => saveCanvasState(fabricCanvas));

      fabricCanvas.renderAll();
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
      setCanvas(null);
      setHistory([]); // Clear history on cleanup
      fabricCanvas.off('selection:created', handleObjectSelection);
      fabricCanvas.off('selection:updated', handleObjectSelection);
      fabricCanvas.off('selection:cleared');
    };
  }, [proxiedImageUrl, imageData, darkOverlayColor, whiteOverlayColor, zoomLevel]);

  useEffect(() => {
    if (!isDarkInitialized && !!brandThemeSettings && brandThemeSettings?.colorScheme?.length > 0) {
      const darkest = getDarkestColor(brandThemeSettings.colorScheme);
      setDarkOverlayColor(darkest);
      setIsDarkInitialized(true);
    }
  }, [brandThemeSettings, isDarkInitialized]);

  // Modify the handleObjectSelection function
  const handleObjectSelection = (e: { selected?: CustomFabricObject[] }) => {
    const selected = e.selected?.[0];
    if (!selected) {
      setSelectedObject({ type: null, object: null });
      return;
    }

    // Use the name property to identify objects
    switch (selected.name) {
      case 'darkOverlay':
        setSelectedObject({ type: 'darkOverlay', object: selected });
        break;
      case 'whiteOverlay':
        setSelectedObject({ type: 'whiteOverlay', object: selected });
        break;
      default:
        // Handle other objects as before
        if (selected.type === 'textbox') {
          setSelectedObject({ type: 'text', object: selected });
        } else if (selected.type === 'line') {
          setSelectedObject({ type: 'line', object: selected });
        } else if (selected.type === 'circle') {
          setSelectedObject({ type: 'logo', object: selected });
        } else if (selected.type === 'text' && selected !== canvas?.getObjects().find((obj) => obj.type === 'textbox')) {
          setSelectedObject({ type: 'companyName', object: selected });
        } else if (selected.type === 'image') {
          setSelectedObject({ type: 'image', object: selected });
        }
    }
  };

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

  const FontControls = () => (
    <div className='flex gap-3 mb-4 items-center'>
      <select
        value={selectedObject.object?.get('fontFamily') || 'Noto Sans'}
        onChange={(e) => {
          const newFamily = e.target.value;
          updateTextStyles('fontFamily', newFamily);
        }}
        className='px-3 py-2 rounded-md border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500'
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
            const newSize = parseInt(e.target.value);
            if (newSize > 0) {
              updateTextStyles('fontSize', newSize);
            }
          }}
          min='1'
          max='200'
          className='w-20 px-3 py-2 rounded-md border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500'
        />
        <span className='text-sm text-gray-500'>px</span>
      </div>
    </div>
  );

  const ZoomControls = () => (
    <div className='flex gap-3 mb-4'>
      <button onClick={() => setZoomLevel((prev) => Math.min(prev + 0.1, 3))} className='px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100'>
        <FaPlus />
      </button>
      <button onClick={() => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5))} className='px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100'>
        <FaMinus />
      </button>
      <span className='self-center'>Zoom: {zoomLevel.toFixed(1)}x</span>
    </div>
  );

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

  // Replace ColorControls with Sidebar
  const Sidebar = () => {
    const getColorLabel = () => {
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
          return 'Logo Color';
        default:
          return 'Select an element';
      }
    };

    return (
      <div className='w-64 bg-white border-r border-gray-200 p-4 fixed left-0 top-0 h-full shadow-lg'>
        <h3 className='text-lg font-semibold mb-4'>Element Properties</h3>
        {selectedObject.type && selectedObject.type !== 'image' ? (
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{getColorLabel()}</label>
              <div className='p-2 border rounded-md'>
                <HexColorPicker color={selectedObject.object?.get('fill')} onChange={debouncedHandleColorChange} />
                <input type='text' defaultValue={selectedObject.object?.get('fill')} onChange={(e) => debouncedHandleColorChange(e.target.value)} className='mt-2 p-2 border rounded-md' />
              </div>
            </div>
          </div>
        ) : (
          <p className='text-gray-500'>Select an element to edit its properties</p>
        )}
      </div>
    );
  };

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
              <FontControls />
              <ZoomControls />
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
