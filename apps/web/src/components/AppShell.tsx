import { Activity, FileCheck2, LayoutDashboard, Settings2, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from './Logo'

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          <NavLink to="/" end><LayoutDashboard size={18}/> Overview</NavLink>
          <NavLink to="/requests"><FileCheck2 size={18}/> Payment changes</NavLink>
          <NavLink to="/evidence-policies"><ShieldCheck size={18}/> Evidence policies</NavLink>
          <NavLink to="/audit-activity"><Activity size={18}/> Audit activity</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-chip"><span className="pulse-dot"/> Evidence-gated</div>
          <NavLink to="/settings"><Settings2 size={18}/> Settings</NavLink>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">DevNetwork API + Cloud + AI Hackathon 2026</span>
          </div>
          <div className="topbar-actions">
            <span className="mode-chip">$0 stack</span>
            <div className="avatar">TF</div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
