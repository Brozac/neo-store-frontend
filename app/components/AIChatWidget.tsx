'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

const QUICK_PROMPTS = [
  '✈️ How long does shipping take?',
  '📦 Can you check my order status?',
  '🛡️ What is your return policy?'
];

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am Laclarc AI Assistant 🤖. How can I assist you with our products, shipping, or payments today?',
      time: 'Just now'
    }
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
      // ✨ فوكس تلقائي على حقل الإدخال ملي الشات يتحل
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen]);

  // ✨ الإغلاق بمفتاح Escape (Accessibility)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleSendMessage = useCallback(async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    // ✨ Timeout 45 ثانية — يغطي cold start ديال Render + بطء Gemini
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-4)
        }),
        signal: controller.signal
      });

      // ✨ رسالة واضحة خاصة بالـ Rate Limit (chatLimiter 30/10m)
      if (res.status === 429) {
        setMessages(prev => [
          ...prev,
          {
            id: `limit_${Date.now()}`,
            sender: 'bot',
            text: "You're sending messages a bit fast! 😅 Please wait a few minutes, or reach our human team instantly via WhatsApp.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        return;
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: data.reply || "Thank you for contacting Laclarc! Feel free to ask about our shipping, payment methods, or products.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch {
      const isTimeout = false; // الرسالة موحدة — كافية وواضحة
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'bot',
          text: "I'm having trouble connecting right now. You can chat directly with our human support via WhatsApp!",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      clearTimeout(timeoutId);
      setIsTyping(false);
    }
  }, [inputMessage, isTyping, messages, API_BASE_URL]);

  return (
    // ✨ التموضع: فوق زر الواتساب مباشرة
    <aside aria-label="Live AI Shopping Assistant" className="fixed bottom-24 left-6 z-40 font-sans pointer-events-auto">

      {/* نافذة المحادثة المنبثقة */}
      {isOpen && (
        <div
          className="bg-white border border-gray-200 rounded-3xl shadow-2xl w-[320px] sm:w-[360px] h-[480px] mb-3 flex flex-col justify-between overflow-hidden animate-scale"
          onClick={(e) => e.stopPropagation()}
        >
          {/* شريط العنوان العلوي */}
          <div className="bg-gradient-to-r from-[#1D1E3C] via-[#2D2E5C] to-[#8B78C6] text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-lg border border-white/20 shadow-xs">
                🤖
              </div>
              <div>
                <h3 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  Laclarc AI Assistant
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </h3>
                <p className="text-[10px] text-gray-300 font-medium">Instant Product &amp; Shipping Guide</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white p-1 text-sm font-bold active:scale-90 transition cursor-pointer"
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* تغذية الرسائل */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#F9F8FC] scrollbar-hide text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl leading-relaxed shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] text-white rounded-br-xs'
                      : 'bg-white text-gray-800 border border-gray-200/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {/* مؤشر جاري الكتابة */}
            {isTyping && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 py-2 px-3.5 rounded-2xl w-fit shadow-xs">
                <div className="w-1.5 h-1.5 bg-[#8B78C6] rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-[#FF6B9D] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-[#1D1E3C] rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* أزرار الأسئلة السريعة */}
          {messages.length <= 2 && (
            <div className="p-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isTyping}
                  className="whitespace-nowrap bg-purple-50 hover:bg-purple-100 text-[#8B78C6] border border-purple-200 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* شريط الإدخال */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={1000}
              placeholder="Ask anything — English, Français, Darja..."
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-900 outline-none focus:border-[#8B78C6] transition"
            />

            <button
              type="submit"
              disabled={isTyping || !inputMessage.trim()}
              className="w-9 h-9 bg-gradient-to-r from-[#8B78C6] to-[#FF6B9D] hover:brightness-110 text-white rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-40 cursor-pointer shadow-md shrink-0"
              aria-label="Send Message"
            >
              ➔
            </button>
          </form>
        </div>
      )}

      {/* زر فتح وإغلاق الشات العائم */}
      {/* ✨ زدنا relative — التلميح دابا كيتقاس من الزر نفسه ماشي من الـ aside */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-gradient-to-r from-[#1D1E3C] via-[#2D2E5C] to-[#8B78C6] text-white p-3.5 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 cursor-pointer flex items-center justify-center group active:scale-90 border-2 border-white/30"
        title="Chat with Laclarc AI"
        aria-label="Open AI Shopping Assistant"
        aria-expanded={isOpen}
      >
        <span className="text-xl">🤖</span>

        <span className="absolute left-full ml-3 bg-[#1D1E3C] text-white text-[11px] font-bold py-1.5 px-3 rounded-xl whitespace-nowrap hidden md:group-hover:block transition-all shadow-xl pointer-events-none border border-white/10">
          Ask Laclarc AI 💬
        </span>
      </button>
    </aside>
  );
}