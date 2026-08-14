'use client';
import { useState, ChangeEvent } from 'react';

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

  const [image, setImage] = useState<string>('https://placehold.co/300x300/F9F8FC/8B78C6?text=Photo');
  const [togglePassword, setTogglePassword] = useState(false);
  const [passwordStrengthText, setPasswordStrengthText] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const checkPasswordStrength = (value: string) => {
    setFormData({ ...formData, password: value });
    const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
    const mediumRegex = new RegExp("^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})");

    if (strongRegex.test(value)) setPasswordStrengthText("Strong password");
    else if(mediumRegex.test(value)) setPasswordStrengthText("Could be stronger");
    else setPasswordStrengthText("Too weak");
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setIsComplete(true);
      } else {
        setError(data.message || 'Registration failed.');
        setStep(1);
      }
    } catch (err) {
      setError('Server connection error.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const progress = parseInt((step / 3 * 100).toString());

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {isComplete ? (
        <div className="bg-white rounded-temu-sm p-10 flex items-center shadow-sm justify-between border border-temu-gray-border-light">
          <div>
            <svg className="mb-4 h-20 w-20 text-temu-green mx-auto" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl mb-4 text-temu-black text-center font-extrabold">Registration Success</h2>
            <div className="text-temu-gray-text mb-8 text-center">
              Thank you. We have sent you an email to <span className="font-bold text-temu-black">{formData.email}</span>. Please click the link to activate your account.
            </div>
            {/* ✨ زر العودة مع تأثير الضغط */}
            <button 
              onClick={() => { setStep(1); setIsComplete(false); setFormData({ name: '', email: '', password: '', gender: 'Male', profession: '' }); }} 
              className="w-40 block mx-auto focus:outline-none py-2 px-5 rounded-temu-sm shadow-sm text-center text-temu-black bg-white hover:bg-temu-offwhite font-bold border border-temu-gray-border-light cursor-pointer active:scale-95 transition touch-manipulation"
            >
              Back to home
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b-2 border-temu-gray-border-light py-4">
            <div className="uppercase tracking-wide text-xs font-bold text-temu-gray-light mb-1 leading-tight">Step: {step} of 3</div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="text-lg font-bold text-temu-black leading-tight">
                  {step === 1 && 'Your Profile'}
                  {step === 2 && 'Your Password'}
                  {step === 3 && 'Tell me about yourself'}
                </div>
              </div>
              <div className="flex items-center md:w-64">
                <div className="w-full bg-temu-gray-border-light rounded-full mr-2">
                  <div className="rounded-full bg-temu-orange text-xs leading-none h-2 text-center text-white transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="text-xs w-10 text-temu-gray-text font-bold">{progress}%</div>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-temu-error p-4 rounded-temu-sm mt-4 text-sm font-medium text-center">{error}</div>}

          <div className="py-10">
            {step === 1 && (
              <div>
                <div className="mb-5 text-center">
                  <div className="mx-auto w-32 h-32 border rounded-full relative bg-temu-offwhite mb-4 shadow-inset overflow-hidden">
                    <img id="image" className="object-cover w-full h-32 rounded-full" src={image} alt="Profile" />
                  </div>
                  {/* ✨ زر رفع الصورة مع تأثير الضغط */}
                  <label 
                    htmlFor="fileInput" 
                    className="cursor-pointer inline-flex justify-between items-center focus:outline-none border border-temu-gray-border-light py-2 px-4 rounded-temu-sm shadow-sm text-left text-temu-black bg-white hover:bg-temu-offwhite font-bold active:scale-95 transition touch-manipulation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="inline-flex shrink-0 w-6 h-6 -mt-1 mr-1 text-temu-orange" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="0" y="0" width="24" height="24" stroke="none"></rect><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /><circle cx="12" cy="13" r="3" /></svg>
                    Browse Photo
                  </label>
                  <input name="photo" id="fileInput" accept="image/*" className="hidden" type="file" onChange={handleImageChange} />
                </div>
                <div className="mb-5">
                  <label className="font-bold mb-1 text-temu-black block">Firstname</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange text-temu-black font-medium touch-manipulation" placeholder="Enter your firstname..." />
                </div>
                <div className="mb-5">
                  <label className="font-bold mb-1 text-temu-black block">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange text-temu-black font-medium touch-manipulation" placeholder="Enter your email address..." />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mb-5">
                <label className="font-bold mb-1 text-temu-black block">Set up password</label>
                <div className="text-temu-gray-text mt-2 mb-4">Please create a secure password including the following criteria below.</div>
                <div className="relative">
                  <input type={togglePassword ? 'text' : 'password'} value={formData.password} onChange={(e) => checkPasswordStrength(e.target.value)} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange text-temu-black font-medium touch-manipulation" placeholder="Your strong password..." />
                  <div className="absolute right-0 bottom-0 top-0 px-3 py-3 cursor-pointer active:scale-90" onClick={() => setTogglePassword(!togglePassword)}>
                    {togglePassword ? '🙈' : '👁️'}
                  </div>
                </div>
                <div className="flex items-center mt-4 h-3">
                  <div className="w-2/3 flex justify-between h-2">
                    <div className={`h-2 rounded-full mr-1 w-1/3 ${passwordStrengthText === 'Too weak' || passwordStrengthText === 'Could be stronger' || passwordStrengthText === 'Strong password' ? 'bg-temu-error' : 'bg-temu-gray-border-light'}`}></div>
                    <div className={`h-2 rounded-full mr-1 w-1/3 ${passwordStrengthText === 'Could be stronger' || passwordStrengthText === 'Strong password' ? 'bg-temu-orange' : 'bg-temu-gray-border-light'}`}></div>
                    <div className={`h-2 rounded-full w-1/3 ${passwordStrengthText === 'Strong password' ? 'bg-temu-green' : 'bg-temu-gray-border-light'}`}></div>
                  </div>
                  <div className="text-temu-gray-text font-medium text-sm ml-3 leading-none">{passwordStrengthText}</div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="mb-5">
                  <label className="font-bold mb-1 text-temu-black block">Gender</label>
                  <div className="flex">
                    <label className={`flex justify-start items-center text-truncate rounded-temu-sm pl-4 pr-6 py-3 shadow-sm mr-4 cursor-pointer active:scale-95 transition ${formData.gender === 'Male' ? 'border-2 border-temu-orange bg-temu-offwhite' : 'bg-white border border-temu-gray-border-light'}`}>
                      <input type="radio" name="gender" value="Male" checked={formData.gender === 'Male'} onChange={handleChange} className="text-temu-orange focus:outline-none mr-3" />
                      <div className="select-none text-temu-black font-bold">Male</div>
                    </label>
                    <label className={`flex justify-start items-center text-truncate rounded-temu-sm pl-4 pr-6 py-3 shadow-sm cursor-pointer active:scale-95 transition ${formData.gender === 'Female' ? 'border-2 border-temu-error bg-temu-yellow-soft' : 'bg-white border border-temu-gray-border-light'}`}>
                      <input type="radio" name="gender" value="Female" checked={formData.gender === 'Female'} onChange={handleChange} className="text-temu-error focus:outline-none mr-3" />
                      <div className="select-none text-temu-black font-bold">Female</div>
                    </label>
                  </div>
                </div>
                <div className="mb-5">
                  <label className="font-bold mb-1 text-temu-black block">Profession</label>
                  <input type="text" name="profession" value={formData.profession} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange text-temu-black font-medium touch-manipulation" placeholder="eg. Web Developer" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!isComplete && (
        <div className="fixed bottom-0 left-0 right-0 py-5 bg-white shadow-md border-t border-temu-gray-border-light z-40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex justify-between">
              <div className="w-1/2">
                {step > 1 && (
                  <button onClick={() => setStep((prev) => prev - 1)} className="w-32 focus:outline-none py-3 px-5 rounded-temu-sm shadow-sm text-center text-temu-black bg-white hover:bg-temu-offwhite font-bold border border-temu-gray-border-light cursor-pointer active:scale-95 transition touch-manipulation">Previous</button>
                )}
              </div>
              <div className="w-1/2 text-right">
                {step < 3 ? (
                  <button onClick={() => setStep((prev) => prev + 1)} className="w-32 focus:outline-none border border-transparent py-3 px-5 rounded-temu-sm shadow-sm text-center text-white bg-temu-orange hover:bg-temu-orange-bright font-bold cursor-pointer active:scale-95 transition touch-manipulation">Next</button>
                ) : (
                  <button onClick={handleComplete} disabled={loading} className="w-32 focus:outline-none border border-transparent py-3 px-5 rounded-temu-sm shadow-sm text-center text-white bg-temu-orange hover:bg-temu-orange-bright font-bold cursor-pointer disabled:opacity-50 active:scale-95 transition touch-manipulation flex justify-center items-center gap-2">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : 'Complete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}