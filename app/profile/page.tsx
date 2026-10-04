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

  // Edit Name Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser(data);
          setEditName(data.name || '');
        }
      })
      .catch((err) => {
        console.error("Profile fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [API_BASE_URL]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/auth');
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum allowed size is 5MB.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    setUploadingImage(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('images', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.urls && data.urls.length > 0) {
        const newImageUrl = data.urls[0];

        const updateRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
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
        } else {
          setUploadError('Failed to save profile picture link.');
        }
      } else {
        setUploadError(data.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadError('Network error uploading image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditError('Name cannot be empty.');
      return;
    }

    setUpdating(true);
    setEditError('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          profilePicture: user?.profile_picture
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setIsEditOpen(false);
      } else {
        setEditError(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      setEditError('Connection error updating name.');
    } finally {
      setUpdating(false);
    }
  };

  // 🩹 M#29 — helper محلي لعرض الحالة الودية (متسق مع server.js getStatusLabel)
  const getStatusLabel = (status: string): string => {
    const MAP: Record<string, string> = {
      'pending':           '⏳ Awaiting Payment',
      'paid':              '✅ Payment Confirmed',
      'awaiting_exchange': '📦 Alternative Offered — Check Email',
      'processing':        '⏳ Processing',
      'manual':            '⏳ Under Review',
      'fulfilled':         '🚚 Shipped',
      'completed':         '✅ Delivered',
      'refunded':          '💰 Refunded',
      'cancelled':         '❌ Cancelled',
      'expired':           '⏱ Expired',
      'archived':          '📦 Archived',
    };
    return MAP[String(status || '').toLowerCase()] || String(status || '');
  };

  const getUserOrders = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/auth');
      return;
    }
    // 🩹 M#29 — جلب الطلبات مع status_label
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // ✨ حفظ الطلبات في sessionStorage لنستعملها في صفحة /orders مع status_label
      if (Array.isArray(data)) {
        sessionStorage.setItem('my_orders_cache', JSON.stringify(data));
      }
      router.push('/orders');
    } catch {
      router.push('/orders');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto space-y-6">

        {/* Navigation */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Account Dashboard</h1>
          <button
            onClick={() => router.push('/')}
            className="text-xs font-bold text-gray-500 hover:text-black transition"
          >
            &larr; Storefront
          </button>
        </div>

        {/* User Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center text-center relative overflow-hidden">

          <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#8B78C6] to-[#FF6B9D] mb-4 shadow-md">
            <div className="p-1 bg-white rounded-full">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.name || 'User Avatar'}
                  className="w-24 h-24 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-50 flex items-center justify-center text-3xl font-black text-[#8B78C6]">
                  {user ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>

            <label
              className="absolute bottom-1 right-1 flex items-center justify-center w-8 h-8 text-white bg-[#8B78C6] hover:bg-[#7A67B5] border-2 border-white rounded-full cursor-pointer transition shadow-md active:scale-90"
              title="Upload New Avatar"
            >
              {uploadingImage ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="text-sm font-bold">+</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>

          {uploadError && (
            <p className="text-xs text-rose-600 font-bold mb-2">{uploadError}</p>
          )}

          <h2 className="text-xl font-black text-gray-900">{user ? user.name : 'Guest Shopper'}</h2>
          <p className="text-xs text-gray-400 font-medium mb-3">{user ? user.email : 'Sign in to sync your cart and orders'}</p>

          {user && (
            <button
              onClick={() => { setEditName(user.name); setEditError(''); setIsEditOpen(true); }}
              className="inline-flex items-center gap-1.5 text-[#8B78C6] font-bold text-xs hover:underline cursor-pointer active:scale-95 transition"
            >
              <span>✏️</span> Edit Profile Details
            </button>
          )}
        </div>

        {/* Action Menu */}
        <div className="bg-white rounded-2xl shadow-sm p-2 border border-gray-200 divide-y divide-gray-100">
          {user ? (
            <>
              <button
                onClick={() => router.push('/favorites')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-3">
                  <span className="text-base text-[#FF6B9D]">❤️</span>
                  My Saved Wishlist
                </span>
                <span className="text-gray-400 text-xs">&rarr;</span>
              </button>

              {/* 🩹 M#29 — Order History button يحمل الإيميل لصفحة الطلبات */}
              <button
                onClick={getUserOrders}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-3">
                  <span className="text-base text-[#8B78C6]">📦</span>
                  Order History & Invoices
                </span>
                <span className="text-gray-400 text-xs">&rarr;</span>
              </button>

              <button
                onClick={() => router.push('/track-order')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-3">
                  <span className="text-base text-emerald-600">🚚</span>
                  Track Live Shipment
                </span>
                <span className="text-gray-400 text-xs">&rarr;</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 hover:bg-rose-50 rounded-xl transition text-rose-600 cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-3">
                  <span className="text-base">🔒</span>
                  Sign Out of Laclarc
                </span>
                <span className="text-xs">&rarr;</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className="w-full bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white font-extrabold p-4 rounded-xl transition text-xs uppercase tracking-wider shadow-md active:scale-95"
            >
              Sign In / Register &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && user && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setIsEditOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-base font-black text-gray-900">Update Profile Information</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-gray-400 hover:text-black p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
                ⚠️ {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Account Email Address</label>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full bg-gray-100 border border-gray-200 text-gray-400 rounded-xl px-4 py-3 text-sm cursor-not-allowed font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Verified email cannot be modified for security reasons.</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={updating}
                className="w-full bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold rounded-xl py-3.5 mt-2 transition disabled:opacity-50 flex justify-center items-center cursor-pointer active:scale-95 shadow-md text-xs uppercase tracking-wider"
              >
                {updating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Save Profile Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}