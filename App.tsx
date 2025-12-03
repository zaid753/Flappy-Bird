import React, { useState, useEffect, useRef } from 'react';
import Game from './components/Game';
import AssetPanel from './components/AssetPanel';
import { Gamepad2, Trophy, RotateCcw, Play } from 'lucide-react';

// Default Assets (Base64 SVGs)
const DEFAULT_BIRD = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSI1IiB5PSIxMCIgd2lkdGg9IjI1IiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmJiZjI0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjxyZWN0IHg9IjIwIiB5PSI1IiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iMjQiIHk9IjkiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMwMDAiLz48cmVjdCB4PSIyNCIgeT0iMjIiIHdpZHRoPSIxMiIgaGVpZ2h0PSI4IiBmaWxsPSIjZjk3MzE2IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjxyZWN0IHg9IjAiIHk9IjE4IiB3aWR0aD0iMTAiIGhlaWdodD0iOCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=";

const DEFAULT_PIPE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMyMmM1NWUiLz48cmVjdCB4PSI0IiB5PSIwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiM0YWRlODAiIGZpbGwtb3BhY2l0eT0iMC41Ii8+PHJlY3QgeD0iNTIiIHk9IjAiIHdpZHRoPSI0IiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzE0NTMyZCIgZmlsbC1vcGFjaXR5PSIwLjMiLz48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNDAwIiBmaWxsPSJub25lIiBzdHJva2U9IiMxNDUzMmQiIHN0cm9rZS13aWR0aD0iNCIvPjwvc3ZnPg==";

