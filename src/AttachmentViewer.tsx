import React, { useEffect, useState } from 'react';

// Define a type for the component props
interface AttachmentViewerProps {
  attachmentUrl: string;
  blobScanUrl: string;
  ethscriptionApiUrl: string;
  ethscriptionNumber: number;
  ethscriptionDotComUrl: string;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachmentUrl, blobScanUrl, ethscriptionApiUrl, ethscriptionNumber, ethscriptionDotComUrl }) => {
  // State types are inferred from the initial value, so no changes needed here
  const [content, setContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(attachmentUrl);
        if (!response.ok) {
          if (response.status === 404) {
            console.log('Content not found, retrying...');
            setTimeout(fetchContent, 12000); // Retry after 12 seconds
          }
          throw new Error(`Network response was not ok (${response.statusText})`);
        }
  
        const contentType = response.headers.get('Content-Type') || '';
        setContentType(contentType);
        setLoading(false);
  
        let contentData: Blob | string;
        if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
          contentData = await response.blob();
        } else if (isTextMimetype(contentType)) {
          contentData = await response.text();
        } else {
          throw new Error('Unsupported content type');
        }
  
        if (contentData instanceof Blob) {
          const url = URL.createObjectURL(contentData);
          setContent(url);
          // Clean up the blob URL when the component unmounts
          return () => URL.revokeObjectURL(url);
        } else {
          setContent(contentData);
        }
      } catch (error) {
        if (error instanceof Error && error.message !== 'Content not found') {
          console.error('Error fetching the attachment:', error.message);
          setContent('Error loading content.');
          setLoading(false);
        }
      }
    };
  
    fetchContent();

    // Cleanup function to handle component unmount
    return () => {
      setLoading(false);
    };
  }, [attachmentUrl]);
    
  function isTextMimetype(mimetype: string) {
    return mimetype.startsWith('text/') || mimetype.startsWith('application/json')
  }
  
  const renderContent = () => {
    if (loading) return <div>Loading...</div>;
    if (!content) return <div>Error loading content.</div>;

    if (contentType.startsWith('image/')) {
      return <img className="w-full" style={{imageRendering: "pixelated"}} src={attachmentUrl} alt="Attachment" />;
    } else if (contentType.startsWith('video/')) {
      return <video src={attachmentUrl} controls />;
    } else if (isTextMimetype(contentType)) {
      return <pre className="whitspace-pre whitespace-pre-wrap break-all">{content}</pre>;
    } else {
      return <div>Unsupported content type.</div>;
    }
  };

  const linkURL = import.meta.env.VITE_NETWORK == "sepolia" ? ethscriptionApiUrl : ethscriptionDotComUrl
  
  return (
    <div className="w-full max-w-screen-sm mx-auto">
      <div className="flex flex-col gap-1">
        {renderContent()}
        <div className="flex justify-between">
          <a href={linkURL} target="_blank" rel="noopener noreferrer">Ethscription #{ethscriptionNumber}</a>
          <a href={blobScanUrl} target="_blank" rel="noopener noreferrer">View on Blobscan</a>
        </div>
      </div>
    </div>
  );
};

export default AttachmentViewer;