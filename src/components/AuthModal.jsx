import { ArrowRight, CircleAlert, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from './Brand';
import { ModalShell } from './ModalShell';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 4;

/**
 * Validation runs here instead of relying on the browser bubbles, which are
 * rendered in the browser's own language and would expose English UI text.
 */
function validate(form) {
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const errors = {};

  if (!email) errors.email = 'Escribe tu correo electrónico.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Revisa el formato del correo (ej.: tu@correo.com).';

  if (!password) errors.password = 'Escribe una contraseña temporal.';
  else if (password.length < MIN_PASSWORD)
    errors.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;

  return errors;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p className="nx-field-error is-inline" id={id}>
      <CircleAlert size={14} aria-hidden="true" /> {message}
    </p>
  );
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
    const nextErrors = validate(form);
    setErrors(nextErrors);

    const firstInvalid = ['email', 'password'].find((name) => nextErrors[name]);
    if (firstInvalid) {
      form.elements[firstInvalid].focus();
      return;
    }
    onSubmit(event);
  };

  // Clear a field's message as soon as the user starts fixing it.
  const clearError = (name) => {
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  return (
    <ModalShell
      onClose={onClose}
      labelledBy="nx-auth-title"
      describedBy="nx-auth-description"
      variant="nx-auth-modal"
    >
      <div className="nx-modal-mark" aria-hidden="true">
        <BrandMark />
      </div>

      <p className="nx-eyebrow">Tu espacio digital</p>
      <h2 id="nx-auth-title">{isSignUp ? 'Crea tu acceso de prueba.' : 'Entra a NEXORA.'}</h2>
      <p id="nx-auth-description">
        {isSignUp
          ? 'Explora las herramientas de demostración. No se crea una cuenta ni se guardan tus credenciales.'
          : 'Ingresa al modo de prueba en este dispositivo. No hay una cuenta real conectada.'}
      </p>

      <form className="nx-auth-form" onSubmit={handleSubmit} noValidate>
        <div className="nx-field">
          <label className="nx-field-label" htmlFor="nx-email">
            Correo electrónico
          </label>
          <input
            className={`nx-input ${errors.email ? 'is-invalid' : ''}`.trim()}
            id="nx-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'nx-email-error' : undefined}
            onChange={() => clearError('email')}
          />
          <FieldError id="nx-email-error" message={errors.email} />
        </div>

        <div className="nx-field">
          <label className="nx-field-label" htmlFor="nx-password">
            Contraseña temporal
          </label>
          <div className={`nx-input-group ${errors.password ? 'is-invalid' : ''}`.trim()}>
            <input
              id="nx-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder={`Al menos ${MIN_PASSWORD} caracteres`}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'nx-password-error' : undefined}
              onChange={() => clearError('password')}
            />
            <button
              type="button"
              className="nx-icon-button is-ghost"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          <FieldError id="nx-password-error" message={errors.password} />
        </div>

        <button className="nx-button nx-button-primary nx-button-block" type="submit">
          {isSignUp ? 'Continuar en modo de prueba' : 'Entrar al modo de prueba'}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>

      <button
        className="nx-text-action nx-auth-switch"
        type="button"
        onClick={() => {
          setErrors({});
          onModeChange(isSignUp ? 'signin' : 'signup');
        }}
      >
        {isSignUp ? '¿Ya tienes un acceso de prueba? Entrar' : '¿Primera vez aquí? Crear acceso de prueba'}
      </button>

      <p className="nx-modal-note">
        <LockKeyhole size={14} aria-hidden="true" /> La contraseña no se envía ni se almacena.
      </p>
    </ModalShell>
  );
}
