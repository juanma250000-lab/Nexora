import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { ModalShell } from './ModalShell';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 4;

/** Spanish validation messages; native browser bubbles follow the OS language. */
export function validateDemoAccess({ email, password }) {
  const errors = {};
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail) errors.email = 'Escribe tu correo electrónico.';
  else if (!EMAIL_PATTERN.test(cleanEmail)) errors.email = 'Revisa el formato del correo, por ejemplo: tu@correo.com.';

  const cleanPassword = String(password || '');
  if (!cleanPassword) errors.password = 'Escribe una contraseña temporal.';
  else if (cleanPassword.length < MIN_PASSWORD)
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return errors;
}

/**
 * Demo access form. Credentials are never transmitted or stored: the form
 * only toggles a local "demo session" flag, which is stated in the UI.
 */
export function AuthModal({ mode, onModeChange, onClose, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const isSignUp = mode === 'signup';

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nextErrors = validateDemoAccess({
      email: form.elements.email.value,
      password: form.elements.password.value,
    });
    setErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      form.elements[firstInvalid]?.focus();
      return;
    }
    onSubmit(event);
  };

  // Clears a field's message as soon as the visitor starts fixing it.
  const clearError = (field) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

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

      <form className="nx-auth-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="nx-email">Correo electrónico</label>
        <input
          id="nx-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={errors.email ? 'nx-email-error' : undefined}
          onChange={() => clearError('email')}
        />
        {errors.email && (
          <p className="nx-input-error" id="nx-email-error" role="alert">
            {errors.email}
          </p>
        )}

        <label htmlFor="nx-password">Contraseña temporal</label>
        <div className="nx-password-wrap">
          <input
            id="nx-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={MIN_PASSWORD}
            placeholder={`Al menos ${MIN_PASSWORD} caracteres`}
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={errors.password ? 'nx-password-error' : undefined}
            onChange={() => clearError('password')}
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
        {errors.password && (
          <p className="nx-input-error" id="nx-password-error" role="alert">
            {errors.password}
          </p>
        )}

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
