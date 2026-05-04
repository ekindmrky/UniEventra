'use client';

import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      toastOptions={{
        duration: 3500,
        style: {
          background: '#1e293b',   // slate-800
          color: '#f1f5f9',        // slate-100
          border: '1px solid #334155', // slate-700
          borderRadius: '14px',
          fontSize: '14px',
          fontWeight: 500,
          padding: '12px 16px',
          maxWidth: '360px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        },
        success: {
          iconTheme: { primary: '#34d399', secondary: '#1e293b' },
          style: {
            borderColor: '#34d39940',
            background: '#0f2922',
          },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#1e293b' },
          style: {
            borderColor: '#f8717140',
            background: '#2b1010',
          },
          duration: 4500,
        },
      }}
    />
  );
}
