import axios from 'axios';

const host = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const API_URL = `${host.replace(/\/$/, '')}/api`;

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;