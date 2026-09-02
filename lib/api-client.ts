/**
 * Authenticated HTTP client for the Fulcra API
 *
 * This class provides low-level HTTP methods (get, post, put, delete) and
 * high-level domain methods for specific API endpoints. When adding new
 * functionality, add methods here following the existing pattern.
 *
 * Fulcra REST API documentation: https://docs.fulcradynamics.com/rest-api/
 */
export class FulcraAPI {
  apiEndpoint: string;
  accessToken: string;

  constructor(apiEndpoint: string, accessToken: string) {
    this.apiEndpoint = apiEndpoint;
    this.accessToken = accessToken;
  }

  /**
   * Low-level HTTP request method
   * @private
   */
  async request(method: string, path: string, data?: unknown, signal?: AbortSignal) {
    const url = `${this.apiEndpoint}${path}`;

    const options: RequestInit = {
      signal,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`
      }
    };

    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return;
    }

    return await response.json();
  }

  // Low-level HTTP methods
  async get(path: string, signal?: AbortSignal) {
    return this.request('GET', path, undefined, signal);
  }

  async post(path: string, data?: unknown) {
    return this.request('POST', path, data);
  }

  async put(path: string, data?: unknown) {
    return this.request('PUT', path, data);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }

  // ============================================================
  // High-level API methods
  // Add new Fulcra API methods here following this pattern:
  // - Clear method names that describe what they fetch/do
  // - JSDoc comments for parameters and return types
  // - Use the low-level HTTP methods above
  // ============================================================

  /**
   * Get current user's info
   * @returns User info including userid, email, preferences, etc.
   */
  async getUserInfo() {
    return this.get('user/v1alpha1/info');
  }

  /**
   * Get current user's preferences
   * @returns User preferences including timezone, selected metrics, etc.
   */
  async getUserPreferences() {
    return this.get('user/v1alpha1/preferences');
  }

  /**
   * Update current user's preferences
   * @param preferences - Partial preferences object to update
   * @returns Updated preferences
   */
  async updateUserPreferences(preferences: unknown) {
    return this.post('user/v1alpha1/preferences', preferences);
  }
}
