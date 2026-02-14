
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle, RotateCcw, SwitchCamera, Loader2, X, Scissors, Save, ZoomIn } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { compressImage, getCroppedImg } from '../services/imageUtils';

interface ImagePickerProps {
  onCapture: (image: string) => void;
  label: string;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ onCapture, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'camera' | 'crop'>('idle');
  const [loadingCamera, setLoadingCamera] = useState(false);
  
  // Estados de Recorte
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  useEffect(() => {
    if (videoRef.current && stream && mode === 'camera') {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error("Error al reproducir video:", err));
    }
  }, [stream, mode, loadingCamera]);

  const updateDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error("Error enumerating devices:", err);
      return [];
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    // IMPORTANTE: Ya no seteamos setMode('idle') aquí para permitir transiciones a 'crop'
    setLoadingCamera(false);
  };

  const startCamera = async (deviceIndex: number | null = null) => {
    setLoadingCamera(true);
    setMode('camera');

    try {
      if (stream) stream.getTracks().forEach(t => t.stop());

      let currentDevices = devices;
      if (currentDevices.length === 0) {
        currentDevices = await updateDevices();
      }

      let indexToUse = deviceIndex;
      if (indexToUse === null) {
        const backCameraIndex = currentDevices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('trasera') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        indexToUse = backCameraIndex !== -1 ? backCameraIndex : 0;
        setCurrentDeviceIndex(indexToUse);
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(currentDevices.length > 0 
            ? { deviceId: { exact: currentDevices[indexToUse].deviceId } }
            : { facingMode: 'environment' })
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      await updateDevices();
    } catch (err) {
      console.warn("Fallo al iniciar cámara, reintentando...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStream(fallbackStream);
      } catch (fErr) {
        alert("Error de acceso a cámara.");
        setMode('idle');
      }
    } finally {
      setTimeout(() => setLoadingCamera(false), 500);
    }
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    setCurrentDeviceIndex(nextIndex);
    startCamera(nextIndex);
  };

  const onCaptureFrame = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const rawImage = canvas.toDataURL('image/jpeg', 0.9);
    
    setImageToCrop(rawImage);
    setMode('crop'); // Activamos el editor
    stopCamera(); // Apagamos la cámara pero el modo sigue siendo 'crop'
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string);
      setMode('crop');
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_area: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const saveCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const finalCompressed = await compressImage(croppedBase64, 500, 0.7);
      setCaptured(finalCompressed);
      onCapture(finalCompressed);
      setMode('idle');
      setImageToCrop(null);
    } catch (e) {
      alert("Error al procesar el recorte.");
    }
  };

  const cancelAll = () => {
    stopCamera();
    setMode('idle');
    setImageToCrop(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">{label}</label>
      
      {/* Visualización Previa en el Formulario */}
      <div className="relative w-full aspect-[4/3] bg-slate-900 border-4 border-black rounded-[2rem] overflow-hidden neobrutalism-shadow group">
        {!captured ? (
          <div className="absolute inset-0 flex flex-col sm:flex-row">
            <button 
              type="button" onClick={() => startCamera(null)}
              className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-slate-800 transition-all border-b-2 sm:border-b-0 sm:border-r-4 border-black active:bg-slate-700"
            >
              <Camera className="w-8 h-8 text-blue-500" />
              <span className="font-black text-[10px] uppercase text-slate-400">Cámara</span>
            </button>
            <button 
              type="button" onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-slate-800 transition-all active:bg-slate-700"
            >
              <Upload className="w-8 h-8 text-emerald-500" />
              <span className="font-black text-[10px] uppercase text-slate-400">Galería</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        ) : (
          <div className="w-full h-full relative group/preview">
            <img src={captured} className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-105" alt="Preview" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-4">
               <button type="button" onClick={() => { setCaptured(null); setMode('idle'); }} className="bg-white border-2 border-black p-3 rounded-xl font-black text-[10px] uppercase text-black flex items-center gap-2">
                 <RefreshCw size={14} /> REPETIR
               </button>
            </div>
          </div>
        )}
      </div>

      {/* CÁMARA PANTALLA COMPLETA */}
      {mode === 'camera' && (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-in fade-in duration-300">
           {loadingCamera && (
             <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-blue-500">
               <Loader2 className="w-12 h-12 animate-spin mb-4" />
               <p className="font-black text-xs uppercase tracking-widest">Iniciando Lente...</p>
             </div>
           )}
           
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
           
           {/* UI de Cámara Pantalla Completa */}
           <div className="absolute top-8 left-0 right-0 px-8 flex justify-between items-center">
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Modo Captura: {label}</span>
              </div>
              <button type="button" onClick={cancelAll} className="p-4 bg-white border-2 border-black rounded-full text-black active:scale-90 transition-transform">
                <X size={24} />
              </button>
           </div>

           <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-10 px-8">
              <button type="button" onClick={switchCamera} className="p-5 bg-slate-900/80 backdrop-blur-xl border-2 border-white/20 rounded-full text-white active:scale-90 transition-transform">
                <SwitchCamera size={28} />
              </button>

              <button type="button" onClick={onCaptureFrame} className="w-24 h-24 bg-white border-8 border-slate-900 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
              </button>

              <div className="w-[68px]" />
           </div>
        </div>
      )}

      {/* EDITOR DE RECORTE (MODAL) */}
      {mode === 'crop' && imageToCrop && (
        <div className="fixed inset-0 z-[2500] bg-slate-950 flex flex-col p-4 sm:p-8 animate-in zoom-in-95 duration-300">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-blue-500">Editor de <span className="text-white">Imagen</span></h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ajusta el encuadre para {label}</p>
              </div>
              <button type="button" onClick={cancelAll} className="p-3 bg-slate-800 border-2 border-black rounded-2xl text-white active:scale-90 transition-transform"><X /></button>
           </div>

           <div className="relative flex-1 bg-black border-4 border-black rounded-[2.5rem] overflow-hidden neobrutalism-shadow-lg">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={label.toLowerCase().includes('perfil') ? 1 : 1.6}
                cropShape={label.toLowerCase().includes('perfil') ? 'round' : 'rect'}
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
           </div>

           <div className="mt-8 space-y-6">
              <div className="flex items-center gap-6 bg-slate-900 border-2 border-black p-4 rounded-3xl">
                 <ZoomIn className="text-blue-500" size={20} />
                 <input 
                   type="range" min={1} max={3} step={0.1} 
                   value={zoom} onChange={e => setZoom(Number(e.target.value))} 
                   className="flex-1 accent-blue-600 h-2 rounded-lg"
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button type="button" onClick={cancelAll} className="bg-slate-800 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all text-white">Descartar</button>
                 <button type="button" onClick={saveCrop} className="bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow active:scale-95 flex items-center justify-center gap-3">
                   <Save size={18} /> GUARDAR RECORTE
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
