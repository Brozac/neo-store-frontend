import axios from 'axios';

const adminApi = axios.create({
  baseURL: 'https://neo-store-backend.onrender.com/api',
  timeout: 60000,
  withCredentials: true, // ✨ مهم جداً: يسمح بإرسال واستقبال الكوكيز
});

export default adminApi;