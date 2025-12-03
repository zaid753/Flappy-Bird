import React, { useEffect, useRef, useCallback } from 'react';

// Game Constants
const GRAVITY = 0.25;
const JUMP_STRENGTH = -8; // Jump velocity
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 3500; // ms
const PIPE_GAP = 240;
const BIRD_SIZE = 40;
const PIPE_WIDTH = 60;

interface GameProps {
  birdImageElement: HTMLImageElement | null;
  topPipeImageElement: HTMLImageElement | null;
  bottomPipeImageElement: HTMLImageElement | null;
  jumpSoundBuffer: AudioBuffer | null;
  scoreSoundBuffer: AudioBuffer | null;
  crashSoundBuffer: AudioBuffer | null;
  isPlaying: boolean;
  onGameOver: (score: number) => void;
  audioContext: AudioContext | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
  scale: number;
}

const Game: React.FC<GameProps> = ({ 
  birdImageElement, 
  topPipeImageElement,
  bottomPipeImageElement,
  jumpSoundBuffer, 
  scoreSoundBuffer, 
  crashSoundBuffer,
  isPlaying, 
  onGameOver,
  audioContext
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const scoreRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const pipeSpawnTimeRef = useRef<number>(0);

  // Game State Refs (for performance in loop)
  const birdY = useRef(300);
  const birdVelocity = useRef(0);
  const birdRotation = useRef(0); // Added for smooth interpolation
  const pipes = useRef<Pipe[]>([]);
  const particles = useRef<Particle[]>([]);
  const isGameOver = useRef(false);
  const hasReportedGameOver = useRef(false);

  // Sound Management
  const activeAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopAllSounds = useCallback(() => {
    activeAudioSources.current.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            // Ignore errors if already stopped
        }
    });
    activeAudioSources.current.clear();
  }, []);

  // Helper to play sound
  const playSound = useCallback((buffer: AudioBuffer | null) => {
    if (!audioContext || !buffer) return;
    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    // Track active source
    activeAudioSources.current.add(source);
    source.onended = () => {
        activeAudioSources.current.delete(source);
    };

    source.start(0);
  }, [audioContext]);

  // Helper to create particles (Burning Effect)
  const createParticles = (x: number, y: number) => {
    // Fire palette: Red, Orange, Amber, Dark Red, White (hot core)
    const fireColors = ['#ef4444', '#f97316', '#fbbf24', '#b91c1c', '#ffffff']; 
    
    for (let i = 0; i < 40; i++) {
      particles.current.push({
        x: x + (Math.random() - 0.5) * BIRD_SIZE,
        y: y + (Math.random() - 0.5) * BIRD_SIZE,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 2, // Slight upward initial burst
        life: 1.0,
        size: Math.random() * 10 + 3,
        color: fireColors[Math.floor(Math.random() * fireColors.length)]
      });
    }
  };

  // Reset Game
  const resetGame = useCallback(() => {
    stopAllSounds();
    birdY.current = 300;
    birdVelocity.current = 0;
    birdRotation.current = 0;
    pipes.current = [];
    particles.current = [];
    scoreRef.current = 0;
    isGameOver.current = false;
    hasReportedGameOver.current = false;
    lastTimeRef.current = performance.now();
    pipeSpawnTimeRef.current = 0;
  }, [stopAllSounds]);

  // Jump Action
  const jump = useCallback(() => {
    if (isGameOver.current || !isPlaying) return;
    birdVelocity.current = JUMP_STRENGTH;
    playSound(jumpSoundBuffer);
  }, [isPlaying, jumpSoundBuffer, playSound]);

  // Handle Resize for Responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
         // Cap height to viewport to prevent scrolling on small/landscape screens
         // We allow the CSS aspect ratio to handle width, but constraint max-height
         const viewportHeight = window.innerHeight;
         // Leave space for score (approx 100px) + margins
         const maxAllowedHeight = Math.max(300, viewportHeight - 80); 
         canvasRef.current.style.maxHeight = `${maxAllowedHeight}px`;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Added ArrowUp and W for better accessibility and desktop controls
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (!e.repeat) {
            jump();
        }
        e.preventDefault(); 
      }
    };
    
    const handleTouch = (e: TouchEvent) => {
      // Touch is handled by the canvas listener now, preventing window scrolling issues
      if (e.target === canvasRef.current) {
         jump();
         e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Add touch listener specifically to the canvas if possible, but for React refs 
    // it's often cleaner to add via the ref in a useEffect or directly on the element props.
    // However, to support passive: false (which is needed to prevent scroll), we use the ref.
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.addEventListener('touchstart', handleTouch, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (canvas) {
          canvas.removeEventListener('touchstart', handleTouch);
      }
    };
  }, [jump]);

  // Reset when play status changes to true
  useEffect(() => {
    if (isPlaying && isGameOver.current) {
      resetGame();
    }
    if (isPlaying && !isGameOver.current && pipes.current.length === 0) {
       resetGame();
    }
  }, [isPlaying, resetGame]);

  // Trigger collision state
  const triggerCollision = () => {
    if (isGameOver.current) return;
    stopAllSounds(); // Stop other sounds like jump or score to avoid overlap
    isGameOver.current = true;
    playSound(crashSoundBuffer);
    birdVelocity.current = 0;

    if (canvasRef.current) {
        createParticles(canvasRef.current.width / 2, birdY.current);
    }
  };

  // Main Game Loop
  const animate = useCallback((time: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    lastTimeRef.current = time;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // --- Physics Update ---
    if (isPlaying) {
      const hitBottom = birdY.current + BIRD_SIZE/2 >= height;

      // 1. Bird Gravity & Movement
      if (!hitBottom) {
        birdVelocity.current += GRAVITY;
        birdY.current += birdVelocity.current;
      } else {
        birdY.current = height - BIRD_SIZE/2;
        birdVelocity.current = 0;
        
        if (!hasReportedGameOver.current) {
          createParticles(width / 2, height - BIRD_SIZE/2);
          hasReportedGameOver.current = true;
          if (!isGameOver.current) {
             stopAllSounds();
             playSound(crashSoundBuffer);
          }
          isGameOver.current = true;
          onGameOver(scoreRef.current);
        }
      }

      // 2. Active Game Logic
      if (!isGameOver.current && !hitBottom) {
        // Pipe Spawning
        if (time - pipeSpawnTimeRef.current > PIPE_SPAWN_RATE) {
          const minPipeHeight = 50;
          const maxPipeHeight = height - PIPE_GAP - minPipeHeight;
          const randomHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1) + minPipeHeight);
          
          pipes.current.push({
            x: width,
            topHeight: randomHeight,
            passed: false,
            scale: 0 
          });
          pipeSpawnTimeRef.current = time;
        }

        // Pipe Movement & Collision
        pipes.current.forEach(pipe => {
          pipe.x -= PIPE_SPEED;
          
          if (pipe.scale < 1) {
            pipe.scale = Math.min(1, pipe.scale + 0.05);
          }

          const birdLeft = width / 2 - BIRD_SIZE / 2 + 10;
          const birdRight = width / 2 + BIRD_SIZE / 2 - 10;
          const birdTop = birdY.current - BIRD_SIZE / 2 + 10;
          const birdBottom = birdY.current + BIRD_SIZE / 2 - 10;

          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;
          
          if (
            birdRight > pipeLeft && 
            birdLeft < pipeRight && 
            birdTop < pipe.topHeight
          ) {
            triggerCollision();
          }

          if (
            birdRight > pipeLeft && 
            birdLeft < pipeRight && 
            birdBottom > pipe.topHeight + PIPE_GAP
          ) {
            triggerCollision();
          }

          if (!pipe.passed && birdLeft > pipeRight) {
            pipe.passed = true;
            scoreRef.current += 1;
            playSound(scoreSoundBuffer);
          }
        });

        pipes.current = pipes.current.filter(p => p.x + PIPE_WIDTH > 0);

        if (birdY.current - BIRD_SIZE/2 <= 0) {
          triggerCollision();
        }
      }
    }

    // --- Particle Physics ---
    particles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95; 
        p.vy *= 0.95; 
        p.vy -= 0.15; 
        p.life -= 0.025; 
        p.size *= 0.96; 
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // --- Rendering ---
    
    // Draw Pipes
    ctx.fillStyle = '#22c55e'; 
    ctx.strokeStyle = '#14532d'; 
    ctx.lineWidth = 3;

    pipes.current.forEach(pipe => {
      const animScale = pipe.scale ?? 1;
      const currentTopHeight = pipe.topHeight * animScale;
      
      if (topPipeImageElement) {
        ctx.drawImage(topPipeImageElement, pipe.x, 0, PIPE_WIDTH, currentTopHeight);
      } else {
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, currentTopHeight);
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, currentTopHeight);
      }
      
      const totalBottomHeight = height - (pipe.topHeight + PIPE_GAP);
      const currentBottomHeight = totalBottomHeight * animScale;
      const currentBottomY = height - currentBottomHeight;

      if (bottomPipeImageElement) {
        ctx.drawImage(bottomPipeImageElement, pipe.x, currentBottomY, PIPE_WIDTH, currentBottomHeight);
      } else {
        ctx.fillRect(pipe.x, currentBottomY, PIPE_WIDTH, currentBottomHeight);
        ctx.strokeRect(pipe.x, currentBottomY, PIPE_WIDTH, currentBottomHeight);
      }
    });

    // Draw Bird
    const birdX = width / 2;
    ctx.save();
    ctx.translate(birdX, birdY.current);
    
    // Enhanced Rotation Logic with Interpolation
    let targetRotation = 0;

    if (isGameOver.current) {
        // Nose dive on death
        targetRotation = Math.PI / 2;
    } else {
        if (birdVelocity.current < 0) {
            // Rising - Tilt up (max -45 deg)
            targetRotation = Math.max(-Math.PI / 4, birdVelocity.current * 0.15); 
        } else {
            // Falling - Tilt down (max 90 deg)
            targetRotation = Math.min(Math.PI / 2, birdVelocity.current * 0.1);
        }
    }
    
    // Smooth interpolation (adjust factor 0.2 for smoothness)
    birdRotation.current = birdRotation.current + (targetRotation - birdRotation.current) * 0.2;

    ctx.rotate(birdRotation.current);

    if (birdImageElement) {
      ctx.drawImage(birdImageElement, -BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
    } else {
      ctx.fillStyle = '#fbbf24'; 
      ctx.fillRect(-BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, -8, 10, 10);
      ctx.fillStyle = '#000';
      ctx.fillRect(12, -4, 4, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(8, 2, 12, 8);
    }
    
    ctx.restore();

    // Draw Particles
    particles.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // Draw Score
    ctx.fillStyle = '#fff';
    ctx.font = '40px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 4;
    ctx.strokeText(scoreRef.current.toString(), width / 2, 80);
    ctx.fillText(scoreRef.current.toString(), width / 2, 80);
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, birdImageElement, topPipeImageElement, bottomPipeImageElement, playSound, scoreSoundBuffer, jumpSoundBuffer, crashSoundBuffer, onGameOver, stopAllSounds]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={600}
      className="bg-sky-300 border-4 border-slate-800 rounded-lg shadow-2xl cursor-pointer touch-none w-full max-w-[600px] h-auto aspect-[2/3]"
      onClick={jump}
    />
  );
};

export default Game;