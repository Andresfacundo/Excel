import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from '@/components/ui/Feedback'
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { useAuth } from '@/features/auth/useAuth'
import { HomePage } from './HomePage'
import { PersonPage } from './PersonPage'

export function App() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return <Spinner centered label="Abriendo tu sesion" />
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <UpdatePrompt />
      </>
    )
  }

  return (
    // HashRouter: la app se sirve como archivos estaticos (GitHub Pages, por
    // ejemplo) y asi ninguna ruta depende de una redireccion del servidor.
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/persona/:personId" element={<PersonPage user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdatePrompt />
    </HashRouter>
  )
}
