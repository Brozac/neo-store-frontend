// utils/adminApi.ts - Laclarc Enterprise Axios Client
import axios from 'axios';

const backendBase = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
const baseURL = `${backendBase.replace(/\/+$/, '')}/api`;

const adminApi = axios.create({
  baseURL,
  timeout: 60000,
  withCredentials: true, // ضروري لإرسال واستقبال كوكيز admin_token
});

// ✨ اعتراض الاستجابات والتعامل مع انتهاء الجلسة (401 & 403) بأمان تام
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // فحص انتهاء الجلسة أو غياب الصلاحيات
    if (status === 401 || status === 403) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        
        // ✨ منع الـ Infinite Loop إذا كان الأدمن بالفعل في صفحة الدخول
        if (!currentPath.startsWith('/admin/login')) {
          console.warn('🔒 Admin session expired. Redirecting to security gateway...');
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;