import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Incidencia from './pages/Incidencia'
import Movimientos from './pages/Movimientos'
import Resumen from './pages/Resumen'
import Catalogo from './pages/Catalogo'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Movimientos />} />
              <Route path="/incidencia" element={<Incidencia />} />
              <Route path="/resumen" element={<Resumen />} />
              <Route path="/catalogo" element={<Catalogo />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  )
}
