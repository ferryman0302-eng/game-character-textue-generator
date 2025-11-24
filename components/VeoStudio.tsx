import React, { useState, useRef, useEffect } from 'react';
import { generateVideo } from '../services/geminiService';
import { Video, Play, AlertTriangle, Loader2, Upload } from 'lucide-react';

const VeoStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [imageBytes, setImageBytes] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKeySelection, setNeedsKeySelection] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
      setNeedsKeySelection(false);
    } else {
      setNeedsKeySelection(true);
    }
  };

  const handleKeySelection = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Optimistically assume success as per instructions
      setNeedsKeySelection(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setPreviewUrl(res);
      setImageBytes(res.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      if (needsKeySelection) {
        await handleKeySelection();
      }
      
      const videoUrl = await generateVideo(prompt, imageBytes, aspectRatio);
      if (videoUrl) {
        setGeneratedVideoUrl(videoUrl);
      } else {
        setError('Failed to retrieve video URI.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Requested entity was not found')) {
        setNeedsKeySelection(true);
        setError('API Key session expired or invalid. Please select key again.');
      } else {
        setError(e.message || 'Video generation failed.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <header className="mb-8 flex items-center space-x-4">
         <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg shadow-purple-500/20">
            <Video className="w-8 h-8 text-white" />
         </div>
         <div>
            <h1 className="text-4xl font-display font-bold text-white">Veo Studio</h1>
            <p className="text-gray-400">Cinematic video generation from text or image.</p>
         </div>
      </header>

      {needsKeySelection && (
        <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl mb-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-amber-500 w-5 h-5" />
            <span className="text-amber-200 text-sm">
              Veo requires a paid project API key. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-amber-100">Learn more</a>
            </span>
          </div>
          <button 
            onClick={handleKeySelection}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Select API Key
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-cyber-800 border border-cyber-700 p-5 rounded-2xl space-y-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Source Image (Optional)</label>
              <div 
                onClick={() => fileRef.current?.click()}
                className="h-40 border border-cyber-600 rounded-xl bg-cyber-900 relative overflow-hidden hover:border-cyber-accent cursor-pointer transition-colors flex items-center justify-center"
              >
                 {previewUrl ? (
                   <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                 ) : (
                   <Upload className="text-cyber-700 w-8 h-8" />
                 )}
                 <input type="file" ref={fileRef} className="hidden" onChange={handleUpload} accept="image/*" />
              </div>

              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Aspect Ratio</label>
              <div className="flex bg-cyber-900 p-1 rounded-lg">
                 <button 
                   onClick={() => setAspectRatio('16:9')}
                   className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${aspectRatio === '16:9' ? 'bg-cyber-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                   16:9
                 </button>
                 <button 
                   onClick={() => setAspectRatio('9:16')}
                   className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${aspectRatio === '9:16' ? 'bg-cyber-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                   9:16
                 </button>
              </div>
           </div>
        </div>

        {/* Prompt & Preview */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
           <textarea 
             value={prompt}
             onChange={e => setPrompt(e.target.value)}
             placeholder="Describe the scene, camera movement, and lighting..."
             className="w-full h-24 bg-cyber-800 border border-cyber-700 rounded-xl p-4 text-white outline-none focus:border-purple-500 transition-colors resize-none"
           />
           
           <button 
             onClick={handleGenerate}
             disabled={isGenerating || (!prompt && !imageBytes)}
             className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-display font-bold text-lg tracking-widest uppercase rounded-xl shadow-lg shadow-purple-900/40 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
           >
             {isGenerating ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
             <span>Generate Video</span>
           </button>

           {error && <div className="text-red-400 bg-red-950/30 p-3 rounded-lg text-sm">{error}</div>}

           <div className="flex-1 min-h-[300px] bg-black rounded-2xl border border-cyber-700 flex items-center justify-center relative overflow-hidden shadow-inner">
              {isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                   <div className="w-16 h-16 border-4 border-purple-500 border-b-transparent rounded-full animate-spin mb-4"></div>
                   <p className="text-purple-400 font-mono text-sm animate-pulse">RENDERING FRAMES...</p>
                   <p className="text-gray-500 text-xs mt-2">This may take a minute.</p>
                </div>
              )}

              {generatedVideoUrl ? (
                <video controls autoPlay loop className="w-full h-full object-contain">
                  <source src={generatedVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                 !isGenerating && <div className="text-gray-700 font-display text-lg">NO VIDEO SIGNAL</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default VeoStudio;