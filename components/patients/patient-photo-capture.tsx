"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, X, RotateCcw, Check, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PatientPhotoCaptureProps {
  value?: string | null;
  onChange: (photoData: string | null) => void;
  disabled?: boolean;
  required?: boolean; // For MLC cases
}

export function PatientPhotoCapture({
  value,
  onChange,
  disabled = false,
  required = false,
}: PatientPhotoCaptureProps) {
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      setShowCameraDialog(true);
      
      // Wait for dialog to render, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCameraDialog(false);
    setCapturedImage(null);
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to JPEG with quality compression
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      // Check file size (convert base64 to approximate bytes)
      const base64Length = capturedImage.length - "data:image/jpeg;base64,".length;
      const sizeInBytes = Math.ceil((base64Length * 3) / 4);
      
      if (sizeInBytes > 200 * 1024) {
        // Compress further if needed
        compressImage(capturedImage, 200 * 1024).then((compressed) => {
          onChange(compressed);
          stopCamera();
        });
      } else {
        onChange(capturedImage);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB before compression)
    if (file.size > 2 * 1024 * 1024) {
      setError("File size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCropImage(dataUrl);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const compressImage = (dataUrl: string, maxBytes: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if too large
        const maxDim = 400;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels
          let quality = 0.8;
          let result = canvas.toDataURL("image/jpeg", quality);
          
          while (getBase64Size(result) > maxBytes && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL("image/jpeg", quality);
          }
          
          resolve(result);
        } else {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  };

  const getBase64Size = (dataUrl: string): number => {
    const base64 = dataUrl.split(",")[1];
    return Math.ceil((base64.length * 3) / 4);
  };

  const applyCrop = () => {
    if (!cropImage) return;
    
    // For simplicity, we'll do a center crop to square
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(img.width, img.height);
      canvas.width = 150;
      canvas.height = 150;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 150, 150);
        
        const result = canvas.toDataURL("image/jpeg", 0.8);
        const compressed = await compressImage(result, 200 * 1024);
        onChange(compressed);
        setShowCropDialog(false);
        setCropImage(null);
      }
    };
    img.src = cropImage;
  };

  const removePhoto = () => {
    onChange(null);
  };

  return (
    <div className="space-y-3">
      {/* Preview Box */}
      <div className="flex items-start gap-4">
        <div
          className={`w-[150px] h-[150px] border-2 rounded-lg flex items-center justify-center overflow-hidden ${
            required && !value ? "border-red-300" : "border-gray-200"
          } bg-gray-50`}
        >
          {value ? (
            <img
              src={value}
              alt="Patient photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-gray-400">
              <Camera className="w-10 h-10 mx-auto mb-2" />
              <span className="text-xs">No photo</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startCamera}
            disabled={disabled}
            className="justify-start"
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture from Camera
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="justify-start"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload from Computer
          </Button>

          {value && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={removePhoto}
              disabled={disabled}
              className="justify-start text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {required && !value && (
        <p className="text-sm text-red-600">Photo is mandatory for MLC cases</p>
      )}

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture Patient Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!capturedImage ? (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex justify-center gap-3">
              {!capturedImage ? (
                <>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                  <Button onClick={capturePhoto}>
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={retakePhoto}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake
                  </Button>
                  <Button onClick={confirmCapture}>
                    <Check className="w-4 h-4 mr-2" />
                    Use Photo
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={(open) => !open && setCropImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {cropImage && (
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden max-h-[400px] flex items-center justify-center">
                <img
                  src={cropImage}
                  alt="To crop"
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-0 border-4 border-dashed border-blue-500 pointer-events-none" />
              </div>
            )}

            <p className="text-sm text-gray-500 text-center">
              Photo will be cropped to a square from the center
            </p>

            <canvas ref={cropCanvasRef} className="hidden" />

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setShowCropDialog(false); setCropImage(null); }}>
                Cancel
              </Button>
              <Button onClick={applyCrop}>
                <Crop className="w-4 h-4 mr-2" />
                Apply & Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
