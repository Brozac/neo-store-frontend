'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import GlassIcon from '@/components/ui/GlassIcon';
import { uiAlert, uiConfirm } from '../../lib/ui-dialog'; // F#72 · MWG dialog
// 🔐 F#73 Passkeys Management — أدلة modern-web-guidance (registration + management)
import { listPasskeys, renamePasskey, deletePasskey, passkeyRegister, syncAcceptedCredentials, pkSupported, PasskeyCredInfo } from '../../lib/passkeys';

interface UserProfile {
  name: string;
  email: string;
  profile_picture?: string;
}

// 🆕 v1.1 — HTML-error-page guard (Render 502 etc.) — نمط checkout.ts الموحد
const safeJson = async (res: Response): Promise<any> => {
  const raw = await res.text();
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};

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

  // 🔐 F#73 Passkeys Management
  const [pkList, setPkList] = useState<PasskeyCredInfo[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkUiSupported, setPkUiSupported] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
        return safeJson(res);
      })
      .then((data) => {
        if (data && data.email) {
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
    localStorage.clear();           // 🩹 كحل كل شيء (token + cart + wheel)
    sessionStorage.clear();         // 🩹 كحل my_orders_cache
    setUser(null);
    router.push('/auth');
  };

  // 🔐 F#73 — تحميل قائمة البصمات + مزامنة password managers عند التحميل (دليل management §93)
  const loadPasskeys = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    setPkLoading(true);
    try {
      const info = await listPasskeys(token);
      setPkList(info.credentials);
      syncAcceptedCredentials(info.rpId, info.userId, info.credentials); // Signal API — console.warn فقط
    } catch {
      // القائمة ليست حرجة — صمت
    } finally {
      setPkLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    pkSupported().then(setPkUiSupported);
    loadPasskeys();
  }, [user]);

  // 🔐 F#73 — flow الإدارة: بلا authenticatorAttachment → security keys مسموحة (دليل management §78)
  const handleAddPasskey = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || pkBusy) return;
    setPkBusy(true);
    try {
      const result = await passkeyRegister({ token, promotion: false });
      if (result.ok) {
        await loadPasskeys();
      } else if (result.message) {
        await uiAlert(result.message);
      }
    } catch (err) {
      await uiAlert((err as Error)?.message || 'Passkey creation failed.');
    } finally {
      setPkBusy(false);
    }
  };

  const handleDeletePasskey = async (cred: PasskeyCredInfo) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || pkBusy) return;
    const okGo = await uiConfirm(`Delete "${cred.name}"? Devices relying on it will no longer be able to sign in with it.`);
    if (!okGo) return;
    setPkBusy(true);
    try {
      await deletePasskey(token, cred.id);
      await loadPasskeys(); // كيعاود يطلق signalAllAcceptedCredentials بالمتبقي (دليل management §95)
    } catch (err) {
      await uiAlert((err as Error)?.message || 'Delete failed.');
    } finally {
      setPkBusy(false);
    }
  };

  // إعادة التسمية = label فالسيرفر فقط — بلا signalCurrentUserDetails (دليل management §72)
  const handleRenamePasskey = async (cred: PasskeyCredInfo) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const newName = renameValue.trim();
    if (!token || !newName) {
      setRenamingId(null);
      return;
    }
    setPkBusy(true);
    try {
      await renamePasskey(token, cred.id, newName);
      setRenamingId(null);
      await loadPasskeys();
    } catch (err) {
      await uiAlert((err as Error)?.message || 'Rename failed.');
    } finally {
      setPkBusy(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      uiAlert('File is too large. Maximum allowed size is 5MB.');
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
      const data = await safeJson(res);

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

        const updatedUser = await safeJson(updateRes);
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

      const data = await safeJson(res);
      if (res.ok) {
        setUser(data);
        setIsEditOpen(false);
      } else {
        setEditError(data.message || data.error || 'Failed to update profile.');
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
      const data = await safeJson(res);
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
        <div className="w-8 h-8 border-4 border-[#5B7EA6] border-t-transparent rounded-full animate-spin"></div>
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

          <div className="relative p-1 rounded-full bg-linear-to-tr from-[#5B7EA6] to-[#7FA1C4] mb-4 shadow-md">
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
                <div className="w-24 h-24 rounded-full bg-fog-50 flex items-center justify-center text-3xl font-black text-[#5B7EA6]">
                  {user ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>

            <label
              className="absolute bottom-1 right-1 flex items-center justify-center w-8 h-8 text-white bg-[#5B7EA6] hover:bg-[#46648A] border-2 border-white rounded-full cursor-pointer transition shadow-md active:scale-90"
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
            <p className="text-xs text-coral-600 font-bold mb-2">{uploadError}</p>
          )}

          <h2 className="text-xl font-black text-gray-900">{user ? user.name : 'Guest Shopper'}</h2>
          <p className="text-xs text-gray-400 font-medium mb-3">{user ? user.email : 'Sign in to sync your cart and orders'}</p>

          {user && (
            <button
              onClick={() => { setEditName(user.name); setEditError(''); setIsEditOpen(true); }}
              className="inline-flex items-center gap-1.5 text-[#5B7EA6] font-bold text-xs hover:underline cursor-pointer active:scale-95 transition"
            >
              <span><GlassIcon ch="✏️" size="xs" /></span> Edit Profile Details
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
                  <span className="text-base text-coral-600"><GlassIcon ch="❤️" size="xs" /></span>
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
                  <span className="text-base text-[#5B7EA6]"><GlassIcon ch="📦" size="xs" /></span>
                  Order History & Invoices
                </span>
                <span className="text-gray-400 text-xs">&rarr;</span>
              </button>

              <button
                onClick={() => router.push('/track-order')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-3">
                  <span className="text-base text-maroccan-tea-600"><GlassIcon ch="🚚" size="xs" /></span>
                  Track Live Shipment
                </span>
                <span className="text-gray-400 text-xs">&rarr;</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 hover:bg-coral-50 rounded-xl transition text-coral-600 cursor-pointer active:scale-[0.99]"
              >
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-3">
                  <span className="text-base"><GlassIcon ch="🔒" size="xs" /></span>
                  Sign Out of Laclarc
                </span>
                <span className="text-xs">&rarr;</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className="w-full bg-[#2E4057] hover:bg-[#33475C] text-white font-extrabold p-4 rounded-xl transition text-xs uppercase tracking-wider shadow-md active:scale-95"
            >
              Sign In / Register &rarr;
            </button>
          )}
        </div>

        {/* 🔐 F#73 — Passkeys Management (دليل passkey-management) — كيبان فقط للمسجلين */}
        {user && (pkUiSupported || pkList.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-1.5">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <GlassIcon ch="🔑" size="xs" /> Passkey Sign-In
              </h2>
              {pkUiSupported && (
                <button
                  onClick={handleAddPasskey}
                  disabled={pkBusy}
                  className="bg-[#5B7EA6] hover:bg-[#46648A] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {pkBusy ? '…' : '+ Add Passkey'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mb-3">
              Sign in with your face, fingerprint, or device PIN — no password needed.
            </p>

            {pkLoading ? (
              <div className="py-4 text-center text-xs text-gray-400 font-bold">Loading…</div>
            ) : pkList.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 font-bold">
                No passkeys yet — add one for one-tap sign-in.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pkList.map((cred) => (
                  <div key={cred.id} className="py-3">
                    {renamingId === cred.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          maxLength={50}
                          aria-label="Passkey name"
                          className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#5B7EA6]"
                        />
                        <button
                          onClick={() => handleRenamePasskey(cred)}
                          disabled={pkBusy}
                          className="bg-[#5B7EA6] text-white text-[10px] font-extrabold uppercase px-3 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="text-gray-400 hover:text-gray-700 text-xs font-bold px-1 cursor-pointer"
                          aria-label="Cancel rename"
                        >
                          <GlassIcon i="x" size="xs" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 truncate">{cred.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {cred.deviceType === 'multiDevice' ? 'Synced across devices' : 'This device only'}
                            {cred.backedUp ? ' · Backed up' : ''}
                            {cred.registeredAt ? ` · Added ${new Date(cred.registeredAt).toLocaleDateString()}` : ''}
                            {cred.lastUsedAt ? ` · Last used ${new Date(cred.lastUsedAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setRenamingId(cred.id); setRenameValue(cred.name); }}
                            disabled={pkBusy}
                            className="text-[#5B7EA6] text-[10px] font-extrabold uppercase px-2 py-1 cursor-pointer disabled:opacity-50"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleDeletePasskey(cred)}
                            disabled={pkBusy}
                            className="text-coral-600 text-[10px] font-extrabold uppercase px-2 py-1 cursor-pointer disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
                <GlassIcon i="x" size="xs" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold" role="alert">
                <GlassIcon ch="⚠️" size="xs" /> {editError}
              </div>
            )}

            {/* 🆕 v1.1 — uploadError داخل المودال أيضاً (كان خارجاً فقط — الزبون ما يشوفش) */}
            {uploadError && (
              <div className="p-3 bg-red-50 text-coral-600 rounded-xl text-xs font-bold" role="alert">
                <GlassIcon ch="⚠️" size="xs" /> {uploadError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="profile-name" className="block text-gray-700 text-xs font-bold uppercase mb-1">Full Name *</label>
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B7EA6] transition"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="block text-gray-700 text-xs font-bold uppercase mb-1">Account Email Address</label>
                <input
                  id="profile-email"
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
                className="w-full bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold rounded-xl py-3.5 mt-2 transition disabled:opacity-50 flex justify-center items-center cursor-pointer active:scale-95 shadow-md text-xs uppercase tracking-wider"
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