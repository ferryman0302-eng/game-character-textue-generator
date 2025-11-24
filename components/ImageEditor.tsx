import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { Upload, Zap, X, Sliders, RefreshCw } from 'lucide-react';

const ImageEditor: React.FC = () => {
  const [baseImage, setBaseImage] = useState<{data: string, mimeType: string} | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setPreviewUrl(res);
      setBaseImage({ mimeType: file.type, data: res.split(',')[1] });
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = async () => {
    if (!baseImage || !prompt) return;
    setIsProcessing(true);
    setError('');
    try {
      const results = await editImage(prompt, baseImage);
      if (results.length > 0) {
        setResultImage(results[0]);
      } else {
        setError('No image returned from edition process.');
      }
    } catch (e: any) {
      setError(e.message || 'Editing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold text-white mb-2">Neuro Editor</h1>
        <p className="text-cyber-accent/80">Natural language image editing powered by Nano Banana.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Side */}
        <div className="space-y-6">
          <div 
            onClick={() => fileRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl h-80 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all
              ${previewUrl ? 'border-cyber-500' : 'border-cyber-700 hover:border-cyber-accent'}
            `}
          >
             {previewUrl ? (
               <img src={previewUrl} alt="Source" className="absolute inset-0 w-full h-full object-contain bg-black/50 p-4" />
             ) : (
               <div className="text-center p-6">
                 <Upload className="w-12 h-12 text-cyber-500 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm font-mono">UPLOAD SOURCE IMAGE</p>
               </div>
             )}
             <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" accept="image/*" />
          </div>

          <div className="bg-cyber-800 p-1 rounded-xl border border-cyber-700">
            <div className="relative">
              <input 
                type="text"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g., 'Add a neon sign', 'Make it night time'"
                className="w-full bg-cyber-900 text-white p-4 pr-12 rounded-lg outline-none border border-transparent focus:border-cyber-500 placeholder-gray-600"
              />
              <Sliders className="absolute right-4 top-1/2 -translate-y-1/2 text-cyber-600 w-5 h-5" />
            </div>
          </div>

          <button 
            onClick={handleEdit}
            disabled={!baseImage || !prompt || isProcessing}
            className="w-full py-4 bg-cyber-600 hover:bg-cyber-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <RefreshCw className="animate-spin" /> : <Zap />}
            <span>{isProcessing ? 'EDITING...' : 'EXECUTE EDIT'}</span>
          </button>

          {error && <p className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</p>}
        </div>

        {/* Output Side */}
        <div className="bg-black rounded-2xl border border-cyber-700 h-80 md:h-auto flex items-center justify-center overflow-hidden relative">
           {!resultImage && !isProcessing && (
             <div className="text-gray-600 font-mono text-xs">WAITING FOR INPUT</div>
           )}
           
           {isProcessing && (
             <div className="flex flex-col items-center">
               <div className="w-12 h-12 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin mb-2"></div>
               <span className="text-cyber-accent text-xs tracking-widest animate-pulse">TRANSFORMING PIXELS</span>
             </div>
           )}

           {resultImage && (
             <div className="w-full h-full relative group">
               <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
               <a 
                 href={resultImage} 
                 download="edited_neurogen.png"
                 className="absolute bottom-4 right-4 bg-cyber-accent text-black px-4 py-2 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 DOWNLOAD
               </a>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;