
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iyqcqtqjoqstrheqlusq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cWNxdHFqb3FzdHJoZXFsdXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzU4MzMsImV4cCI6MjA4NjMxMTgzM30.TrqVM8RYQunBaN4EJaZOhkRnSi3DRVmhMMSnkdSm1Vg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadImage = async (base64: string, path: string) => {
  if (!base64 || !base64.startsWith('data:image')) return null;
  
  try {
    // Método más robusto para convertir Base64 a Blob
    const res = await fetch(base64);
    const blob = await res.blob();
    
    // Generar nombre de archivo único compatible
    const fileExt = 'jpg';
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    console.log(`Subiendo imagen a storage: ${fileName}...`);
    
    const { data, error } = await supabase.storage
      .from('merchants_media')
      .upload(fileName, blob, { 
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) {
      console.error("Error detallado de Supabase Storage:", error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('merchants_media')
      .getPublicUrl(fileName);
      
    console.log("Imagen subida con éxito. URL pública:", publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("Error crítico en uploadImage:", err);
    return null;
  }
};
