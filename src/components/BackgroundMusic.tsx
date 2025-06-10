import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = volume;
    
    // Auto-play is restricted by browsers, so we'll wait for user interaction
    const handleUserInteraction = () => {
      if (!isPlaying) {
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.log("Autoplay prevented:", err);
        });
      }
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
    };
  }, [isPlaying, volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.log("Play failed:", err);
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-base-200/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-green-600/30">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="btn btn-circle btn-sm bg-green-600/20 hover:bg-green-600/40 border-green-600/50"
          title={isPlaying ? "Pause jungle music" : "Play jungle music"}
        >
          {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-xs">🎵</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="range range-xs w-16"
          />
        </div>
      </div>
      
      <audio
        ref={audioRef}
        preload="none"
      >
        {/* Using a royalty-free jungle/nature sounds URL */}
        <source src="https://www.soundjay.com/misc/sounds/jungle-1.mp3" type="audio/mpeg" />
        <source src="https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-one/nature_forest_jungle_ambience_birds_insects_daytime_general_01.mp3" type="audio/mpeg" />
        {/* Fallback to a web-accessible nature sound */}
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEeBjig1/LJdCQFF3rI8dyQQwgWYbTr66hbGwh" />
      </audio>
      
      {!isPlaying && (
        <div className="text-xs opacity-60 mt-1">
          🐾 Click to start jungle sounds
        </div>
      )}
    </div>
  );
}