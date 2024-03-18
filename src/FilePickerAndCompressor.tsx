import React, { useState } from 'react';
import { compressDataWithRatioCheck } from './gzip'; // Adjust the import path as necessary

interface FilePickerAndCompressorProps {
  onCompress: (compressedData: ArrayBuffer, mimetype: string) => void; // Callback function type
}

const FilePickerAndCompressor = ({ onCompress }: FilePickerAndCompressorProps) => {
  const [error, setError] = useState<string | null>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      setError('No file selected');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer instanceof ArrayBuffer) {
        try {
          const compressedData = await compressDataWithRatioCheck(arrayBuffer);
          onCompress(compressedData, file.type); // Optionally pass the MIME type along with the compressed data
          setError(null); // Clear any previous errors
        } catch (compressionError: any) {
          setError(compressionError.message);
        }
      }
    };
    reader.onerror = () => setError('Failed to read the file');
    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input
      type="file" onChange={handleFileChange} />
      {error && <p>Error: {error}</p>}
    </div>
  );
};

export default FilePickerAndCompressor;