import type { GeneratedImageData } from 'wasp/entities';

import { FC, useState } from 'react';
import { FaSync, FaEdit, FaExpand, FaSave } from 'react-icons/fa';

interface ImageGridProps {
  images: GeneratedImageData[];
  selectedImage: GeneratedImageData | null;
  onSelectImage: (image: GeneratedImageData) => void;
  onGenerateVariations: (image: GeneratedImageData) => void;
  onSaveImage: (image: GeneratedImageData) => void;
}

export const ImageGrid: FC<ImageGridProps> = ({
  images,
  selectedImage,
  onSelectImage,
  onGenerateVariations,
  onSaveImage,
}) => {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  return (
    <>
      <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4 p-4">
        {images.map((image, index) => (
          <div
            key={image.url + index}
            className={`relative break-inside-avoid group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 ${
              selectedImage?.id === image.id ? 'ring-4 ring-yellow-500' : ''
            }`}
          >
            <img
              src={image.url}
              alt={`Generated option ${index + 1}`}
              className="w-full object-cover"
            />
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectImage(image);
                }}
                className="p-3 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200"
                title="Select Image"
              >
                <FaEdit className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveImage(image);
                }}
                className="p-3 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200"
                title="Save Image"
              >
                <FaSave className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateVariations(image);
                }}
                className="p-3 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200"
                title="Generate Variations"
              >
                <FaSync className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEnlargedImage(image.url);
                }}
                className="p-3 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200"
                title="Enlarge Image"
              >
                <FaExpand className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Large image preview overlay */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[80vh] w-auto h-auto">
            <img
              src={enlargedImage}
              alt="Preview"
              className="object-contain w-full h-full shadow-2xl rounded-lg"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}; 