import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { RequestDetail } from './pages/RequestDetail'
import { RequestsPage } from './pages/RequestsPage'
import { EvidencePolicies } from './pages/EvidencePolicies'
import { AuditActivity } from './pages/AuditActivity'
import { Settings } from './pages/Settings'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell/>}>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/requests" element={<RequestsPage/>}/>
          <Route path="/requests/:id" element={<RequestDetail/>}/>
          <Route path="/evidence-policies" element={<EvidencePolicies/>}/>
          <Route path="/audit-activity" element={<AuditActivity/>}/>
          <Route path="/settings" element={<Settings/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
