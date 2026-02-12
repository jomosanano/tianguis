
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, QrCode, X, Loader2, User, AlertCircle, ShieldCheck, MapPin, DollarSign, Briefcase } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Merchant } from '../types';

export const QRScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scanning && !merchant) {
      startCamera();
    }
    return () => stopCamera();
  }, [scanning, merchant]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  };

  const tick = () => {
    if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data.startsWith("ATCEM-ID-")) {
          const id = code.data.replace("ATCEM-ID-", "");
          handleScanSuccess(id);
          return;
        }
      }
    }
    if (scanning && !merchant) {
      requestAnimationFrame(tick);
    }
  };

  const handleScanSuccess = async (id: string) => {
    setScanning(false);
    setLoading(true);
    stopCamera();
    try {
      const data = await dataService.getMerchantById(id);
      setMerchant(data);
    } catch (err) {
      setError("Comerciante no encontrado o código inválido.");
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setMerchant(null);
    setError(null);
    setScanning(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter">
          Escáner de <span className="text-blue-500">Auditoría</span>
        </h2>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Verificación instantánea de credenciales</p>
      </header>

      {!merchant ? (
        <div className="relative max-w-lg mx-auto aspect-square bg-slate-900 border-4 border-black rounded-[2.5rem] overflow-hidden neobrutalism-shadow-lg group">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
             <div className="w-64 h-64 border-4 border-blue-500 rounded-3xl relative">
                <div className="scanning-line" />
                <div className="absolute -top-10 left-0 right-0 text-center">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Enfoca el QR</span>
                </div>
             </div>
          </div>

          {error && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
              <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
              <h3 className="text-xl font-black uppercase mb-2">Error de Lectura</h3>
              <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest">{error}</p>
              <button onClick={resetScanner} className="bg-blue-600 border-2 border-black px-8 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all">REINTENTAR</button>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <p className="mt-4 font-black uppercase tracking-widest text-blue-500">Consultando Base de Datos...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-300">
           <div className={`bg-slate-800 border-4 border-black p-8 rounded-[3rem] neobrutalism-shadow-lg relative overflow-hidden ${merchant.balance <= 0 ? 'border-emerald-500/50' : 'border-rose-500/50'}`}>
              <div className="absolute top-0 right-0 p-8">
                 {merchant.balance <= 0 ? (
                   <div className="bg-emerald-500 text-white px-6 py-2 rounded-full border-2 border-black neobrutalism-shadow -rotate-6">
                      <span className="font-black italic uppercase tracking-tighter">AL CORRIENTE</span>
                   </div>
                 ) : merchant.balance < merchant.total_debt ? (
                   <div className="bg-amber-500 text-white px-6 py-2 rounded-full border-2 border-black neobrutalism-shadow rotate-3">
                      <span className="font-black italic uppercase tracking-tighter">EN PROCESO</span>
                   </div>
                 ) : (
                   <div className="bg-rose-500 text-white px-6 py-2 rounded-full border-2 border-black neobrutalism-shadow rotate-6">
                      <span className="font-black italic uppercase tracking-tighter">DEUDOR</span>
                   </div>
                 )}
              </div>

              <div className="flex flex-col items-center mb-8">
                 <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-tr from-blue-600 to-slate-800 shadow-2xl mb-6">
                    <img 
                      src={merchant.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant.full_name)}&background=1e293b&color=fff&bold=true`} 
                      className="w-full h-full rounded-full border-4 border-slate-900 object-cover" 
                      alt="Merchant"
                    />
                 </div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter metallic-gold mb-1 text-center">{merchant.full_name}</h2>
                 <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-1.5 rounded-full">
                    <Briefcase className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{merchant.giro}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-slate-900 border-2 border-black p-4 rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total de Deuda</span>
                    <p className="text-2xl font-black text-white italic tracking-tighter">${merchant.total_debt.toLocaleString()}</p>
                 </div>
                 <div className="bg-slate-900 border-2 border-black p-4 rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Saldo Pendiente</span>
                    <p className={`text-2xl font-black italic tracking-tighter ${merchant.balance <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      ${merchant.balance.toLocaleString()}
                    </p>
                 </div>
              </div>

              <div className="space-y-4 mb-10">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Zonas de Trabajo Autorizadas
                 </h4>
                 <div className="grid grid-cols-1 gap-2">
                    {merchant.assignments.map((a, i) => (
                      <div key={i} className="bg-slate-900/50 border border-slate-700 px-4 py-3 rounded-xl flex justify-between items-center">
                         <span className="font-bold text-sm text-slate-300">{(a as any).zones?.name}</span>
                         <span className="bg-blue-600/10 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black border border-blue-400/20">{a.meters}m - {a.work_day}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <button onClick={resetScanner} className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow active:scale-95 transition-all flex items-center justify-center gap-3">
                 <QrCode className="w-6 h-6" /> ESCANEAR OTRO
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
