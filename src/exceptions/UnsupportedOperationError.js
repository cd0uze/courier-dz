import { CourierError } from './CourierError.js';

/** Thrown when calling a method not supported by the provider */
export class UnsupportedOperationError extends CourierError {
  /**
   * @param {string} operation - Method name (e.g., 'getRates', 'cancelOrder')
   * @param {string} provider - Provider ID
   */
  constructor(operation, provider) {
    super(`Operation "${operation}" is not supported by provider "${provider}".`);
    this.name = 'UnsupportedOperationError';
    this.operation = operation;
    this.provider = provider;
  }
}
