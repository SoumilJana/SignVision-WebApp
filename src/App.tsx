import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireMFA from './components/RequireMFA'
import Home from './pages/Home'
import Translator from './pages/Translator'
import Signs from './pages/Signs'
import Clone from './pages/Clone'
import Settings from './pages/Settings'
import About from './pages/About'
import Login from './pages/Login'
import Register from './pages/Register'
import MFASetup from './pages/MFASetup'
import './styles/index.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/mfa-setup" element={<MFASetup />} />
          <Route path="/about" element={<About />} />

          {/* Protected routes - require MFA */}
          <Route path="/" element={<RequireMFA><Home /></RequireMFA>} />
          <Route path="/translator" element={<RequireMFA><Translator /></RequireMFA>} />
          <Route path="/signs" element={<RequireMFA><Signs /></RequireMFA>} />
          <Route path="/clone" element={<RequireMFA><Clone /></RequireMFA>} />
          <Route path="/settings" element={<RequireMFA><Settings /></RequireMFA>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

