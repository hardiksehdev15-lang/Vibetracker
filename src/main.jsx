import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import DashboardPage from './DashboardPage';
import LoginPage from './LoginPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<DashboardPage />} />
        <Route path="/login"   element={<LoginPage />} />
        {/* Catch-all → dashboard (auth guard inside DashboardPage handles redirect) */}
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
