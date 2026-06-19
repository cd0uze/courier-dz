import { CourierError } from './CourierError.js';

/** Thrown when provider credentials are missing or malformed in config */
export class InvalidCredentialsError extends CourierError {
  /**
   * @param {string} provider - Provider ID
   * @param {string} message - Details about what is missing
   * @param {Error|null} [cause]
   */
  constructor(provider, message, cause = null) {
    super(`Invalid credentials for provider "${provider}": ${message}`, 0, cause);
    this.name = 'InvalidCredentialsError';
    this.provider = provider;
  }
}
