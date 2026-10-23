'use client';

import { useState, ChangeEvent } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import GlassIcon from '@/components/ui/GlassIcon';

export default function MultiStepRegister() {
  const [step, setStep] = useState<number>(1);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    gender: 'Male',
    profession: ''
  });
  
  const [image, setImage] = useState<string>('/icon-512.png');
  const [togglePassword, setTogglePassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // ✨ فحص دقيق لقوة كلمة المرور
  const handlePasswordChange = (value: string) => {
    setFormData({ ...formData, password: value });
    setError('');

    // 🩹 v1.1 — مطابق لـ backend: 8+ = مقبول · التركيبة = قوة إضافية
    const hasMixed = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value);
    const valid = value.length >= 8;

    if (valid && hasMixed) setPasswordStrength('strong');
    else if (valid) setPasswordStrength('medium');
    else if (value.length > 0) setPasswordStrength('weak');
    else setPasswordStrength('');
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file size must be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ✨ التحقق الصارم قبل السماح بالانتقال للخطوة التالية
  const handleNextStep = () => {
    setError('');

    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    if (step === 2) {
      // 🩹 v1.1 — مطابق لـ assertStrongPassword (server.js:65): length >= 8 فقط
      if (!formData.password || formData.password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    }

    setStep(prev => prev + 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      const data = await res.json();
      if (res.ok) {
        // حفظ تفضيلات الملف الشخصي محلياً لحين تفعيل الحساب
        try {
          localStorage.setItem('temp_user_profile', JSON.stringify({
            gender: formData.gender,
            profession: formData.profession,
            photo: image
          }));
        } catch (e) {}

        setIsComplete(true);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
        setStep(1);
      }
    } catch (err) {
      setError('Server connection error. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.round((step / 3) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 font-sans">
      {isComplete ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-xl text-center border border-gray-100 space-y-4">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
            <GlassIcon i="check" size="xs" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">Registration Successful! <GlassIcon ch="🎉" size="xs" /></h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
            We have dispatched an activation link to <strong className="text-[#5B7EA6]">{formData.email}</strong>. Please verify your inbox to activate your account.
          </p>
          <div className="pt-4">
            <Link 
              href="/"
              className="inline-block bg-[#22364A] hover:bg-[#33475C] text-white font-extrabold py-3.5 px-8 rounded-xl text-xs uppercase tracking-wider transition shadow-md active:scale-95"
            >
              Return to Storefront
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-xl border border-gray-100">
          
          {/* Progress Header */}
          <div className="border-b border-gray-100 pb-5 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#5B7EA6]">
                Step {step} of 3
              </span>
              <span className="text-xs font-mono font-bold text-gray-400">{progress}% Complete</span>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-3">
              <div 
                className="bg-linear-to-r from-[#5B7EA6] to-[#E2836B] h-full rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <h3 className="text-lg font-black text-gray-900">
              {step === 1 && 'Personal Information'}
              {step === 2 && 'Account Security'}
              {step === 3 && 'Tailor Your Experience'}
            </h3>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl mb-6 text-xs font-bold">
              <GlassIcon ch="⚠️" size="xs" /> {error}
            </div>
          )}

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto bg-gray-100 border-2 border-[#5B7EA6]/30 mb-3 relative shadow-sm">
                  <img src={image} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <label 
                  htmlFor="fileInput" 
                  className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm active:scale-95"
                >
                  <span><GlassIcon ch="📷" size="xs" /></span> Upload Avatar
                </label>
                <input id="fileInput" accept="image/*" className="hidden" type="file" onChange={handleImageChange} />

              {/* 🆕 M#48 — Google OAuth — rافعة تحويل (2 نقرات بدل 5 خطوات) */}
              <div className="mt-4 pt-4 border-t border-gray-100 w-full">
                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: '/' })}
                  className="w-full flex items-center justify-center gap-3 p-3 border border-gray-200 rounded-xl font-bold text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Full Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  required
                  placeholder="e.g. Sarah Connor" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#5B7EA6] transition" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Email Address *</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  required
                  placeholder="name@example.com" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#5B7EA6] transition" 
                />
              </div>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Create Master Password *</label>
                <div className="relative">
                  <input 
                    type={togglePassword ? 'text' : 'password'} 
                    value={formData.password} 
                    onChange={(e) => handlePasswordChange(e.target.value)} 
                    placeholder="Minimum 8 characters..." 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 pr-12 focus:outline-none focus:border-[#5B7EA6] transition" 
                  />
                  <button 
                    type="button"
                    onClick={() => setTogglePassword(!togglePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                  >
                    {togglePassword ? <GlassIcon i="eyeOff" bare size="sm" className="w-5 h-5" /> : <GlassIcon i="eye" bare size="sm" className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Meter */}
              {formData.password && (
                <div className="space-y-1 pt-1">
                  <div className="flex gap-1.5 h-1.5">
                    <div className={`flex-1 rounded-full ${passwordStrength === 'weak' || passwordStrength === 'medium' || passwordStrength === 'strong' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                    <div className={`flex-1 rounded-full ${passwordStrength === 'medium' || passwordStrength === 'strong' ? 'bg-amber-400' : 'bg-gray-200'}`}></div>
                    <div className={`flex-1 rounded-full ${passwordStrength === 'strong' ? 'bg-emerald-500' : 'bg-gray-200'}`}></div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Strength: {passwordStrength}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Profile Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Shopping Preference / Gender</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Male', 'Female'].map((g) => (
                    <label 
                      key={g}
                      className={`flex items-center justify-center p-3.5 rounded-xl border-2 font-bold text-xs cursor-pointer transition active:scale-95 ${
                        formData.gender === g 
                          ? 'border-[#5B7EA6] bg-fog-50 text-[#22364A]' 
                          : 'border-gray-200 bg-white text-gray-500'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="gender" 
                        value={g} 
                        checked={formData.gender === g} 
                        onChange={handleChange} 
                        className="hidden" 
                      />
                      {g === 'Male' ? '👔 Menswear' : '👗 Womenswear'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Profession (Optional)</label>
                <input 
                  type="text" 
                  name="profession" 
                  value={formData.profession} 
                  onChange={handleChange} 
                  placeholder="e.g. Designer, Entrepreneur..." 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#5B7EA6] transition" 
                />
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-100">
            {step > 1 ? (
              <button 
                type="button" 
                onClick={() => setStep(prev => prev - 1)} 
                className="px-6 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition active:scale-95"
              >
                &larr; Back
              </button>
            ) : <div></div>}

            {step < 3 ? (
              <button 
                type="button" 
                onClick={handleNextStep} 
                className="px-8 py-3 bg-[#22364A] hover:bg-[#33475C] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition active:scale-95 shadow-md"
              >
                Continue &rarr;
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleComplete} 
                disabled={loading}
                className="px-8 py-3 bg-linear-to-r from-[#5B7EA6] to-[#E2836B] hover:brightness-110 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition active:scale-95 shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Create Laclarc Account'}
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}