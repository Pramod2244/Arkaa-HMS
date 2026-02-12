import React, { useRef } from 'react';

export function TenantLogoUpload({
  onUpload,
  currentLogoUrl,
}: {
  onUpload: (file: File) => void;
  currentLogoUrl?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      {currentLogoUrl && (
        <img src={currentLogoUrl} alt="Tenant Logo" className="h-16 w-16 rounded-lg object-contain border border-gray-200" />
      )}
      <button
        type="button"
        className="px-3 py-1.5 bg-primary text-white rounded-lg shadow hover:bg-primary-light transition"
        onClick={() => fileInputRef.current?.click()}
      >
        Upload Logo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
          }
        }}
      />
    </div>
  );
}
