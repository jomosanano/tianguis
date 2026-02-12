
import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle, Image as ImageIcon, RotateCcw, SwitchCamera, Loader2 } from 'lucide-react';
import { compressImage } from '../services/imageUtils';

interface ImagePickerProps {
  onCapture: (image: string) => void;
  label: string;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ onCapture, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [loadingCamera, setLoadingCamera] = useState(false);
  
  // Gestión de múltiples cámaras
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  // Enumerar cámaras disponibles
  const updateDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setMode('idle');
    setLoadingCamera(false);
  };

  const startCamera = async (deviceIndex: number = 0) => {
    stopCamera();
    setLoadingCamera(true);
    setMode('camera');

    try {
      // Intentar primero con el deviceId específico si tenemos la lista
      let constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      if (devices.length > 0) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: devices[deviceIndex].deviceId };
      } else {
        // Si no hay lista aún, intentar trasera por defecto
        (constraints.video as MediaTrackConstraints).facingMode = 'environment';
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Una vez que tenemos permiso, actualizamos la lista de cámaras (para tener etiquetas y IDs reales)
      await updateDevices();
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.warn("Fallo al iniciar cámara con configuración ideal, intentando genérica...", err);
      try {
        // Fallback genérico si falla lo anterior
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        if (videoRef.current) videoRef.current.srcObject = fallbackStream;
        await updateDevices();
      } catch (fallbackErr) {
        console.error("Error crítico de cámara:", fallbackErr);
        alert("No se pudo acceder a ninguna cámara. Verifica los permisos de tu navegador.");
        setMode('idle');
      }
    } finally {
      setLoadingCamera(false);
    }
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    setCurrentDeviceIndex(nextIndex);
    startCamera(nextIndex);
  };

  const captureFrame = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const rawImage = canvas.toDataURL('image/jpeg', 0.8);
    const compressed = await compressImage(rawImage);
    setCaptured(compressed);
    onCapture(compressed);
    stopCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const compressed = await compressImage(result);
      setCaptured(compressed);
      onCapture(compressed);
    };
    reader.readAsDataURL(file);
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">{label}</label>
      <div className="relative w-full aspect-[4/3] bg-slate-900 border-4 border-black rounded-[2rem] overflow-hidden neobrutalism-shadow group">
        
        {mode === 'idle' && !captured && (
          <div className="absolute inset-0 flex flex-col sm:flex-row">
            <button 
              type="button"
              onClick={() => startCamera(currentDeviceIndex)}
              className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-slate-800 transition-all border-b-2 sm:border-b-0 sm:border-r-4 border-black group/btn active:bg-slate-700"
            >
              <div className="bg-blue-600 p-4 rounded-2xl border-2 border-black group-hover/btn:scale-110 transition-transform">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 group-hover/btn:text-white transition-colors">Cámara</span>
            </button>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-slate-800 transition-all group/btn active:bg-slate-700"
            >
              <div className="bg-emerald-500 p-4 rounded-2xl border-2 border-black group-hover/btn:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 group-hover/btn:text-white transition-colors">Galería</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </div>
        )}

        {mode === 'camera' && (
          <div className="w-full h-full relative bg-black">
            {loadingCamera ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-blue-500">
                <Loader2 className="w-10 h-10 animate-spin" />
                <span className="font-black text-[10px] uppercase tracking-widest">Iniciando Lente...</span>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none border-2 border-white/20 m-4 rounded-2xl" />
                
                <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 px-6">
                  <button 
                    type="button"
                    onClick={stopCamera}
                    className="p-4 bg-slate-900/80 backdrop-blur-md border-2 border-white/20 rounded-2xl text-white active:scale-90 transition-transform"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>

                  <button 
                    type="button"
                    onClick={captureFrame}
                    className="w-20 h-20 bg-white border-4 border-black rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                  >
                    <div className="w-14 h-14 border-4 border-slate-200 rounded-full" />
                  </button>

                  {devices.length > 1 && (
                    <button 
                      type="button"
                      onClick={switchCamera}
                      className="p-4 bg-blue-600/80 backdrop-blur-md border-2 border-white/20 rounded-2xl text-white active:scale-90 transition-transform"
                    >
                      <SwitchCamera className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {captured && (
          <div className="w-full h-full relative group/preview">
            <img src={captured} className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110" alt="Captured" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
              <button 
                type="button"
                onClick={() => { setCaptured(null); setMode('idle'); }}
                className="bg-white border-4 border-black p-4 rounded-2xl font-black text-slate-900 flex items-center gap-3 animate-in zoom-in-50"
              >
                <RefreshCw className="w-5 h-5" /> REPETIR
              </button>
            </div>
            <div className="absolute top-4 left-4 bg-emerald-500 p-2 rounded-xl border-2 border-black shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