const App: React.FC = () => {
  // Game State
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  // High Score with Local Storage Persistence
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('genai-flappy-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Asset State
  const [birdImage, setBirdImage] = useState<string | null>(DEFAULT_BIRD);
  const [birdImageElement, setBirdImageElement] = useState<HTMLImageElement | null>(null);

  const [topPipeImage, setTopPipeImage] = useState<string | null>(DEFAULT_PIPE);
  const [topPipeImageElement, setTopPipeImageElement] = useState<HTMLImageElement | null>(null);

  const [bottomPipeImage, setBottomPipeImage] = useState<string | null>(DEFAULT_PIPE);
  const [bottomPipeImageElement, setBottomPipeImageElement] = useState<HTMLImageElement | null>(null);
  
  // Audio Context & Buffers
  const audioContextRef = useRef<AudioContext | null>(null);
  // We use this state to trigger a re-render when the audio context is initialized,
  // ensuring child components receive the actual context instance instead of null.
  const [isAudioReady, setIsAudioReady] = useState(false);

  const [jumpSound, setJumpSound] = useState<AudioBuffer | null>(null);
  const [scoreSound, setScoreSound] = useState<AudioBuffer | null>(null);
  const [crashSound, setCrashSound] = useState<AudioBuffer | null>(null);
  
  // Track if audio assets are set visually
  const [hasJump, setHasJump] = useState(false);
  const [hasScore, setHasScore] = useState(false);
  const [hasCrash, setHasCrash] = useState(false);

  // Initialize AudioContext
  useEffect(() => {
    const initAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            setIsAudioReady(true);
        } else if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    window.addEventListener('touchstart', initAudio);

    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
        window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  // Preload Bird Image
  useEffect(() => {
    if (birdImage) {
      const img = new Image();
      img.src = birdImage;
      img.onload = () => setBirdImageElement(img);
    } else {
      setBirdImageElement(null);
    }
  }, [birdImage]);

  // Preload Top Pipe Image
  useEffect(() => {
    if (topPipeImage) {
      const img = new Image();
      img.src = topPipeImage;
      img.onload = () => setTopPipeImageElement(img);
    } else {
      setTopPipeImageElement(null);
    }
  }, [topPipeImage]);

  // Preload Bottom Pipe Image
  useEffect(() => {
    if (bottomPipeImage) {
      const img = new Image();
      img.src = bottomPipeImage;
      img.onload = () => setBottomPipeImageElement(img);
    } else {
      setBottomPipeImageElement(null);
    }
  }, [bottomPipeImage]);

  const handleStartGame = () => {
    setIsGameOver(false);
    setIsPlaying(true);
    setScore(0);
    // Ensure audio context is running
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleGameOver = (finalScore: number) => {
    setIsPlaying(false);
    setIsGameOver(true);
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('genai-flappy-highscore', finalScore.toString());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Asset Customization */}
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 h-auto md:h-screen overflow-y-auto z-10">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-600 rounded-lg">
                <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="font-bold text-xl leading-none">GenAI</h1>
                <h2 className="text-indigo-400 text-sm font-bold tracking-widest">FLAPPY</h2>
            </div>
        </div>

        <div className="space-y-4">
            <p className="text-xs text-slate-400 mb-2">CUSTOMIZE ASSETS (AI OR UPLOAD)</p>
            
            <AssetPanel 
                label="Bird Avatar" 
                type="image" 
                currentSrc={birdImage}
                audioContext={audioContextRef.current}
                onAssetChange={(url) => setBirdImage(url)}
                placeholder="Pixel art flying bird..."
            />

            <AssetPanel 
                label="Top Pipe Texture" 
                type="image" 
                currentSrc={topPipeImage}
                audioContext={audioContextRef.current}
                onAssetChange={(url) => setTopPipeImage(url)}
                placeholder="Vertical pipe, vines..."
            />

            <AssetPanel 
                label="Bottom Pipe Texture" 
                type="image" 
                currentSrc={bottomPipeImage}
                audioContext={audioContextRef.current}
                onAssetChange={(url) => setBottomPipeImage(url)}
                placeholder="Vertical pipe, brick..."
            />

            <AssetPanel 
                label="Jump Sound" 
                type="audio" 
                currentSrc={hasJump ? "set" : null}
                audioContext={audioContextRef.current}
                onAssetChange={(_, buffer) => {
                    if (buffer) {
                        setJumpSound(buffer);
                        setHasJump(true);
                    }
                }}
                placeholder="Retro jump 8-bit..."
            />

            <AssetPanel 
                label="Score Sound" 
                type="audio" 
                currentSrc={hasScore ? "set" : null}
                audioContext={audioContextRef.current}
                onAssetChange={(_, buffer) => {
                    if (buffer) {
                        setScoreSound(buffer);
                        setHasScore(true);
                    }
                }}
                placeholder="Coin pickup ping..."
            />

            <AssetPanel 
                label="Crash Sound" 
                type="audio" 
                currentSrc={hasCrash ? "set" : null}
                audioContext={audioContextRef.current}
                onAssetChange={(_, buffer) => {
                    if (buffer) {
                        setCrashSound(buffer);
                        setHasCrash(true);
                    }
                }}
                placeholder="Explosion hit..."
            />
        </div>
        
        <div className="mt-auto pt-6 text-xs text-slate-500">
            Powered by Gemini 2.5 Flash & Native Audio
        </div>
      </aside>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-10 bg-slate-950 relative">
        
        {/* Header Stats */}
        <div className="absolute top-6 flex gap-12 text-center z-10">
            <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Score</p>
                <p className="text-4xl font-black text-white drop-shadow-lg">{score}</p>
            </div>
            <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-500" /> Best
                </p>
                <p className="text-4xl font-black text-yellow-500 drop-shadow-lg">{highScore}</p>
            </div>
        </div>

        {/* Game Container */}
        <div className="relative">
            <Game 
                birdImageElement={birdImageElement}
                topPipeImageElement={topPipeImageElement}
                bottomPipeImageElement={bottomPipeImageElement}
                jumpSoundBuffer={jumpSound}
                scoreSoundBuffer={scoreSound}
                crashSoundBuffer={crashSound}
                isPlaying={isPlaying}
                onGameOver={handleGameOver}
                audioContext={audioContextRef.current}
            />

            {/* Overlay for Menu */}
            {(!isPlaying || isGameOver) && (
                <div className="absolute inset-0 bg-slate-900/90 rounded-lg flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm z-20">
                    {isGameOver ? (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <h2 className="text-4xl font-black text-red-500 mb-6 drop-shadow-md tracking-wider">GAME OVER</h2>
                            
                            <div className="flex gap-6 mb-8">
                                <div 
                                    className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 min-w-[120px] shadow-lg opacity-0"
                                    style={{ animation: 'fadeInUp 0.6s ease-out forwards 0.2s' }}
                                >
                                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Score</p>
                                    <p className="text-4xl font-bold text-white">{score}</p>
                                </div>
                                <div 
                                    className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 min-w-[120px] shadow-lg opacity-0"
                                    style={{ animation: 'fadeInUp 0.6s ease-out forwards 0.4s' }}
                                >
                                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Best</p>
                                    <p className="text-4xl font-bold text-yellow-500">{highScore}</p>
                                </div>
                            </div>
                            
                            <style>{`
                                @keyframes fadeInUp {
                                    from { opacity: 0; transform: translateY(20px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                            `}</style>

                            <button 
                                onClick={handleStartGame}
                                className="group relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-full font-bold text-xl transition-all hover:scale-110 hover:shadow-indigo-500/50 shadow-xl"
                            >
                                <RotateCcw className="w-6 h-6 group-hover:-rotate-180 transition-transform duration-500" /> 
                                <span>RESTART</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-2">READY?</h2>
                            <p className="text-slate-400 text-sm mb-8 max-w-[200px]">
                                Customize your assets on the left, then jump in!
                            </p>
                            <button 
                                onClick={handleStartGame}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-xl animate-pulse"
                            >
                                <Play className="w-5 h-5 fill-current" /> PLAY NOW
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>

        <p className="mt-6 text-slate-500 text-sm">
            Press <span className="text-indigo-400 font-bold">Space</span> or <span className="text-indigo-400 font-bold">Tap</span> to fly
        </p>

      </main>
    </div>
  );
};

export default App;