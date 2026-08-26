import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Consumo from './pages/Consumo'
import Traslado from './pages/Traslado'
import Resumen from './pages/Resumen'
import Catalogo from './pages/Catalogo'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Consumo />} />
            <Route path="/traslado" element={<Traslado />} />
            <Route path="/resumen" element={<Resumen />} />
            <Route path="/catalogo" element={<Catalogo />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
