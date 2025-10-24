import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import RegisterPage from './components/RegisterPage';
import SettingsPage from './components/SettingsPage';
import ToastProvider from './components/ToastProvider';

function App() {
  const [token, setToken] = useState(localStorage.getItem('jwtToken'));
  const [userData, setUserData] = useState(() => {
    try {
      const stored = localStorage.getItem('userData');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Lỗi parse userData từ localStorage:', error);
      return null;
    }
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleLogin = (data) => {
    console.log('Dữ liệu nhận được từ đăng nhập:', data);
    
    // Kiểm tra dữ liệu có đầy đủ không
    if (!data || !data.accessToken || !data.id || !data.username) {
      console.error('Dữ liệu đăng nhập không hợp lệ:', data);
      alert('Dữ liệu đăng nhập không hợp lệ. Vui lòng thử lại.');
      return;
    }
    
    const newUserData = {
      id: data.id,
      username: data.username,
      monthlyLimit: data.monthlyLimit || null // <-- LƯU LẠI HẠN MỨC
    };
    
    console.log('Lưu userData:', newUserData);
    console.log('Lưu token:', data.accessToken);
    
    localStorage.setItem('jwtToken', data.accessToken);
    localStorage.setItem('userData', JSON.stringify(newUserData));
    setToken(data.accessToken);
    setUserData(newUserData);
  };
  
  
  const handleLimitSet = (newLimit) => {
    const newUserData = { ...userData, monthlyLimit: newLimit };
    setUserData(newUserData);
    localStorage.setItem('userData', JSON.stringify(newUserData));
  };

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  const handleLogout = () => {
    
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userData');
    setToken(null);
    setUserData(null);
    setIsRegistering(false);
  };

  
  const renderContent = () => {
    if (token) {
      
      if (showSettings) {
        return (
          <SettingsPage
            isFirstTime={false}
            onLimitSet={(newLimit) => { handleLimitSet(newLimit); handleCloseSettings(); }}
          />
        );
      }

      if (userData.monthlyLimit === null) {
        return <SettingsPage isFirstTime={true} onLimitSet={handleLimitSet} />;
      } else {
        return <Dashboard user={userData} onLogout={handleLogout} onOpenSettings={handleOpenSettings} />;
      }
    }
    
  if (isRegistering) {
      return <RegisterPage onNavigateToLogin={() => setIsRegistering(false)} />;
    }
    
    return <LoginPage onLogin={handleLogin} onNavigateToRegister={() => setIsRegistering(true)} />;
  };

  return (
    <ToastProvider>
      <div className="App">
        {renderContent()}
      </div>
    </ToastProvider>
  );
}

export default App;