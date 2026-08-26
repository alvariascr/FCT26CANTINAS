import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const tabs = [
  { to: '/', label: 'Movimientos', icon: '📦', end: true },
  { to: '/incidencia', label: 'Incidencia', icon: '⚠️', end: false },
  { to: '/resumen', label: 'Resumen', icon: '📊', end: false },
  { to: '/catalogo', label: 'Catálogo', icon: '🗂️', end: false },
]

export default function Layout() {
  const { signOut } = useAuth()

  return (
    <>
      <header className="app-header">
        <h1>🍻 Inventario Fiesta</h1>
        <button className="btn-logout" onClick={() => signOut()}>
          Salir
        </button>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="nav-bottom">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span className="icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
