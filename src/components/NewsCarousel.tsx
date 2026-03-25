import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ExternalLink, 
  TrendingUp, 
  Newspaper,
  Loader2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  category: string;
  image?: string;
}

interface NewsCarouselProps {
  onClose: () => void;
}

const STORY_DURATION = 8000; // 8 seconds per story

export function NewsCarousel({ onClose }: NewsCarouselProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadNews = async () => {
      try {
        const CACHE_KEY = 'fintrack_news_cache_v6'; // Incremented version to clear cache
        const CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours
        
        // 1. Check Local Storage Cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION && data && data.length > 0) {
            if (isMounted) {
              setNews(data);
              setLoading(false);
              return;
            }
          }
        }

        // 2. Check Firestore Cache
        console.log("Checking Firestore for news...");
        const newsDocRef = doc(db, 'system_news', 'latest');
        let firestoreData: any = null;
        try {
          const newsSnap = await getDoc(newsDocRef);
          if (newsSnap.exists()) {
            firestoreData = newsSnap.data();
            const lastUpdate = new Date(firestoreData.updatedAt).getTime();
            if (Date.now() - lastUpdate < CACHE_DURATION && firestoreData.items?.length > 0) {
              console.log("Serving news from Firestore cache");
              if (isMounted) {
                setNews(firestoreData.items);
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                  timestamp: Date.now(),
                  data: firestoreData.items
                }));
                setLoading(false);
                return;
              }
            }
          }
        } catch (dbErr) {
          console.warn("Firestore read failed, falling back to Gemini:", dbErr);
        }

        // 3. Fetch from Gemini (Frontend)
        console.log("Fetching fresh news from Gemini API...");
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
          console.warn("Gemini API key not found in frontend. Trying server fallback.");
          const response = await fetch('/api/news');
          if (response.ok) {
            const data = await response.json();
            const items = data.items || data;
            if (items && items.length > 0) {
              if (isMounted) {
                setNews(items);
                localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: items }));
                setLoading(false);
                return;
              }
            }
          }
          throw new Error("Gemini API key missing and server fallback failed");
        }

        const ai = new GoogleGenAI({ apiKey });
        const genResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: "Busque as 5 notícias mais importantes e recentes sobre economia e investimentos no Brasil. Retorne estritamente em JSON.",
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  source: { type: Type.STRING },
                  category: { type: Type.STRING }
                },
                required: ["title", "summary", "source", "category"]
              }
            }
          }
        });

        const rawItems = JSON.parse(genResponse.text || "[]");
        const items = rawItems.map((item: any) => ({
          ...item,
          image: `https://picsum.photos/seed/${encodeURIComponent(item.title)}/800/1200`
        }));

        if (items.length === 0) throw new Error("No news items returned from Gemini");

        if (isMounted) {
          setNews(items);
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: items
          }));
        }

        // 4. Save to Firestore (Shared Cache)
        try {
          await setDoc(newsDocRef, {
            items,
            updatedAt: new Date().toISOString()
          });
          console.log("News saved to Firestore for other users");
        } catch (saveErr) {
          console.warn("Could not save news to Firestore (likely permission denied):", saveErr);
        }

      } catch (error) {
        console.error("News fetch error:", error);
        if (isMounted) {
          setNews([{
            title: "Mercado Financeiro",
            summary: "Acompanhe as principais notícias do dia.",
            source: "FinTrack",
            category: "Geral",
            image: "https://picsum.photos/seed/economy/800/1200"
          }]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNews();
    return () => { isMounted = false; };
  }, []);

  // Use a ref for onClose to avoid re-triggering effects
  const onCloseRef = React.useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (loading || isPaused || news.length === 0) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < news.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            onCloseRef.current();
            return 100;
          }
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [loading, currentIndex, news.length, isPaused]);

  const nextStory = useCallback(() => {
    if (currentIndex < news.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onCloseRef.current();
    }
  }, [currentIndex, news.length]);

  const prevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextStory();
      } else if (e.key === 'ArrowLeft') {
        prevStory();
      } else if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStory, prevStory]);

  if (news.length === 0 && !loading) {
    onClose();
    return null;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-center text-white p-6">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-stone-400 font-medium animate-pulse">Buscando as últimas notícias do mercado...</p>
      </div>
    );
  }

  const currentNews = news[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      {/* Background Image with Blur */}
      <div className="absolute inset-0 opacity-40 blur-3xl scale-110">
        <img 
          src={currentNews.image} 
          alt="" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative w-full max-w-md h-full md:h-[85vh] md:rounded-3xl overflow-hidden bg-stone-900 shadow-2xl flex flex-col">
        {/* Navigation Areas (50/50) - Entire Screen Coverage */}
        <div className="absolute inset-0 z-50 flex">
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors cursor-pointer" 
            onClick={(e) => { e.stopPropagation(); prevStory(); }} 
          />
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors cursor-pointer" 
            onClick={(e) => { e.stopPropagation(); nextStory(); }} 
          />
        </div>

        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-[60] flex gap-1 p-4 pointer-events-none">
          {news.map((_, idx) => (
            <div key={`progress-bar-${idx}`} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                key={`progress-fill-${idx}`}
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 z-[60] flex items-center justify-between px-4 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">FinTrack Insights</p>
              <p className="text-[10px] text-white/60 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Agora
              </p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all pointer-events-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 relative"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <img 
                src={currentNews.image} 
                alt={currentNews.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* Text Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 z-[60] space-y-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={`text-${currentIndex}`}
              className="space-y-3"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase tracking-widest">
                {currentNews.category}
              </span>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {currentNews.title}
              </h2>
              <p className="text-stone-300 text-sm leading-relaxed">
                {currentNews.summary}
              </p>
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-stone-400 font-medium flex items-center gap-2">
                  <Newspaper className="w-3 h-3" /> Fonte: {currentNews.source}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-stone-900 border-t border-stone-800 flex items-center justify-between z-[60] relative pointer-events-none">
          <div className="flex gap-1 pointer-events-auto">
            {news.map((_, idx) => (
              <div 
                key={`dot-${idx}`} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  idx === currentIndex ? "bg-emerald-500 w-4" : "bg-stone-700"
                )} 
              />
            ))}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center gap-2 text-sm font-bold text-stone-400 hover:text-white transition-colors relative z-[70] pointer-events-auto"
          >
            Pular para o Dashboard <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
