'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  name: string;
  email: string;
  profile_picture?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // حالات نافذة تعديل الاسم فقط
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);
  
  // حالة رفع الصورة
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('https://neo-store-backend.onrender.com/api/user/profile', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) localStorage.removeItem('token');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser(data);
          setEditName(data.name);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/auth');
  };

  // دالة رفع الصورة وتحديثها مباشرة في قاعدة البيانات
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('images', file);

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.urls && data.urls.length > 0) {
        const newImageUrl = data.urls[0];
        
        const updateRes = await fetch('https://neo-store-backend.onrender.com/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: user.name, profilePicture: newImageUrl })
        });

        const updatedUser = await updateRes.json();
        if (updateRes.ok) {
          setUser(updatedUser);
        }
      } else {
        console.error('Upload failed:', data);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  // دالة حفظ التعديلات (الاسم فقط)
  const handleSaveProfile = async () => {
    setUpdating(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName, profilePicture: user?.profile_picture })
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setIsEditOpen(false);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-extrabold text-temu-black mb-6">My Profile</h1>
        
        {/* بطاقة معلومات المستخدم */}
        <div className="bg-white p-8 rounded-temu-sm shadow-sm mb-6 border border-temu-gray-border-light flex flex-col items-center">
          
          {/* الصورة الدائرية مع الإطار المتدرج وزر الإضافة (+) */}
          <div className="relative p-1 rounded-full bg-linear-to-r from-temu-error to-temu-orange mb-4">
            {/* ✨ إضافة active:scale-95 للصورة */}
            <div className="block p-1 transition transform bg-white rounded-full hover:-rotate-6 active:scale-95">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-temu-offwhite flex items-center justify-center text-3xl font-bold text-temu-orange">
                  {user ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>
            {/* ✨ زر الرفع مع تأثير الضغط */}
            <label className="absolute bottom-0 right-1 flex items-center justify-center w-8 h-8 font-mono text-xl font-semibold text-white bg-temu-orange border-4 border-white rounded-full hover:bg-temu-orange-bright cursor-pointer transition active:scale-90">
              {uploadingImage ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : '+'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>

          <h2 className="text-xl font-bold text-temu-black">{user ? user.name : 'Guest User'}</h2>
          <p className="text-temu-gray-text text-sm mb-4">{user ? user.email : 'Not logged in'}</p>
          
          {/* زر تعديل المعلومات الشخصية */}
          {user && (
            <button 
              onClick={() => { setEditName(user.name); setIsEditOpen(true); }} 
              className="flex items-center gap-2 text-temu-orange font-bold text-sm hover:underline cursor-pointer mt-2 active:scale-95 transition w-fit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Edit Personal Info
            </button>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="bg-white rounded-temu-sm shadow-sm p-2 border border-temu-gray-border-light">
          {user ? (
            <>
              {/* زر المفضلة (Favorites) */}
              <button 
                onClick={() => router.push('/favorites')}
                className="w-full flex items-center justify-between p-4 hover:bg-temu-offwhite active:bg-temu-offwhite rounded-temu-sm transition cursor-pointer active:scale-95"
              >
                <span className="font-semibold text-temu-black flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-temu-error">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  My Favorites
                </span>
                <span className="text-temu-gray-light">➔</span>
              </button>
              <div className="h-px bg-temu-gray-border-light mx-4"></div>

              {/* زر الطلبات (Orders) */}
              <button 
                onClick={() => router.push('/orders')}
                className="w-full flex items-center justify-between p-4 hover:bg-temu-offwhite active:bg-temu-offwhite rounded-temu-sm transition cursor-pointer active:scale-95"
              >
                <span className="font-semibold text-temu-black">My Orders</span>
                <span className="text-temu-gray-light">➔</span>
              </button>
              <div className="h-px bg-temu-gray-border-light mx-4"></div>

              {/* زر الخروج (Logout) */}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-50 rounded-temu-sm transition text-temu-error cursor-pointer active:scale-95"
              >
                <span className="font-semibold">Log Out</span>
                <span>➔</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => router.push('/auth')}
              className="w-full bg-temu-orange text-white font-bold p-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex justify-center items-center cursor-pointer active:scale-95 shadow-md"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>

      {/* نافذة تعديل المعلومات الشخصية (الاسم فقط) */}
      {isEditOpen && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setIsEditOpen(false)}>
          <div className="bg-white rounded-temu-sm max-w-md w-full p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Edit Personal Info</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-temu-gray-light hover:text-temu-black cursor-pointer active:scale-90 transition">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" 
                />
              </div>

              <div>
                <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={user.email || ''} 
                  disabled 
                  className="w-full bg-gray-100 border border-temu-gray-border-light text-temu-gray-light rounded-temu-sm px-4 py-3 cursor-not-allowed" 
                />
                <p className="text-xs text-temu-gray-light mt-1 ml-1">Email cannot be changed.</p>
              </div>

              <button 
                onClick={handleSaveProfile} 
                disabled={updating} 
                className="w-full bg-temu-orange text-white font-extrabold rounded-temu-sm px-4 py-3 mt-2 hover:bg-temu-orange-bright transition disabled:opacity-50 flex justify-center items-center cursor-pointer active:scale-95 shadow-md"
              >
                {updating ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}