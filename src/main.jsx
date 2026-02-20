import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import DashboardPage from './DashboardPage'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* This makes the Dashboard your home page */}
        <Route path="/" element={<DashboardPage />} />
        
        {/* This is a placeholder for your login page */}
        <Route path="/login" element={<div className="text-white p-10">Please Login (Login Page coming soon)</div>} />
        
        {/* Redirect any unknown paths to the home page */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);