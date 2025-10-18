import axios, { AxiosError } from "axios";
import { BaseAuthProvider } from "./BaseAuthProvider";
import { logger } from "@/services/logger/LoggerService";
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from "../types";

/**
 * Authentication provider for services that use session-based authentication (qBittorrent)
 */
export class SessionAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return "session";
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const validationError = this.validateCredentials(config);
    if (validationError) {
      return {
        success: false,
        authenticated: false,
        error: validationError,
      };
    }

    try {
      const loginUrl = `${config.baseUrl}/api/v2/auth/login`;
      const payload = new URLSearchParams({
        username: config.credentials.username!,
        password: config.credentials.password!,
      });

      void logger.debug("Starting session authentication.", {
        url: loginUrl,
        hasCredentials: Boolean(
          config.credentials.username && config.credentials.password,
        ),
      });

      const response = await axios.post(loginUrl, payload.toString(), {
        timeout: config.timeout || this.timeout,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: config.baseUrl,
        },
        withCredentials: true, // Important for session cookies
      });

      const body =
        typeof response.data === "string" ? response.data.trim() : "";
      const normalizedBody = body.toLowerCase().replace(/\.$/, "");

      void logger.debug("Session authentication response received.", {
        status: response.status,
        responseBody: body,
        hasSetCookie: Boolean(
          response.headers?.["set-cookie"] || response.headers?.["Set-Cookie"],
        ),
      });

      if (normalizedBody !== "ok") {
        let errorMessage = body
          ? `Authentication failed. Server responded with: "${body}"`
          : "Authentication failed. No response body received.";

        // Add troubleshooting hints based on common issues
        if (body === "Fails." || normalizedBody === "fails.") {
          errorMessage += " This usually means incorrect username or password.";
        } else if (
          body === "Bad credentials" ||
          normalizedBody === "bad credentials"
        ) {
          errorMessage += " The provided credentials are invalid.";
        } else if (body === "Banned" || normalizedBody === "banned") {
          errorMessage +=
            " Your IP address has been banned due to multiple failed login attempts.";
        }

        return {
          success: false,
          authenticated: false,
          error: errorMessage,
        };
      }

      // Session authentication successful
      return {
        success: true,
        authenticated: true,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.message || "Unknown authentication error";

      void logger.error("Session authentication error.", {
        error: errorMessage,
        status: axiosError.response?.status,
        url: `${config.baseUrl}/api/v2/auth/login`,
      });

      return {
        success: false,
        authenticated: false,
        error: `Authentication failed: ${errorMessage}`,
      };
    }
  }

  override async logout(
    config: AuthConfig,
    session: AuthSession,
  ): Promise<boolean> {
    try {
      const logoutUrl = `${config.baseUrl}/api/v2/auth/logout`;

      await axios.post(logoutUrl, "", {
        timeout: config.timeout || this.timeout,
        withCredentials: true,
      });

      void logger.debug("Session logout successful.");
      return true;
    } catch (error) {
      // Ignore logout errors; the session may already be invalid
      void logger.debug("Session logout failed (ignoring).", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return true; // Consider logout successful even if the request fails
    }
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    // Session auth uses cookies, so no additional headers needed
    return {};
  }
}
