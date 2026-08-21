import axios from 'axios';

const adminApi = axios.create({
  baseURL: 'https://neo-store-backend.onrender.com/api',
  timeout: 60000,
  withCredentials: true, // ✨ مهم جداً: يسمح بإرسال واستقبال الكوكيز
});

// ✨ اعتراض الأخطاء: إذا رد السيرفر 401 (غير مصرح)، قم بتوجيه الأدمن لصفحة الدخول
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // إذا انتهت صلاحية الجلسة أو الكوكيز لم تُرسل، وجهيه لصفحة الدخول
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;