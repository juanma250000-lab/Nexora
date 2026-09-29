import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { ModalShell } from './ModalShell';

/**
 * Demo access form. Credentials are never transmitted or stored: the form
 * only toggles a local "demo session" flag, which is stated in the UI.
 */
export function AuthModal({ mode, onModeChange, onClose, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === 'signup';

  return (
    <ModalShell onClose={onClose} labelledBy="nx-auth-title" variant="nx-auth-modal">
      <div className="nx-modal-mark" aria-hidden="true">
        <span className="nx-brand-mark">
          <i />
          <i />
          <i />
        </span>
      </div>

      <span className="nx-section-index">TU ESPACIO DIGITAL</span>
      <h2 id="nx-auth-title">{isSignUp ? 'Crea tu acceso de prueba.' : 'Entra a NEXORA.'}</h2>
      <p>
        {isSignUp
          ? 'Explora las herramientas de demostración. No se crea una cuenta ni se guardan tus credenciales.'
          : 'Ingresa al modo de prueba en este dispositivo. No hay una cuenta real conectada.'}
      </p>

      <form className="nx-auth-form" onSubmit={onSubmit}>
        <label htmlFor="nx-email">Correo electrónico</label>
        <input
          id="nx-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />

        <label htmlFor="nx-password">Contraseña temporal</label>
        <div className="nx-password-wrap">
          <input
            id="nx-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={4}
            placeholder="Al menos 4 caracteres"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>

        <button className="nx-button nx-button-primary nx-auth-submit" type="submit">
          {isSignUp ? 'Continuar en modo de prueba' : 'Entrar al modo de prueba'}{' '}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>

      <button
        className="nx-auth-switch"
        type="button"
        onClick={() => onModeChange(isSignUp ? 'signin' : 'signup')}
      >
        {isSignUp
          ? '¿Ya tienes un acceso de prueba? Entrar'
          : '¿Primera vez aquí? Crear acceso de prueba'}
      </button>

      <p className="nx-modal-note">
        <LockKeyhole size={14} aria-hidden="true" /> La contraseña no se envía ni se almacena.
      </p>
    </ModalShell>
  );
}
