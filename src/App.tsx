/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Mic, MicOff, Volume2, VolumeX, Languages, Sparkles, User, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioRecorder, AudioStreamer } from './lib/audio-utils';
import { cn } from './lib/utils';

const SYSTEM_INSTRUCTION = `
You are a professional voice agent for Jiandi Chi. 
Your tone is calm, female, and highly professional.
You are bilingual in English and French. You should respond in the language the user speaks to you in, or switch if requested.

About Jiandi Chi:
- Education: ESMOD Fashion Business Paris (Responsable de Stratégie et Communication Mode), IED Firenze (Marketing and Communication).
- Experience: 
  - FUL Magazine (Florence): Editorial research and strategic content for social media.
  - Gritti Venetia: Strategic reflection on brand extensions (home fragrance and domestic luxury).
  - Mugler Paris: Showroom Assistant, styling, and client relations.
  - Brandy Melville Paris: Sales and visual merchandising.
- Skills: Marketing strategy, social media, product positioning, data analysis, visual arts, photography, fashion techniques (Python, HTML, Adobe Suite, Excel).
- Languages: English (Native), Mandarin (Native), French (Fluent).

Your goal is to represent Jiandi professionally, answering questions about her background, experiences, and skills. 
If asked about her availability or personal contact details, refer to the information provided (32 Avenue George V, annechi723@gmail.com, +33 6 84 64 12 48).
Be helpful, sophisticated, and articulate.
`;

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const sessionRef = useRef<any>(null);

  const stopSession = useCallback(() => {
    if (audioRecorderRef.current) audioRecorderRef.current.stop();
    if (audioStreamerRef.current) audioStreamerRef.current.stop();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
  }, []);

  const startSession = async () => {
    if (isActive || isConnecting) return;
    
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      audioStreamerRef.current = new AudioStreamer(24000);
      await audioStreamerRef.current.start();

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            console.log("Live session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  audioStreamerRef.current?.addPCMChunk(part.inlineData.data);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              // Handle interruption if needed
            }

            // Handle transcriptions
            if (message.serverContent?.modelTurn?.parts) {
               const text = message.serverContent.modelTurn.parts.find(p => p.text)?.text;
               if (text) setTranscript(prev => prev + " " + text);
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: (error) => {
            console.error("Live session error:", error);
            stopSession();
          }
        }
      });

      sessionRef.current = session;

      audioRecorderRef.current = new AudioRecorder((base64Data) => {
        if (!isMuted && sessionRef.current) {
          try {
            sessionRef.current.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          } catch (e) {
            console.error("Failed to send audio data:", e);
          }
        }
      });
      await audioRecorderRef.current.start();

    } catch (error) {
      console.error("Failed to start session:", error);
      stopSession();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 -z-10 bg-paper">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gold/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-ink/5 blur-[120px]" />
      </div>

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center space-y-12"
      >
        <header className="space-y-4">
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-ink/10 text-[10px] uppercase tracking-[0.2em] font-medium text-ink/60"
          >
            <Sparkles size={12} className="text-gold" />
            Jiandi Chi • Voice Concierge
          </motion.div>
          <h1 className="text-6xl md:text-8xl font-serif font-light tracking-tight text-ink leading-none">
            Jiandi <span className="italic text-gold">Chi</span>
          </h1>
          <p className="text-sm uppercase tracking-[0.15em] text-ink/40 font-medium">
            Fashion Business • Marketing • Communication
          </p>
        </header>

        {/* Interaction Area */}
        <div className="relative flex flex-col items-center justify-center py-12">
          <AnimatePresence mode="wait">
            {!isActive ? (
              <motion.button
                key="start"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                onClick={startSession}
                disabled={isConnecting}
                className="group relative w-32 h-32 rounded-full border border-ink/10 flex items-center justify-center transition-all hover:border-gold/50 hover:bg-gold/5 disabled:opacity-50"
              >
                <div className="absolute inset-0 rounded-full border border-gold/20 animate-ping opacity-20 group-hover:opacity-40" />
                {isConnecting ? (
                  <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mic size={32} className="text-ink group-hover:text-gold transition-colors" />
                )}
              </motion.button>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.1, 0.3, 0.1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-gold"
                  />
                  <div className="relative w-32 h-32 rounded-full border border-gold/30 flex items-center justify-center bg-paper shadow-xl">
                    <Volume2 size={32} className="text-gold animate-pulse" />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={toggleMute}
                    className={cn(
                      "p-4 rounded-full border transition-all",
                      isMuted ? "bg-red-50 border-red-200 text-red-500" : "bg-paper border-ink/10 text-ink hover:border-gold/50"
                    )}
                  >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button
                    onClick={stopSession}
                    className="px-8 py-4 rounded-full bg-ink text-paper text-xs uppercase tracking-widest font-semibold hover:bg-gold transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 border border-ink/5 rounded-2xl bg-white/50 backdrop-blur-sm">
            <Languages size={18} className="text-gold mb-4" />
            <h3 className="text-xs uppercase tracking-widest font-bold mb-2">Bilingual</h3>
            <p className="text-sm text-ink/60 leading-relaxed">Fluent in English & French, with native Mandarin proficiency.</p>
          </div>
          <div className="p-6 border border-ink/5 rounded-2xl bg-white/50 backdrop-blur-sm">
            <Briefcase size={18} className="text-gold mb-4" />
            <h3 className="text-xs uppercase tracking-widest font-bold mb-2">Expertise</h3>
            <p className="text-sm text-ink/60 leading-relaxed">Specialized in luxury brand strategy and fashion marketing.</p>
          </div>
          <div className="p-6 border border-ink/5 rounded-2xl bg-white/50 backdrop-blur-sm">
            <User size={18} className="text-gold mb-4" />
            <h3 className="text-xs uppercase tracking-widest font-bold mb-2">Professional</h3>
            <p className="text-sm text-ink/60 leading-relaxed">Calm, articulate, and ready to discuss professional opportunities.</p>
          </div>
        </div>

        <footer className="pt-12 text-[10px] uppercase tracking-[0.2em] text-ink/30 font-medium">
          © 2026 Jiandi Chi • Paris • Florence
        </footer>
      </motion.div>
    </div>
  );
}
