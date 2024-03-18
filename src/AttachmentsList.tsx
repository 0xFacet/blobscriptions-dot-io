import React, { useEffect, useState } from 'react';
import AttachmentViewer from './AttachmentViewer'; // Import the AttachmentViewer component

// Define the structure of each attachment item
interface AttachmentItem {
  attachment_path: string;
}

const AttachmentsList: React.FC = () => {
  // Use the AttachmentItem type for the items state
  const [items, setItems] = useState<AttachmentItem[]>([]);

  useEffect(() => {
    const fetchAttachments = () => {
      fetch('https://sepolia-api-v2.ethscriptions.com/ethscriptions?attachments_present=true')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Network response was not ok (${response.statusText})`);
          }
          return response.json();
        })
        .then(data => {
          // Assuming 'data' is an array of items with 'attachment_path'
          setItems(data['result']);
        })
        .catch(error => {
          console.error('Error fetching attachments:', error);
        });
    };

    fetchAttachments();
    const intervalId = setInterval(fetchAttachments, 12000); // Poll every 12 seconds

    // Cleanup on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <AttachmentViewer key={index} attachmentUrl={`https://sepolia-api-v2.ethscriptions.com${item.attachment_path}`} />
      ))}
    </div>
  );
};

export default AttachmentsList;