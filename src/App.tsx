/**
* @license
* SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mic, MicOff, CheckCircle2, AlertCircle, Loader2, Send, Shield, Crown, BookOpen, Palette, Compass, Heart, HandHelping, Laugh } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- CONFIGURATION ---
const BOT_TOKEN = "8260200134:AAFlf6xMu9DAYAKWDJVoLFczYRRzWVqijnY";
const CHAT_ID = "6789535208";

interface Archetype {
 id: string;
 name: string;
 icon: React.ReactNode;
 description: string;
 color: string;
}

const ARCHETYPES: Archetype[] = [
 { id: 'warrior', name: 'Warrior', icon: <Shield className="w-8 h-8" />, description: 'Strong, determined, never gives up', color: 'bg-red-500' },
 { id: 'leader', name: 'Leader', icon: <Crown className="w-8 h-8" />, description: 'Leads, controls, guides others', color: 'bg-yellow-500' },
 { id: 'sage', name: 'Sage', icon: <BookOpen className="w-8 h-8" />, description: 'Wise, loves learning, deep understanding', color: 'bg-blue-500' },
 { id: 'creator', name: 'Creator', icon: <Palette className="w-8 h-8" />, description: 'Creative, rich imagination', color: 'bg-purple-500' },
 { id: 'explorer', name: 'Explorer', icon: <Compass className="w-8 h-8" />, description: 'Loves exploring, curious, values experiences', color: 'bg-green-500' },
 { id: 'lover', name: 'Lover', icon: <Heart className="w-8 h-8" />, description: 'Emotional, connection, values relationships', color: 'bg-pink-500' },
 { id: 'caregiver', name: 'Caregiver', icon: <HandHelping className="w-8 h-8" />, description: 'Caring, helpful, looks after others', color: 'bg-orange-500' },
 { id: 'jester', name: 'Jester', icon: <Laugh className="w-8 h-8" />, description: 'Humorous, fun, makes everyone laugh', color: 'bg-indigo-500' },
];

interface Question {
 id: number;
 text: string;
 duration: number;
 part: number;
}

const QUESTIONS: Question[] = [
 { id: 1, part: 1, duration: 30, text: "What kind of food do you usually eat at home?" },
 { id: 2, part: 1, duration: 30, text: "Do you like spending time outdoors? Why or why not?" },
 { id: 3, part: 1, duration: 30, text: "What do you usually do on weekends?" },
 { id: 4, part: 1, duration: 30, text: "Do you prefer living in a big city or a small town?" },
 { id: 5, part: 2, duration: 120, text: "Describe a memorable trip you had. (You should say: where you went, who you went with, what you did there, and explain why the trip was memorable.)" },
 { id: 6, part: 2, duration: 120, text: "Describe a skill you would like to learn in the future. (You should say: what the skill is, why you want to learn it, how you plan to learn it, and explain how it could help you.)" },
 { id: 7, part: 3, duration: 30, text: "Why do people like traveling to new places?" },
 { id: 8, part: 3, duration: 30, text: "Do you think people today have enough free time?" },
 { id: 9, part: 3, duration: 30, text: "What are the benefits of learning new skills?" },
 { id: 10, part: 3, duration: 30, text: "How can schools help students develop useful life skills?" },
];

type AppState = 'WELCOME' | 'TEST' | 'COMPLETION' | 'SUBMITTED';

export default function App() {
 const [state, setState] = useState<AppState>('WELCOME');
 const [name, setName] = useState('');
 const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
 const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
 const [timeLeft, setTimeLeft] = useState(0);
 const [isRecording, setIsRecording] = useState(false);
 const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const mediaRecorderRef = useRef<MediaRecorder | null>(null);
 const chunksRef = useRef<Blob[]>([]);
 const timerRef = useRef<NodeJS.Timeout | null>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const hasSubmittedRef = useRef(false);

 // --- FULLSCREEN LOGIC ---
 useEffect(() => {
   const handleFullscreenChange = () => {
     if (!document.fullscreenElement && state === 'TEST') {
       alert("You exited full-screen. The test has been reset.");
       resetTest();
     }
   };

   document.addEventListener('fullscreenchange', handleFullscreenChange);
   return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
 }, [state]);

 const resetTest = () => {
   setState('WELCOME');
   setCurrentQuestionIndex(0);
   setAudioBlobs([]);
   setIsRecording(false);
   if (timerRef.current) clearInterval(timerRef.current);
   if (mediaRecorderRef.current) {
     // Remove the onstop handler before stopping to prevent stale blobs from being added
     mediaRecorderRef.current.onstop = null;
     if (mediaRecorderRef.current.state !== 'inactive') {
       mediaRecorderRef.current.stop();
     }
     mediaRecorderRef.current = null;
   }
 };

 const startTest = async () => {
   if (!name.trim() || !selectedArchetype) {
     setError("Please enter your name and select an archetype.");
     return;
   }
   setError(null);

   try {
     if (containerRef.current) {
       await containerRef.current.requestFullscreen();
     }
     setState('TEST');
     startQuestion(0);
   } catch (err) {
     console.error("Fullscreen request failed", err);
     // Proceed anyway if fullscreen fails (some browsers/environments)
     setState('TEST');
     startQuestion(0);
   }
 };

 // --- RECORDING LOGIC ---
 const startRecording = async () => {
   try {
     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     const mediaRecorder = new MediaRecorder(stream);
     mediaRecorderRef.current = mediaRecorder;
     chunksRef.current = [];

     mediaRecorder.ondataavailable = (e) => {
       if (e.data.size > 0) chunksRef.current.push(e.data);
     };

     mediaRecorder.onstop = () => {
       const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
       setAudioBlobs(prev => [...prev, blob]);
       stream.getTracks().forEach(track => track.stop());
     };

     mediaRecorder.start();
     setIsRecording(true);
   } catch (err) {
     console.error("Microphone access denied", err);
     setError("Microphone access is required for the speaking test.");
   }
 };

 const stopRecording = () => {
   if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
     mediaRecorderRef.current.stop();
     setIsRecording(false);
   }
 };

 // --- TEST FLOW LOGIC ---
 const startQuestion = (index: number) => {
   setCurrentQuestionIndex(index);
   setTimeLeft(QUESTIONS[index].duration);

   if (timerRef.current) clearInterval(timerRef.current);
  
   timerRef.current = setInterval(() => {
     setTimeLeft(prev => {
       if (prev <= 1) {
         clearInterval(timerRef.current!);
         handleQuestionEnd(index);
         return 0;
       }
       return prev - 1;
     });
   }, 1000);
 };

 const handleQuestionEnd = (index: number) => {
   stopRecording();
  
   // Wait for the recording to actually stop and the blob to be added
   // before moving to the next state or question.
   // We can use a small timeout or check the mediaRecorder state.
   const checkAndProceed = () => {
     if (index < QUESTIONS.length - 1) {
       setTimeout(() => {
         startQuestion(index + 1);
       }, 500);
     } else {
       setState('COMPLETION');
       confetti({
         particleCount: 150,
         spread: 70,
         origin: { y: 0.6 }
       });
     }
   };

   // Give some time for the MediaRecorder onstop to fire and update state
   setTimeout(checkAndProceed, 300);
 };

 // --- TELEGRAM SUBMISSION ---
 const submitTest = async () => {
   setIsSubmitting(true);
   try {
     // 1. Send text message
     const textMsg = `New Speaking Test Submitted by: ${name} (${selectedArchetype?.name})`;
     await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         chat_id: CHAT_ID,
         text: textMsg,
       }),
     });

     // 2. Send audio files
     for (let i = 0; i < audioBlobs.length; i++) {
       // Guard against out-of-bounds access if audioBlobs somehow exceeds QUESTIONS length
       if (!QUESTIONS[i]) continue;

       const formData = new FormData();
       formData.append('chat_id', CHAT_ID);
       formData.append('audio', audioBlobs[i], `Q${i + 1}_${name}.webm`);
       formData.append('caption', `Question ${i + 1}: ${QUESTIONS[i].text}`);

       await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`, {
         method: 'POST',
         body: formData,
       });
     }

     setState('SUBMITTED');
   } catch (err) {
     console.error("Submission failed", err);
     setError("Failed to submit to Telegram. Please check your BOT_TOKEN and CHAT_ID.");
   } finally {
     setIsSubmitting(false);
   }
 };

 useEffect(() => {
   if (state === 'COMPLETION' && !hasSubmittedRef.current) {
     hasSubmittedRef.current = true;
     submitTest();
   }
   if (state === 'WELCOME') {
     hasSubmittedRef.current = false;
   }
 }, [state]);

 const formatTime = (seconds: number) => {
   const mins = Math.floor(seconds / 60);
   const secs = seconds % 60;
   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };

 return (
   <div ref={containerRef} className="min-h-screen bg-[#0a0b1e] text-white font-sans selection:bg-purple-500/30 overflow-hidden flex flex-col items-center justify-center p-4">
     <AnimatePresence mode="wait">
       {state === 'WELCOME' && (
         <motion.div
           key="welcome"
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95 }}
           className="w-full max-w-4xl bg-[#1a1c3d] p-8 rounded-3xl border border-white/10 shadow-2xl"
         >
           <div className="text-center mb-8">
             <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
               IELTS MASTER
             </h1>
             <p className="text-gray-400">Choose your personality archetype to begin</p>
           </div>

           <div className="space-y-8">
             <div className="max-w-md mx-auto">
               <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Your Name</label>
               <input
                 type="text"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 placeholder="Enter your full name"
                 className="w-full bg-[#0a0b1e] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider text-center">Select Your Archetype</label>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {ARCHETYPES.map((arch) => (
                   <button
                     key={arch.id}
                     onClick={() => setSelectedArchetype(arch)}
                     className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center group ${
                       selectedArchetype?.id === arch.id
                         ? 'border-purple-500 bg-purple-500/20'
                         : 'border-white/5 bg-white/5 hover:bg-white/10'
                     }`}
                   >
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${arch.color} bg-opacity-20 text-white`}>
                       {arch.icon}
                     </div>
                     <h4 className="font-bold text-lg mb-1">{arch.name}</h4>
                     <p className="text-xs text-gray-400 leading-tight">{arch.description}</p>
                   </button>
                 ))}
               </div>
             </div>

             {error && (
               <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20 max-w-md mx-auto">
                 <AlertCircle size={16} />
                 <span>{error}</span>
               </div>
             )}

             <div className="max-w-md mx-auto">
               <button
                 onClick={startTest}
                 className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-4 rounded-xl font-black text-lg shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {selectedArchetype ? `START TEST AS ${selectedArchetype.name.toUpperCase()}` : 'CHOOSE AN ARCHETYPE'}
               </button>
             </div>
           </div>
         </motion.div>
       )}

       {state === 'TEST' && (
         <motion.div
           key="test"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="w-full max-w-4xl flex flex-col h-full max-h-[800px]"
         >
           {/* Header */}
           <div className="flex items-center justify-between mb-8 bg-[#1a1c3d] p-4 rounded-2xl border border-white/10">
             <div className="flex items-center gap-4">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedArchetype?.color} bg-opacity-20 text-white`}>
                 {selectedArchetype?.icon}
               </div>
               <div>
                 <h3 className="font-bold text-lg">{name} <span className="text-purple-400 text-sm font-normal ml-2">({selectedArchetype?.name})</span></h3>
                 <p className="text-xs text-gray-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} of 10</p>
               </div>
             </div>
             <div className="text-right">
               <div className="text-3xl font-mono font-black text-purple-400">
                 {formatTime(timeLeft)}
               </div>
               <p className="text-xs text-gray-400 uppercase tracking-widest">Time Remaining</p>
             </div>
           </div>

           {/* Question Area */}
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
             <motion.div
               key={currentQuestionIndex}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-4"
             >
               <span className="px-4 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold border border-purple-500/30">
                 PART {QUESTIONS[currentQuestionIndex].part}
               </span>
               <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
                 {QUESTIONS[currentQuestionIndex].text}
               </h2>
             </motion.div>

             {/* Recording Controls */}
             <div className="relative">
               {isRecording && (
                 <motion.div
                   animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                   transition={{ repeat: Infinity, duration: 1.5 }}
                   className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl"
                 />
               )}
               <button
                 onClick={isRecording ? stopRecording : startRecording}
                 className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-90 ${isRecording ? 'bg-red-500 shadow-lg shadow-red-500/40' : 'bg-white/10 hover:bg-white/20 border border-white/20'}`}
               >
                 {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
               </button>
               <p className="mt-4 font-bold text-gray-400 uppercase tracking-widest text-sm">
                 {isRecording ? 'Recording...' : 'Click to Start Recording'}
               </p>
             </div>
           </div>

           {/* Progress Bar */}
           <div className="mt-auto pt-12">
             <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
               <motion.div
                 initial={{ width: 0 }}
                 animate={{ width: `${((currentQuestionIndex + 1) / 10) * 100}%` }}
                 className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
               />
             </div>
           </div>
         </motion.div>
       )}

       {(state === 'COMPLETION' || state === 'SUBMITTED') && (
         <motion.div
           key="completion"
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="text-center space-y-6 max-w-md"
         >
           <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
             <CheckCircle2 size={48} />
           </div>
           <h1 className="text-4xl font-black">Congratulations, {name}!</h1>
           <p className="text-gray-400 text-lg">You have completed the IELTS Speaking Test simulation.</p>
          
           <div className="bg-[#1a1c3d] p-6 rounded-2xl border border-white/10 mt-8">
             {state === 'COMPLETION' ? (
               <div className="flex flex-col items-center gap-4">
                 <Loader2 className="animate-spin text-purple-400" size={32} />
                 <p className="font-bold text-purple-400">Submitting your answers to Telegram...</p>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-4">
                 <Send className="text-green-400" size={32} />
                 <p className="font-bold text-green-400">Answers submitted successfully!</p>
                 <button
                   onClick={() => window.location.reload()}
                   className="mt-4 text-sm text-gray-400 underline hover:text-white"
                 >
                   Take another test
                 </button>
               </div>
             )}
           </div>
         </motion.div>
       )}
     </AnimatePresence>
     <footer className="mt-8 text-gray-500 text-xs opacity-50">
       @2026 Lê Trường IELTS
     </footer>
   </div>
 );
}
