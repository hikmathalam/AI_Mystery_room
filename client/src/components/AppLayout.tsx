import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, Shield, X } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/create-mystery", label: "New investigation", icon: Plus },
    { to: "/dashboard#cases", label: "Case archive", icon: BookOpen }
  ];
  async function handleLogout() { await logout(); navigate("/"); }
  return <div className="app-frame">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand-row"><NavLink to="/dashboard" className="brand-lockup"><span className="seal-mark">M</span><span><b>MYSTERY</b><small>INVESTIGATION DESK</small></span></NavLink><button type="button" className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{links.map(({to,label,icon:Icon})=><NavLink key={label} to={to} onClick={()=>setOpen(false)} className={({isActive})=>`side-link ${isActive?"active":""}`}><Icon size={17}/><span>{label}</span>{label==="New investigation"&&<span className="nav-plus">↗</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        <div className="desk-card"><span className="desk-icon"><Shield size={16}/></span><div><b>Private desk</b><small>Your cases stay yours</small></div><span className="secure-dot"/></div>
        <Link className="side-link muted-link" to="/#method" onClick={()=>setOpen(false)}><CircleHelp size={17}/><span>Help & field guide</span></Link>
        <div className="account-row"><div className="avatar avatar-small">{(user?.name||"D").slice(0,1).toUpperCase()}</div><div className="account-copy"><b>{user?.name||"Detective"}</b><small>Independent investigator</small></div><button type="button" className="icon-button account-menu" onClick={handleLogout} aria-label="Sign out"><LogOut size={16}/></button></div>
      </div>
    </aside>
    {open&&<button type="button" className="scrim" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
    <main className="main-frame">
      <header className="topbar"><button type="button" className="icon-button menu-trigger" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="breadcrumb"><span>Investigation desk</span><span className="crumb-slash">/</span><b>Workspace</b></div><div className="topbar-tools"><Link to="/dashboard#cases" className="search-hint"><BookOpen size={14}/><span>Case archive</span></Link><span className="topbar-divider"/><div className="avatar avatar-small">{(user?.name||"D").slice(0,1).toUpperCase()}</div><button type="button" className="user-dropdown" onClick={handleLogout}>{user?.name?.split(" ")[0]}<ChevronDown size={14}/></button></div></header>
      <div className="page-stage"><Outlet/></div>
    </main>
  </div>;
}
