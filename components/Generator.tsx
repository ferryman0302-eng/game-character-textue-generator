
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, AspectRatio, ImageResolution } from '../types';
import { MODE_CONFIG } from '../constants';
import { optimizeText, generateImage, generateTextureMaps } from '../services/geminiService';
import { generateNormalMapFromData } from '../utils/imageProcessing';
import { Wand, Zap, Upload, X, RefreshCw, Grid, Shuffle, Box, Brain, AlertTriangle, Layers, Eye, Download, Package, Activity, Code, Mountain, Trash2 } from 'lucide-react';
import PBRPreview from './PBRPreview';
import { BLENDER_ADDON_SCRIPT } from '../utils/blenderScript';
import { UNITY_BRIDGE_SCRIPT } from '../utils/unityScript';

interface GeneratorProps {
  mode: AppMode.TEXTURE | AppMode.CHARACTER;
}

interface PBRMaps {
  normal: string | null;
  roughness: string | null;
  metallic: string | null;
  occlusion: string | null;
  height: string | null;
}

const Generator: React.FC<GeneratorProps> = ({ mode }) => {
  const config = MODE_CONFIG[mode];
  
  const [prompt, setPrompt] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [needsKeySelection, setNeedsKeySelection] = useState(false);
  
  // Upload
  const [uploadedImage, setUploadedImage] = useState<{data: string, mimeType: string} | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [isMacroShot, setIsMacroShot] = useState(true);
  const [isBodyOnly, setIsBodyOnly] = useState(false);
  const [isHeadOnly, setIsHeadOnly] = useState(false);
  const [tilingImage, setTilingImage] = useState<string | null>(null);
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [batchSize, setBatchSize] = useState(1);

  // RPG Texture Options
  const [pbrMaps, setPbrMaps] = useState<PBRMaps>({ normal: null, roughness: null, metallic: null, occlusion: null, height: null });
  const [isGeneratingMaps, setIsGeneratingMaps] = useState(false);
  const [isGeneratingHeight, setIsGeneratingHeight] = useState(false);
  const [showPBRPreview, setShowPBRPreview] = useState(false);
  const [showBridgeModal, setShowBridgeModal] = useState(false);

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
      setNeedsKeySelection(false);
    }
  };

  // Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setUploadedImage({
        mimeType: file.type,
        data: result.split(',')[1]
      });
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPreviewUrl(null);
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteMap = (mapType: keyof PBRMaps) => {
     setPbrMaps(prev => ({ ...prev, [mapType]: null }));
  };

  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    setIsOptimizing(true);
    setError('');
    try {
      const optimized = await optimizeText(prompt, config.optimizeSystemPrompt, useDeepThinking);
      setPrompt(optimized);
    } catch (err: any) {
      setError(err.message || 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) return;
    setIsGenerating(true);
    setError('');
    setGeneratedImages([]);
    setPbrMaps({ normal: null, roughness: null, metallic: null, occlusion: null, height: null });
    
    try {
      if (needsKeySelection) await handleKeySelection();

      const options = { isMacroShot, isBodyOnly, isHeadOnly };
      let finalPrompts: string[] = [];
      
      if (mode === AppMode.TEXTURE) {
        const p = uploadedImage 
          ? config.generateImagePrompt(prompt, options)
          : config.generateBasePrompt(prompt, options);
        finalPrompts = [p];
      } else {
        const baseInstr = uploadedImage 
          ? config.generateImagePrompt(prompt, options)
          : config.generateBasePrompt(prompt, options);

        if (isBodyOnly) {
           const bodyP = `${baseInstr}. Full-body T-pose (character standing upright, arms extended horizontally, legs slightly apart, centered in frame). **Completely remove the head and neck. Nothing should be visible from the shirt collar upwards.** Ensure a clean, headless appearance for body proportions and clothing/armor reference. **This image should *only* show the character's body and main outfit. NO extra equipment, NO hats, NO helmets, NO weapons, NO floating accessories.**`;
           finalPrompts = [bodyP];
        } else if (isHeadOnly) {
           const headP = `${baseInstr}. **This image should ONLY be a head close-up.** Realistic front-facing bust render of the head and neck. **Only the bare head and neck should be visible.** Neutral facial expression, detailed sculpted look. The neck should be mounted on a specific podium base: **A simple, geometric bust base. It is a rectangular prism with a slanted bottom, colored in a flat tan/clay material.** **ABSOLUTELY NO body or torso should be visible.**`;
           finalPrompts = [headP];
        } else {
           const bodyP = `${baseInstr}. Full-body T-pose (character standing upright, arms extended horizontally, legs slightly apart, centered in frame). **Completely remove the head and neck. Nothing should be visible from the shirt collar upwards.** Ensure a clean, headless appearance for body proportions and clothing/armor reference. Any larger equipment which is not part of the main outfit(hat, tools,etc )should be on either side of the body(floating midair), away from the body,no more than 1, all individual(not overlapping or behind one another)`;
           const headP = `${baseInstr}. **This image should ONLY be a head close-up.** Realistic front-facing bust render of the head and neck. **Only the bare head and neck should be visible.** Neutral facial expression, detailed sculpted look. The neck should be mounted on a specific podium base: **A simple, geometric bust base. It is a rectangular prism with a slanted bottom, colored in a flat tan/clay material.** **ABSOLUTELY NO body or torso should be visible.**`;
           finalPrompts = [bodyP, headP];
        }
      }

      const requests: Promise<string[]>[] = [];
      for (let i = 0; i < batchSize; i++) {
        for (const p of finalPrompts) {
          const imgs = uploadedImage ? [uploadedImage] : [];
          requests.push(generateImage(p, imgs, aspectRatio, resolution));
        }
      }

      const results = await Promise.all(requests);
      const flatResults = results.flat();
      setGeneratedImages(flatResults);

      if (flatResults.length === 0) {
        setError("The model did not generate any images. It may have blocked the content or interpreted the image prompt as text-only. Try optimizing your prompt.");
      }

    } catch (err: any) {
      if (err.message && (err.message.includes('403') || err.message.includes('PERMISSION_DENIED'))) {
         setNeedsKeySelection(true);
         setError('Permission denied. Please select a valid API key with billing enabled.');
      } else {
         setError(err.message || 'Generation failed');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getSourceImage = () => generatedImages[0] || (uploadedImage ? `data:${uploadedImage.mimeType};base64,${uploadedImage.data}` : null);

  const handleGenerateMaps = async () => {
    const sourceImage = getSourceImage();
    if (!sourceImage) return;

    setIsGeneratingMaps(true);
    setError('');

    const base64Data = sourceImage.split(',')[1];
    const mimeType = sourceImage.match(/data:(.*?);/)?.[1] || 'image/png';
    const imgObj = { data: base64Data, mimeType };

    try {
      // 1. Generate Normal Map Locally
      const normal = await generateNormalMapFromData(base64Data);

      // 2. Generate Basic PBR Maps (Roughness, Metallic, Occlusion)
      const [roughness, metallic, occlusion] = await Promise.all([
        generateTextureMaps(imgObj, 'roughness'),
        generateTextureMaps(imgObj, 'metallic'),
        generateTextureMaps(imgObj, 'occlusion')
      ]);

      setPbrMaps(prev => ({ ...prev, normal, roughness, metallic, occlusion }));
    } catch (err: any) {
      setError(`Map Generation Failed: ${err.message}`);
    } finally {
      setIsGeneratingMaps(false);
    }
  };

  const handleGenerateHeight = async () => {
    const sourceImage = getSourceImage();
    if (!sourceImage) return;

    setIsGeneratingHeight(true);
    setError('');

    const base64Data = sourceImage.split(',')[1];
    const mimeType = sourceImage.match(/data:(.*?);/)?.[1] || 'image/png';
    const imgObj = { data: base64Data, mimeType };

    try {
      const height = await generateTextureMaps(imgObj, 'height');
      setPbrMaps(prev => ({ ...prev, height }));
    } catch (err: any) {
      setError(`Height Map Failed: ${err.message}`);
    } finally {
      setIsGeneratingHeight(false);
    }
  };

  const handleHDRPPack = async () => {
    if (!pbrMaps.metallic && !pbrMaps.roughness && !pbrMaps.occlusion) {
        setError("Please generate PBR maps first.");
        return;
    }
    
    // HDRP MASK MAP FORMAT:
    // R = Metallic
    // G = Occlusion
    // B = Detail (Set to 0/Black as we treat Height separately)
    // A = Smoothness (1 - Roughness)

    const width = 1024;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    try {
      const metBuffer = pbrMaps.metallic ? await loadImage(pbrMaps.metallic) : null;
      const aoBuffer = pbrMaps.occlusion ? await loadImage(pbrMaps.occlusion) : null;
      const roughBuffer = pbrMaps.roughness ? await loadImage(pbrMaps.roughness) : null;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const getPixels = (img: HTMLImageElement) => {
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(img, 0, 0, width, height);
        return tempCtx.getImageData(0, 0, width, height).data;
      };

      const metData = metBuffer ? getPixels(metBuffer) : null;
      const aoData = aoBuffer ? getPixels(aoBuffer) : null;
      const roughData = roughBuffer ? getPixels(roughBuffer) : null;

      const outputImgData = ctx.createImageData(width, height);
      
      for (let i = 0; i < outputImgData.data.length; i += 4) {
        // Red: Metallic
        outputImgData.data[i] = metData ? metData[i] : 0; 
        
        // Green: Occlusion
        outputImgData.data[i + 1] = aoData ? aoData[i] : 255; 

        // Blue: Detail Mask (Default 0/Black for clean mask)
        outputImgData.data[i + 2] = 0; 

        // Alpha: Smoothness (Inverted Roughness)
        if (roughData) {
            outputImgData.data[i + 3] = 255 - roughData[i];
        } else {
            outputImgData.data[i + 3] = 255;
        }
      }

      ctx.putImageData(outputImgData, 0, 0);
      
      const url = canvas.toDataURL('image/png');
      const id = Date.now();
      const link = document.createElement('a');
      link.href = url;
      link.download = `neurogen_${id}_HDRP_Mask.png`;
      link.click();

    } catch (e) {
      console.error("Packing error", e);
      setError("Failed to pack HDRP Mask Map.");
    }
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadProjectFiles = () => {
    const id = Date.now();
    const download = (url: string, suffix: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `neurogen_${id}_${suffix}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    if (generatedImages[0]) download(generatedImages[0], "albedo");
    if (pbrMaps.normal) download(pbrMaps.normal, "normal");
    if (pbrMaps.roughness) download(pbrMaps.roughness, "roughness");
    if (pbrMaps.metallic) download(pbrMaps.metallic, "metallic");
    if (pbrMaps.occlusion) download(pbrMaps.occlusion, "occlusion");
    if (pbrMaps.height) download(pbrMaps.height, "height");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-12">
      <header className="mb-10 text-center lg:text-left">
        <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
          {config.title}
        </h1>
        <p className="text-cyber-accent/80 text-lg font-light">{config.description}</p>
      </header>

      {needsKeySelection && (
        <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl mb-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-amber-500 w-5 h-5" />
            <span className="text-amber-200 text-sm">This feature requires a paid project API key.</span>
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
        {/* LEFT COLUMN: CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
           {/* Upload */}
           <div className="bg-cyber-800 border border-cyber-700 rounded-2xl p-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyber-600 hover:border-cyber-accent rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer transition-colors group relative overflow-hidden"
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Ref" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-500 z-10"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-cyber-500 group-hover:text-cyber-accent mb-2" />
                    <span className="text-xs text-cyber-400 uppercase tracking-widest font-bold">Upload Reference</span>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              </div>
           </div>

           {/* Settings */}
           <div className="bg-cyber-800 border border-cyber-700 rounded-2xl p-5 space-y-4">
             <h3 className="text-cyber-accent font-display text-sm uppercase tracking-widest mb-4 border-b border-cyber-700 pb-2">Configuration</h3>
             
             {/* Res & Ratio */}
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs text-gray-400 block mb-1">Resolution</label>
                 <select 
                   value={resolution}
                   onChange={(e) => setResolution(e.target.value as ImageResolution)}
                   className="w-full bg-cyber-900 border border-cyber-600 text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-cyber-accent outline-none"
                 >
                   {Object.values(ImageResolution).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
               </div>
               <div>
                 <label className="text-xs text-gray-400 block mb-1">Aspect Ratio</label>
                 <select 
                   value={aspectRatio}
                   onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                   className="w-full bg-cyber-900 border border-cyber-600 text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-cyber-accent outline-none"
                 >
                   {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
               </div>
             </div>

             {/* Batch Size */}
             <div>
               <label className="text-xs text-gray-400 block mb-1 flex items-center gap-2">
                 Batch Size <Layers className="w-3 h-3" />
               </label>
               <div className="flex items-center space-x-1 bg-cyber-900 p-1 rounded-lg border border-cyber-600">
                 {[1, 2, 3, 4].map(num => (
                   <button
                     key={num}
                     onClick={() => setBatchSize(num)}
                     className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
                       batchSize === num 
                         ? 'bg-cyber-accent text-cyber-900 shadow-sm' 
                         : 'text-gray-400 hover:text-white hover:bg-cyber-700'
                     }`}
                   >
                     {num}
                   </button>
                 ))}
               </div>
             </div>

             {/* Mode Specific Toggles */}
             {mode === AppMode.TEXTURE && (
               <label className="flex items-center space-x-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={isMacroShot} 
                   onChange={(e) => setIsMacroShot(e.target.checked)}
                   className="form-checkbox h-4 w-4 text-cyber-accent rounded border-cyber-600 bg-cyber-900 focus:ring-0 focus:ring-offset-0"
                 />
                 <span className="text-sm text-gray-300">Macro Shot (Avoid Pattern)</span>
               </label>
             )}

             {mode === AppMode.CHARACTER && (
               <div className="space-y-2">
                 <label className="flex items-center space-x-3 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={isBodyOnly} 
                     onChange={(e) => { setIsBodyOnly(e.target.checked); if(e.target.checked) setIsHeadOnly(false); }}
                     className="form-checkbox h-4 w-4 text-cyber-accent rounded border-cyber-600 bg-cyber-900"
                   />
                   <span className="text-sm text-gray-300">Body Only</span>
                 </label>
                 <label className="flex items-center space-x-3 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={isHeadOnly} 
                     onChange={(e) => { setIsHeadOnly(e.target.checked); if(e.target.checked) setIsBodyOnly(false); }}
                     className="form-checkbox h-4 w-4 text-cyber-accent rounded border-cyber-600 bg-cyber-900"
                   />
                   <span className="text-sm text-gray-300">Head Only</span>
                 </label>
               </div>
             )}
           </div>
        </div>

        {/* RIGHT COLUMN: PROMPT & OUTPUT */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
           {/* Prompt Input */}
           <div className="bg-cyber-800 border border-cyber-700 rounded-2xl p-1">
             <div className="relative">
               <textarea
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder={config.placeholder}
                 className="w-full h-32 bg-transparent text-white p-4 outline-none resize-none font-sans"
               />
               <div className="absolute bottom-2 right-2 flex items-center space-x-2">
                  <button 
                    onClick={() => setUseDeepThinking(!useDeepThinking)}
                    className={`p-2 rounded-lg transition-colors ${useDeepThinking ? 'bg-purple-600 text-white' : 'bg-cyber-900 text-gray-500 hover:text-purple-400'}`}
                    title="Toggle Deep Thinking (Gemini 3 Pro)"
                  >
                    <Brain className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleOptimize}
                    disabled={isOptimizing || !prompt}
                    className="flex items-center space-x-2 px-4 py-2 bg-cyber-700 hover:bg-cyber-600 text-cyber-accent text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOptimizing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand className="w-3 h-3" />}
                    <span>Optimize</span>
                  </button>
               </div>
             </div>
           </div>

           {/* Generate Button */}
           <button
             onClick={handleGenerate}
             disabled={isGenerating || (!prompt && !uploadedImage)}
             className="w-full py-4 bg-gradient-to-r from-cyber-600 to-cyber-500 hover:from-cyber-500 hover:to-cyber-400 border border-cyber-400/30 text-white font-display font-bold tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(42,74,117,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all transform active:scale-[0.99] flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isGenerating ? (
               <>
                 <RefreshCw className="w-5 h-5 animate-spin" />
                 <span>Processing Neural Request ({batchSize}x)...</span>
               </>
             ) : (
               <>
                 <Zap className="w-5 h-5 text-cyber-accent" />
                 <span>Initialize Generation {batchSize > 1 && `(${batchSize}x)`}</span>
               </>
             )}
           </button>

           {/* Error Display */}
           {error && (
             <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-200 rounded-lg text-sm">
               {error}
             </div>
           )}

           {/* Output Area */}
           <div className="min-h-[400px] bg-cyber-900/50 rounded-2xl border-2 border-dashed border-cyber-700 flex flex-col items-center justify-center relative overflow-hidden">
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-cyber-900/80 z-10 backdrop-blur-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-cyber-600 border-t-cyber-accent rounded-full animate-spin mb-4"></div>
                    <span className="text-cyber-accent font-display animate-pulse">Rendering Batch...</span>
                  </div>
                </div>
              )}
              
              {!isGenerating && generatedImages.length === 0 && !error && (
                <div className="text-cyber-700 flex flex-col items-center">
                  <Box className="w-16 h-16 mb-4 opacity-50" />
                  <p>Output Buffer Empty</p>
                </div>
              )}

              {generatedImages.length > 0 && (
                 <div className={`grid gap-6 p-6 w-full ${generatedImages.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    {generatedImages.map((url, idx) => (
                      <div key={idx} className="group relative rounded-xl overflow-hidden border border-cyber-600 shadow-2xl bg-black">
                        <img src={url} alt={`Gen ${idx}`} className="w-full h-auto object-contain" />
                        
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cyber-accent font-mono">{resolution} // {aspectRatio}</span>
                            <button 
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `neurogen_${Date.now()}_${idx}.png`;
                                link.click();
                              }}
                              className="px-3 py-1 bg-cyber-accent text-black font-bold text-xs rounded hover:bg-white transition-colors"
                            >
                              SAVE
                            </button>
                          </div>
                        </div>

                        {mode === AppMode.TEXTURE && (
                          <button 
                            onClick={() => setTilingImage(url)}
                            className="absolute top-2 right-2 p-2 bg-cyber-900/80 text-white rounded hover:bg-cyber-accent hover:text-black transition-colors opacity-0 group-hover:opacity-100"
                            title="Preview Tiling"
                          >
                            <Grid className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                 </div>
              )}
           </div>

           {/* RPG TEXTURE TOOLS */}
           {mode === AppMode.TEXTURE && (generatedImages.length > 0 || uploadedImage) && (
             <div className="bg-cyber-800 border border-cyber-700 rounded-2xl p-6 mt-6">
                <div className="flex flex-wrap items-center justify-between mb-6 border-b border-cyber-700 pb-4 gap-4">
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <Activity className="text-cyber-accent" /> RPG Texture Lab
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={handleGenerateMaps}
                      disabled={isGeneratingMaps}
                      className="flex items-center px-3 py-2 bg-cyber-600 hover:bg-cyber-500 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                      {isGeneratingMaps ? <RefreshCw className="w-3 h-3 animate-spin mr-2"/> : <Activity className="w-3 h-3 mr-2"/>}
                      Gen PBR Maps
                    </button>
                    <button 
                      onClick={handleGenerateHeight}
                      disabled={isGeneratingHeight}
                      className="flex items-center px-3 py-2 bg-cyan-800 hover:bg-cyan-700 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                      {isGeneratingHeight ? <RefreshCw className="w-3 h-3 animate-spin mr-2"/> : <Mountain className="w-3 h-3 mr-2"/>}
                      Gen Height (Opt)
                    </button>
                    <button 
                       onClick={() => setShowPBRPreview(true)}
                       disabled={isGeneratingMaps || isGeneratingHeight}
                       className="flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3 mr-2" /> 3D View
                    </button>
                    <button
                        onClick={() => setShowBridgeModal(true)}
                        className="flex items-center px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold text-white transition-colors"
                    >
                        <Code className="w-3 h-3 mr-2" /> Bridge
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                   {/* Base */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Base</span>
                      </div>
                      <img src={generatedImages[0] || (uploadedImage ? `data:${uploadedImage.mimeType};base64,${uploadedImage.data}` : '')} className="w-full h-20 object-cover rounded border border-gray-700" />
                   </div>

                   {/* Normal */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-purple-400 font-bold uppercase">Normal</span>
                        <div className="flex gap-1">
                          {pbrMaps.normal && <Download className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { const a = document.createElement('a'); a.href = pbrMaps.normal!; a.download = 'normal.png'; a.click(); }} />}
                          {pbrMaps.normal && <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => handleDeleteMap('normal')} />}
                        </div>
                      </div>
                      {pbrMaps.normal ? (
                        <img src={pbrMaps.normal} className="w-full h-20 object-cover rounded border border-purple-900/50" />
                      ) : <div className="w-full h-20 bg-cyber-950 rounded flex items-center justify-center text-cyber-800 text-xs">Waiting</div>}
                   </div>

                   {/* Roughness */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-green-400 font-bold uppercase">Rough</span>
                        <div className="flex gap-1">
                            {pbrMaps.roughness && <Download className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { const a = document.createElement('a'); a.href = pbrMaps.roughness!; a.download = 'roughness.png'; a.click(); }} />}
                            {pbrMaps.roughness && <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => handleDeleteMap('roughness')} />}
                        </div>
                      </div>
                      {pbrMaps.roughness ? (
                        <img src={pbrMaps.roughness} className="w-full h-20 object-cover rounded border border-green-900/50" />
                      ) : <div className="w-full h-20 bg-cyber-950 rounded flex items-center justify-center text-cyber-800 text-xs">Waiting</div>}
                   </div>
                   
                   {/* Metallic */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-blue-400 font-bold uppercase">Metal</span>
                        <div className="flex gap-1">
                            {pbrMaps.metallic && <Download className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { const a = document.createElement('a'); a.href = pbrMaps.metallic!; a.download = 'metallic.png'; a.click(); }} />}
                            {pbrMaps.metallic && <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => handleDeleteMap('metallic')} />}
                        </div>
                      </div>
                      {pbrMaps.metallic ? (
                        <img src={pbrMaps.metallic} className="w-full h-20 object-cover rounded border border-blue-900/50" />
                      ) : <div className="w-full h-20 bg-cyber-950 rounded flex items-center justify-center text-cyber-800 text-xs">Waiting</div>}
                   </div>

                   {/* Occlusion */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">AO</span>
                        <div className="flex gap-1">
                            {pbrMaps.occlusion && <Download className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { const a = document.createElement('a'); a.href = pbrMaps.occlusion!; a.download = 'occlusion.png'; a.click(); }} />}
                            {pbrMaps.occlusion && <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => handleDeleteMap('occlusion')} />}
                        </div>
                      </div>
                      {pbrMaps.occlusion ? (
                        <img src={pbrMaps.occlusion} className="w-full h-20 object-cover rounded border border-emerald-900/50" />
                      ) : <div className="w-full h-20 bg-cyber-950 rounded flex items-center justify-center text-cyber-800 text-xs">Waiting</div>}
                   </div>

                   {/* Height */}
                   <div className="bg-cyber-900 rounded-lg p-2 border border-cyber-700 relative">
                      {isGeneratingHeight && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded z-10">
                              <RefreshCw className="w-4 h-4 animate-spin text-white"/>
                          </div>
                      )}
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-yellow-400 font-bold uppercase">Height</span>
                        <div className="flex gap-1">
                            {pbrMaps.height && <Download className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { const a = document.createElement('a'); a.href = pbrMaps.height!; a.download = 'height.png'; a.click(); }} />}
                            {pbrMaps.height && <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => handleDeleteMap('height')} />}
                        </div>
                      </div>
                      {pbrMaps.height ? (
                        <img src={pbrMaps.height} className="w-full h-20 object-cover rounded border border-yellow-900/50" />
                      ) : <div className="w-full h-20 bg-cyber-950 rounded flex items-center justify-center text-cyber-800 text-xs text-center p-1">Optional<br/>(Click Gen)</div>}
                   </div>
                </div>

                {/* HDRP Mask Packer */}
                <div className="mt-4 pt-4 border-t border-cyber-700 flex justify-between items-center">
                   <div className="text-xs text-gray-400">
                     <strong>Unity HDRP Mask Map:</strong><br/>
                     <span className="text-red-400">R: Metal</span> | 
                     <span className="text-green-400"> G: AO</span> | 
                     <span className="text-blue-400"> B: Empty</span> | 
                     <span className="text-white"> A: Smooth</span>
                   </div>
                   <button 
                     onClick={handleHDRPPack}
                     className="flex items-center px-4 py-2 bg-cyber-700 hover:bg-cyber-600 border border-cyber-500 rounded-lg text-sm text-cyber-accent hover:text-white transition-colors"
                   >
                     <Package className="w-4 h-4 mr-2" /> Download HDRP Mask
                   </button>
                </div>
             </div>
           )}

        </div>
      </div>

      {/* Tiling Modal */}
      {tilingImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setTilingImage(null)}>
           <div className="w-full max-w-4xl h-[80vh] bg-cyber-800 rounded-2xl overflow-hidden border border-cyber-600 flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-cyber-700 flex justify-between items-center">
               <h3 className="text-white font-display">Texture Tiling Preview</h3>
               <button onClick={() => setTilingImage(null)}><X className="text-gray-400 hover:text-white" /></button>
             </div>
             <div className="flex-1 relative overflow-hidden">
               <div 
                 className="absolute inset-0"
                 style={{
                   backgroundImage: `url(${tilingImage})`,
                   backgroundRepeat: 'repeat',
                   backgroundSize: '256px',
                 }}
               />
             </div>
           </div>
        </div>
      )}

      {/* PBR Preview Modal */}
      {showPBRPreview && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowPBRPreview(false)}>
          <div className="w-full max-w-5xl h-[80vh] bg-cyber-900 rounded-2xl overflow-hidden border border-cyber-500 flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <button onClick={() => setShowPBRPreview(false)} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-white hover:bg-red-500"><X className="w-5 h-5" /></button>
             
             {/* Map Controls Overlay */}
             <div className="absolute top-4 left-4 z-20 bg-cyber-900/80 p-4 rounded-xl border border-cyber-600 backdrop-blur shadow-xl">
                <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers className="w-3 h-3"/> Active Maps
                </h4>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                        <span className={`text-xs ${pbrMaps.normal ? 'text-purple-400' : 'text-gray-600'}`}>Normal</span>
                        {pbrMaps.normal && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleDeleteMap('normal')} />}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className={`text-xs ${pbrMaps.roughness ? 'text-green-400' : 'text-gray-600'}`}>Roughness</span>
                        {pbrMaps.roughness && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleDeleteMap('roughness')} />}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className={`text-xs ${pbrMaps.metallic ? 'text-blue-400' : 'text-gray-600'}`}>Metallic</span>
                        {pbrMaps.metallic && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleDeleteMap('metallic')} />}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className={`text-xs ${pbrMaps.occlusion ? 'text-emerald-400' : 'text-gray-600'}`}>Occlusion</span>
                        {pbrMaps.occlusion && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleDeleteMap('occlusion')} />}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className={`text-xs ${pbrMaps.height ? 'text-yellow-400' : 'text-gray-600'}`}>Height</span>
                        {pbrMaps.height && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-300" onClick={() => handleDeleteMap('height')} />}
                    </div>
                </div>
             </div>

             <PBRPreview 
                colorMap={generatedImages[0] || (uploadedImage ? `data:${uploadedImage.mimeType};base64,${uploadedImage.data}` : '')}
                normalMap={pbrMaps.normal}
                roughnessMap={pbrMaps.roughness}
                metallicMap={pbrMaps.metallic}
                aoMap={pbrMaps.occlusion}
                heightMap={pbrMaps.height}
             />
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-xs text-white pointer-events-none">
                Left Click: Orbit | Scroll: Zoom | Studio Environment
             </div>
          </div>
        </div>
      )}

      {/* Bridge Modal */}
      {showBridgeModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowBridgeModal(false)}>
            <div className="bg-cyber-800 border border-cyber-600 rounded-2xl p-8 w-full max-w-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-cyber-600 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-600 rounded-lg"><Code className="text-white" /></div>
                        <h2 className="text-2xl font-bold text-white">3D App Bridge</h2>
                    </div>
                    <button onClick={() => setShowBridgeModal(false)}><X className="text-gray-500 hover:text-white" /></button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-cyber-accent">Software Scripts</h3>
                        <p className="text-sm text-gray-400">Download the helper script for your 3D software.</p>
                        
                        <div className="flex gap-2">
                           <button 
                               onClick={() => downloadScript(BLENDER_ADDON_SCRIPT, 'neurogen_bridge.py')}
                               className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg border border-gray-500 flex items-center justify-center text-xs"
                           >
                               <Download className="w-3 h-3 mr-2" /> Blender Addon
                           </button>
                           <button 
                               onClick={() => downloadScript(UNITY_BRIDGE_SCRIPT, 'NeuroGenBridge.cs')}
                               className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg border border-gray-500 flex items-center justify-center text-xs"
                           >
                               <Download className="w-3 h-3 mr-2" /> Unity Script
                           </button>
                        </div>
                        <p className="text-xs text-gray-500 italic">
                           Unity: Place in `Assets/Editor` folder.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-cyber-accent">Assets</h3>
                        <p className="text-sm text-gray-400">
                            Download all generated maps. Files are automatically named for the Bridge scripts to detect.
                        </p>
                        <button 
                            onClick={downloadProjectFiles}
                            className="w-full py-3 bg-cyber-600 hover:bg-cyber-500 text-white font-bold rounded-lg flex items-center justify-center"
                        >
                            <Package className="w-4 h-4 mr-2" /> Download All Maps
                        </button>
                    </div>
                </div>

                <div className="mt-8 bg-black/30 p-4 rounded-lg border border-cyber-700/50 text-sm text-gray-400">
                    <h4 className="font-bold text-white mb-2">Instructions:</h4>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Blender:</strong> Install addon, open Sidebar (N) &gt; NeuroGen, select texture folder, refresh & apply.</li>
                        <li><strong>Unity:</strong> Put script in `Editor` folder. Open `Window &gt; NeuroGen Bridge`. Point to texture folder (inside Assets). Click Refresh & Create Material.</li>
                    </ul>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Generator;
