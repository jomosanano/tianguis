
import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle } from 'lucide-react';
import { compressImage } from '../services/imageUtils';

interface CameraCaptureProps {
  onCapture: (image: string) => void;
  label: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  const captureFrame = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const rawImage = canvas.toDataURL('image/jpeg');
    const compressed = await compressImage(rawImage);
    setCaptured(compressed);
    onCapture(compressed);
    stopCamera();
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="relative w-full aspect-video bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden neobrutalism-shadow">
        {!stream && !captured && (
          <button 
            type="button"
            onClick={startCamera}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Camera className="w-12 h-12 text-blue-500" />
            <span className="font-bold">Encender Cámara</span>
          </button>
        )}

        {stream && (
          <div className="w-full h-full relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={captureFrame}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 p-4 bg-blue-600 border-2 border-black rounded-full neobrutalism-shadow hover:neobrutalism-shadow-active active:neobrutalism-shadow-active"
            >
              <div className="w-6 h-6 border-4 border-white rounded-full" />
            </button>
          </div>
        )}

        {captured && (
          <div className="w-full h-full relative">
            <img src={captured} className="w-full h-full object-cover" alt="Captured" />
            <div className="absolute top-2 right-2 bg-emerald-500 p-1 rounded-full border border-black">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <button 
              type="button"
              onClick={() => { setCaptured(null); startCamera(); }}
              className="absolute bottom-4 right-4 p-3 bg-slate-800 border-2 border-black rounded-xl neobrutalism-shadow"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
