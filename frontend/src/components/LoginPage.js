import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { useToast } from './ToastProvider';
import './Auth.css';

function LoginPage({ onLogin, onNavigateToRegister }) {
  const [formData, setFormData] = useState({
    username: 'testuser',
    password: '123456'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const { push } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập';
    }
    
    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      console.log('Đang gửi request đăng nhập:', formData);
      const response = await apiClient.post('/auth/signin', formData);
      console.log('Response từ server:', response.data);
      
      // Kiểm tra response có đúng cấu trúc không
      if (response.data && response.data.accessToken) {
        // Show success notification
        push('Đăng nhập thành công!', 'success');
        
        // Gọi onLogin với dữ liệu từ server
        onLogin(response.data);
      } else {
        throw new Error('Dữ liệu phản hồi không hợp lệ');
      }
      
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Đăng nhập thất bại';
      push(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">₫</div>
            <h1>Quản lý Chi tiêu</h1>
          </div>
          <p className="auth-subtitle">Đăng nhập để quản lý chi tiêu của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Tên đăng nhập
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`form-input ${errors.username ? 'error' : ''}`}
                placeholder="Nhập tên đăng nhập"
                disabled={isLoading}
              />
              <div className="input-icon">@</div>
            </div>
            {errors.username && <span className="error-message">{errors.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mật khẩu
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Nhập mật khẩu"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? '👁' : '👁'}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {errors.general && (
            <div className="error-banner">
              <span className="error-icon">!</span>
              {errors.general}
            </div>
          )}

          <button 
            type="submit" 
            className={`auth-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p className="auth-switch">
            Chưa có tài khoản?{' '}
            <button 
              type="button"
              className="auth-link"
              onClick={onNavigateToRegister}
              disabled={isLoading}
            >
              Đăng ký ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;