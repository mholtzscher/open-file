/**
 * S3Explorer React component
 * 
 * Main application component that manages the S3 bucket exploration interface.
 * This is a bridge component that wraps the existing imperative S3Explorer class
 * functionality while providing a React interface.
 */

import { useEffect, useRef } from 'react';
import { Adapter } from '../adapters/adapter.js';
import { ConfigManager } from '../utils/config.js';

interface S3ExplorerProps {
  bucket: string;
  adapter: Adapter;
  configManager: ConfigManager;
}

/**
 * Main S3Explorer component
 */
export function S3Explorer({ bucket, adapter, configManager }: S3ExplorerProps) {
  const appRef = useRef<any>(null);

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      // Import the S3Explorer class implementation
      const { S3Explorer: S3ExplorerClass } = await import('./s3-explorer-class.js');
      const app = new S3ExplorerClass(bucket, adapter, configManager);
      appRef.current = app;
      
      // Start the application
      await app.start();
    };

    initializeApp().catch(error => {
      console.error('Failed to initialize app:', error);
      process.exit(1);
    });

    // Cleanup on unmount
    return () => {
      if (appRef.current) {
        appRef.current.shutdown?.();
      }
    };
  }, [bucket, adapter, configManager]);

  // Return empty fragment - the old class handles all rendering
  // This component just serves as a React entry point
  return null;
}
