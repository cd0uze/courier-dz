import { CourierError } from './CourierError.js';

/** Thrown when API credentials are invalid (HTTP 401/403) */
export class AuthenticationError extends CourierError {
  constructor(message, statusCode = 401) {
    super(message, statusCode);
    this.name = 'AuthenticationError';
  }
}
