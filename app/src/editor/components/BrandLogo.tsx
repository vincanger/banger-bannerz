import type { ChangeEvent } from 'react';

import axios from 'axios';
import { useState } from 'react';
import { useAuth } from 'wasp/client/auth';
import { useQuery } from 'wasp/client/operations';
import { getBrandThemeSettings, saveBrandThemeSettings, saveBrandLogo } from 'wasp/client/operations';
import { getUploadFileSignedURLFromS3 } from '../../file-upload/s3Utils';
import { toast } from 'react-hot-toast';

const BrandLogo: React.FC = () => {
  const { data: brandTheme, isLoading, error } = useQuery(getBrandThemeSettings);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  const { data: user } = useAuth();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) throw new Error('User not found');
    if (!event.target.files || event.target.files.length === 0) throw new Error('No file selected');
    
    setUploading(true);
    setUploadError('');
    
    try {
      const file = event.target.files[0];
      
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File size must be less than 5MB');
      }

      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${file.name.split('.')[0]}_${Date.now()}`;
      const fileType = file.type.split('/')[1];

      await saveBrandLogo({
        fileName,
        fileExtension,
        fileType,
        base64Data,
      });

    } catch (error) {
      toast.error('Error saving brand logo');
      console.error('Error saving brand logo:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className='p-4'>
      <h2 className='text-xl font-semibold mb-2'>Brand Logo</h2>
      {brandTheme?.logoUrl ? (
        <img src={brandTheme.logoUrl} alt='Brand Logo' className='w-32 h-32 object-cover rounded-full mb-2' />
      ) : (
        <div className='w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-2'>
          <span className='text-gray-500'>No Logo</span>
        </div>
      )}
      <label className='block'>
        <span className='text-sm text-gray-600'>Upload Logo</span>
        <input type='file' accept='image/*' onChange={handleFileChange} className='mt-1 block' />
      </label>
      {uploading && <p className='text-sm text-blue-500'>Uploading...</p>}
      {uploadError && <p className='text-sm text-red-500'>{uploadError}</p>}
      {error && <p className='text-sm text-red-500'>{error.message}</p>}
    </div>
  );
};

export default BrandLogo;
