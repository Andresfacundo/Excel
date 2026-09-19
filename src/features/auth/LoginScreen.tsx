import { useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import { validateEmail, validatePassword, validatePasswordPresence } from '@/lib/validation'
import { useAuth } from './useAuth'
import styles from './LoginScreen.module.css'

type Mode = 'signin' | 'signup'

interface Values extends Record<string, string> {
  email: string
  password: string
}

export function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [notice, setNotice] = useState<string | null>(null)

  // Al entrar solo se exige que la contrasena no este vacia: la fuerza se valida
  // al crear la cuenta, y rechazar una clave antigua al iniciar sesion seria
  // confuso.
  const validators = useMemo<Validators<Values>>(
    () => ({
      email: (value) => validateEmail(value),
      password: (value) => (mode === 'signup' ? validatePassword(value) : validatePasswordPresence(value)),
    }),
    [mode],
  )

  const form = useForm<Values>({
    initialValues: { email: '', password: '' },
    validators,
    onSubmit: async (values) => {
      setNotice(null)
      if (mode === 'signin') {
        await signIn(values.email, values.password)
        return
      }
      const { needsConfirmation } = await signUp(values.email, values.password)
      if (needsConfirmation) {
        setNotice('Cuenta creada. Revisa tu correo y confirma la direccion para entrar.')
      }
    },
  })

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setNotice(null)
    form.reset()
  }

  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <img className={styles.logo} src="icon.svg" alt="" width={38} height={38} />
          <span className={styles.title}>Seguimiento de Pagos</span>
        </div>
        <p className={styles.subtitle}>
          {mode === 'signin'
            ? 'Entra para ver y registrar los pagos.'
            : 'Crea tu cuenta para empezar a llevar el seguimiento.'}
        </p>

        <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            maxLength={254}
            {...form.fieldProps('email')}
          />
          <TextField
            label="Contrasena"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            maxLength={72}
            help={mode === 'signup' ? 'Minimo 8 caracteres, con al menos una letra y un numero.' : undefined}
            {...form.fieldProps('password')}
          />

          <Button type="submit" loading={form.submitting}>
            {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>

        {form.submitError && <Alert tone="error">{form.submitError}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <p className={styles.switch}>
          {mode === 'signin' ? 'No tienes cuenta?' : 'Ya tienes cuenta?'}
          <button type="button" className={styles.link} onClick={switchMode}>
            {mode === 'signin' ? 'Crear una' : 'Entrar'}
          </button>
        </p>
      </div>
    </main>
  )
}
