/**
 * Auth0 Device Authorization Flow implementation
 *
 * This flow is designed for devices without browsers (CLI, TV apps, etc.)
 * but works for web apps too - avoids callback URL restrictions.
 *
 * Flow:
 * 1. Request device code from Auth0
 * 2. Display verification URL and user code to user
 * 3. User visits URL on any device and enters code
 * 4. Poll Auth0 until user completes authentication
 * 5. Receive access token
 */

export interface Auth0DeviceFlowConfig {
  domain: string;
  clientId: string;
  audience: string;
}

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export interface VerificationInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export class Auth0DeviceFlow {
  domain: string;
  clientId: string;
  audience: string;
  tokenData: TokenData | null;

  constructor({ domain, clientId, audience }: Auth0DeviceFlowConfig) {
    this.domain = domain;
    this.clientId = clientId;
    this.audience = audience;
    this.tokenData = null;
  }

  /**
   * Start the device authorization flow
   * Returns verification URL and user code for the user to complete auth
   * Uses server route to bypass CORS
   */
  async startDeviceFlow(): Promise<VerificationInfo> {
    const response = await fetch('/api/auth/device/code', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to start device flow');
    }

    const data = await response.json();
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri_complete || data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval || 5
    };
  }

  /**
   * Poll for token after user has been shown the verification URL
   * Uses server route to bypass CORS
   */
  async pollForToken(deviceCode: string, interval = 5): Promise<TokenData> {
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      // Wait for the interval before polling
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));

      const response = await fetch('/api/auth/device/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode })
      });

      if (!response.ok) {
        throw new Error('Failed to poll for token');
      }

      const result = await response.json();

      // Check if token request was successful
      if (result.status === 200) {
        this.tokenData = result.data;
        return this.tokenData!;
      }

      const error = result.data;

      // authorization_pending means user hasn't completed auth yet, keep polling
      if (error.error === 'authorization_pending') {
        continue;
      }

      // slow_down means we're polling too fast
      if (error.error === 'slow_down') {
        interval += 5;
        continue;
      }

      // Any other error means we should stop
      throw new Error(error.error_description || error.error);
    }

    throw new Error('Device flow timed out');
  }

  /**
   * Get the access token
   */
  async getTokenSilently(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('Not authenticated');
    }
    return this.tokenData.access_token;
  }

  /**
   * Get the refresh token, if one was issued (requires the offline_access scope).
   * Returns null when unavailable.
   */
  getRefreshToken(): string | null {
    return this.tokenData?.refresh_token ?? null;
  }

  /**
   * Get user info from Auth0
   */
  async getUser(): Promise<Record<string, unknown>> {
    if (!this.tokenData) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`https://${this.domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${this.tokenData.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.tokenData !== null;
  }

  /**
   * Logout (just clear local token data)
   */
  async logout(): Promise<void> {
    this.tokenData = null;
  }
}
