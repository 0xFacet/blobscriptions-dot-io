import React, { useEffect, useState } from 'react';

// Define a type for the component props
interface AttachmentViewerProps {
  attachmentUrl: string;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachmentUrl }) => {
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
        } else if (contentType.startsWith('text/')) {
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

  const renderContent = () => {
    if (loading) return <div>Loading...</div>;
    if (!content) return <div>Error loading content.</div>;

    if (contentType.startsWith('image/')) {
      return <img src={content} alt="Attachment" />;
    } else if (contentType.startsWith('video/')) {
      return <video src={content} controls />;
    } else if (contentType.startsWith('text/')) {
      return <pre>{content}</pre>;
    } else {
      return <div>Unsupported content type.</div>;
    }
  };

  return (
    <div className="max-w-screen-sm mx-auto">
      {renderContent()}
    </div>
  );
};

export default AttachmentViewer;