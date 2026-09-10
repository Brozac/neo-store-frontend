'use client';

import { useState, useEffect, useRef } from 'react';

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

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
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

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-4)
        })
      });

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: data.reply || "Thank you for contacting Laclarc! Feel free to ask about our shipping, payment methods, or products.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'bot',
          text: "I'm updating my connection. You can also chat directly with our human support via WhatsApp!",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    // ✨ التموضع: فوق زر الواتساب مباشرة بارتفاع مريح لا يحجب أي عنصر
    <aside aria-label="Live AI Shopping Assistant" className="fixed bottom-24 left-6 z-40 font-sans pointer-events-auto">
      
      {/* نافذة المحادثة المنبثقة */}
      {isOpen && (
        <div 
          className="bg-white border border-gray-200 rounded-3xl shadow-2xl w-[320px] sm:w-[360px] h-[480px] mb-3 flex flex-col justify-between overflow-hidden animate-scale"
          onClick={(e) => e.stopPropagation()}
        >
          {/* شريط العنوان العلوي الفاخر */}
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
                <p className="text-[10px] text-gray-300 font-medium">Instant Product & Shipping Guide</p>
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
                  className="whitespace-nowrap bg-purple-50 hover:bg-purple-100 text-[#8B78C6] border border-purple-200 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition active:scale-95 cursor-pointer"
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
              type="text" 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything in English, Français, or دارجة..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-900 outline-none focus:border-[#8B78C6] transition"
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

      {/* زر فتح وإغلاق الشات العائم (أيقونة الروبوت 🤖) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-[#1D1E3C] via-[#2D2E5C] to-[#8B78C6] text-white p-3.5 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 cursor-pointer flex items-center justify-center group active:scale-90 border-2 border-white/30"
        title="Chat with Laclarc AI"
        aria-label="Open AI Shopping Assistant"
      >
        <span className="text-xl">🤖</span>
        
        {/* تلميح عند المرور بالماوس على شاشات الكمبيوتر */}
        <span className="absolute left-full ml-3 bg-[#1D1E3C] text-white text-[11px] font-bold py-1.5 px-3 rounded-xl whitespace-nowrap hidden md:group-hover:block transition-all shadow-xl pointer-events-none border border-white/10">
          Ask Laclarc AI 💬
        </span>
      </button>
    </aside>
  );
}