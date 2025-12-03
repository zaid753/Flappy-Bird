import React, { useState, useEffect } from 'react';
import { Upload, Wand2, Loader2, Play } from 'lucide-react';
import { generateImage, generateSoundEffect, decodeGeminiAudio } from '../services/gemini';

interface AssetPanelProps {
  label: string;
  type: 'image' | 'audio';
  currentSrc: string | null; // For images, this is the URL. For audio, visual feedback only.
  onAssetChange: (url: string, audioBuffer?: AudioBuffer) => void;
  audioContext: AudioContext | null;
  placeholder?: string;
}

const AssetPanel: React.FC<AssetPanelProps> = ({ 
  label, 
  type, 
  currentSrc, 
  onAssetChange, 
  audioContext,
  placeholder = "Describe your asset..."
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key for localStorage based on the label to keep inputs unique
  const storageKey = `asset-prompt-${label.replace(/\s+/g, '-').toLowerCase()}`;

  // Load saved prompt from localStorage on mount
  useEffect(() => {
    const savedPrompt = localStorage.getItem(storageKey);
    if (savedPrompt) {
      setPrompt(savedPrompt);
    }
  }, [storageKey]);

  // Handle prompt change and save to localStorage
  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setPrompt(newValue);
    localStorage.setItem(storageKey, newValue);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      if (type === 'image') {
        const url = URL.createObjectURL(file);
        onAssetChange(url);
      } else {
        // Audio File Upload
        if (!audioContext) {
          throw new Error("Audio system not ready. Please click anywhere on the page to initialize audio, then try uploading again.");
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        onAssetChange(file.name, audioBuffer);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to decode audio file. Please try a different format (MP3/WAV).");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!process.env.API_KEY) {
      setError("API Key not found in environment.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      if (type === 'image') {
        const base64Image = await generateImage(prompt);
        onAssetChange(base64Image);
      } else {
        if (!audioContext) {
           throw new Error("Audio system not ready. Please click anywhere on the page to initialize audio.");
        }
        const base64Audio = await generateSoundEffect(prompt);
        const audioBuffer = await decodeGeminiAudio(base64Audio, audioContext);
        onAssetChange('Generated Sound', audioBuffer);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Generation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">{label}</h3>
        {type === 'image' && currentSrc && !isLoading && (
          <img src={currentSrc} alt="Preview" className="w-8 h-8 rounded border border-slate-500 object-cover" />
        )}
        {type === 'audio' && currentSrc && !isLoading && (
             <span className="text-xs text-green-400">Ready</span>
        )}
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <input 
          type="text" 
          value={prompt}
          onChange={handlePromptChange}
          placeholder={placeholder}
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-slate-500"
        />
        <button 
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded transition-colors"
          title="Generate with AI"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-slate-800 text-slate-500">OR UPLOAD</span>
        </div>
      </div>

      <label className={`flex items-center justify-center w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded cursor-pointer transition-colors group ${isLoading ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-600'}`}>
        {isLoading ? (
             <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-400" />
        ) : (
             <Upload className="w-4 h-4 mr-2 text-slate-400 group-hover:text-white" />
        )}
        <span className="text-xs text-slate-400 group-hover:text-white">
            {isLoading ? 'Processing...' : 'Choose File'}
        </span>
        <input 
          type="file" 
          className="hidden" 
          accept={type === 'image' ? "image/*" : "audio/*"}
          onChange={handleFileUpload}
          disabled={isLoading}
        />
      </label>
    </div>
  );
};

export default AssetPanel;