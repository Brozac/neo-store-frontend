'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import GlassIcon from '@/components/ui/GlassIcon';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

const QUICK_PROMPTS = [
  '✈️ How long does shipping take?',
  '📦 Check my order status',
  '🛡️ Return policy',
];

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hi! 👋 I'm Laclarc AI Assistant. Ask me about products, shipping, payments — anything!",
      time: 'Just now',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // 🆕 الاستماع لحدث فتح الشات من FloatingSupport
  useEffect(() => {
    const openChat = () => setIsOpen(true);
    window.addEventListener('laclarc:open-ai-chat', openChat);
    return () => window.removeEventListener('laclarc:open-ai-chat', openChat);
  }, []);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        sender: 'user',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!textToSend) setInputMessage('');
      setIsTyping(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: messages.slice(-4) }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          let limitReply = "You're sending messages a bit fast! 😅 Please wait a few minutes, or reach our human team via WhatsApp.";
          try {
            const d = await res.json();
            if (d?.reply) limitReply = d.reply;
          } catch {}
          setMessages((prev) => [
            ...prev,
            {
              id: `limit_${Date.now()}`,
              sender: 'bot',
              text: limitReply,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          return;
        }

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: data.reply || 'Thanks for reaching out! Feel free to ask about shipping, payments, or products.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'bot',
            text: "I'm having trouble connecting right now. Our human team is on WhatsApp!",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        clearTimeout(timeoutId);
        setIsTyping(false);
      }
    },
    [inputMessage, isTyping, messages, API_BASE_URL]
  );

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop للموبايل فقط */}
          <div
            className="fixed inset-0 bg-black/40 z-[75] sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="animate-chat-open fixed inset-x-0 bottom-0 top-auto z-[80]
                       h-[88dvh] rounded-t-3xl
                       sm:inset-auto sm:bottom-28 sm:left-6 sm:w-[380px] sm:h-[560px] sm:max-h-[75vh] sm:rounded-3xl
                       bg-white shadow-2xl flex flex-col overflow-hidden border border-gray-200/80"
            role="dialog"
            aria-label="Laclarc AI Assistant"
          >
            {/* مقبض السحب (موبايل فقط) */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-linear-to-r from-[#1D1E3C] via-[#2D2E5C] to-[#8B78C6]">
              <div className="w-10 h-1 rounded-full bg-white/40" />
            </div>

            {/* الهيدر */}
            <div className="bg-linear-to-r from-[#1D1E3C] via-[#2D2E5C] to-[#8B78C6] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-full bg-white/10 border border-white/25 flex items-center justify-center shadow-inner">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
                  </svg>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#2D2E5C]" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide flex items-center gap-1.5">
                    Laclarc AI
                    <span className="text-[9px] font-bold bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded-full uppercase">Online</span>
                  </h3>
                  <p className="text-[10px] text-gray-300 font-medium">Replies instantly • Any language</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-lg font-bold active:scale-90 transition cursor-pointer"
                aria-label="Close chat"
              >
                <GlassIcon i="x" size="xs" />
              </button>
            </div>

            {/* الرسائل */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#F4F2FA] scrollbar-hide">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#8B78C6] to-[#FF6B9D] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
                      </svg>
                    </div>
                  )}
                  <div className={`max-w-[78%] flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                        m.sender === 'user'
                          ? 'bg-linear-to-br from-[#8B78C6] to-[#7A67B5] text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-800 border border-gray-200/70 rounded-2xl rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1 px-1">{m.time}</span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#8B78C6] to-[#FF6B9D] flex items-center justify-center shrink-0 shadow-sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
                    </svg>
                  </div>
                  <div className="bg-white border border-gray-200/70 py-3 px-4 rounded-2xl rounded-bl-md shadow-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#8B78C6] rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-[#FF6B9D] rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 bg-[#1D1E3C] rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* الأسئلة السريعة */}
            {messages.length <= 2 && (
              <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isTyping}
                    className="whitespace-nowrap bg-[#8B78C6]/10 hover:bg-[#8B78C6]/20 text-[#6B5AA8] border border-[#8B78C6]/25 text-[11px] font-bold px-3.5 py-2 rounded-full transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* الإدخال — مع دعم الـ safe-area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                maxLength={1000}
                placeholder="Ask anything..."
                className="flex-1 min-w-0 bg-gray-100 border border-gray-200 rounded-full px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#8B78C6] focus:bg-white focus:ring-2 focus:ring-[#8B78C6]/15 transition"
              />
              <button
                type="submit"
                disabled={isTyping || !inputMessage.trim()}
                className="w-11 h-11 shrink-0 bg-linear-to-br from-[#8B78C6] to-[#FF6B9D] text-white rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-40 cursor-pointer shadow-lg"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
                </svg>
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}