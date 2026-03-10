/**
 * Unit tests for authService
 * Mocks Firebase Auth to test business logic, error handling, and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mock functions (must be declared before vi.mock calls) ---
const {
  mockCreateUserWithEmailAndPassword,
  mockSignInWithEmailAndPassword,
  mockSignOut,
  mockSendPasswordResetEmail,
  mockUpdatePassword,
  mockOnAuthStateChanged,
  mockSignInWithPopup,
  mockAuth,
} = vi.hoisted(() => {
  const mockUser = { uid: 'user-123', email: 'test@example.com' };
  const mockAuth = {
    currentUser: null as typeof mockUser | null,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignInWithEmailAndPassword: vi.fn(),
    mockSignOut: vi.fn(),
    mockSendPasswordResetEmail: vi.fn(),
    mockUpdatePassword: vi.fn(),
    mockOnAuthStateChanged: vi.fn(),
    mockSignInWithPopup: vi.fn(),
    mockAuth,
  };
});

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signOut: mockSignOut,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  updatePassword: mockUpdatePassword,
  onAuthStateChanged: mockOnAuthStateChanged,
  GoogleAuthProvider: vi.fn().mockImplementation(function() { return {}; }),
  signInWithPopup: mockSignInWithPopup,
}));

vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: {},
}));

import { authService } from './auth';

const mockUser = { uid: 'user-123', email: 'test@example.com' };

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    mockAuth.authStateReady.mockResolvedValue(undefined);
  });

  describe('signUp', () => {
    it('creates a user and returns the user object', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      const user = await authService.signUp('test@example.com', 'password123');
      expect(user).toBe(mockUser);
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123',
      );
    });

    it('propagates Firebase errors (e.g. email already in use)', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        Object.assign(new Error('auth/email-already-in-use'), { code: 'auth/email-already-in-use' }),
      );
      await expect(authService.signUp('taken@example.com', 'pw')).rejects.toThrow(
        'auth/email-already-in-use',
      );
    });
  });

  describe('signIn', () => {
    it('signs in and returns the user object', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      const user = await authService.signIn('test@example.com', 'password123');
      expect(user).toBe(mockUser);
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123',
      );
    });

    it('propagates wrong-password errors', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        Object.assign(new Error('auth/wrong-password'), { code: 'auth/wrong-password' }),
      );
      await expect(authService.signIn('test@example.com', 'wrongpw')).rejects.toThrow(
        'auth/wrong-password',
      );
    });
  });

  describe('signInWithGoogle', () => {
    it('signs in via popup and returns the user', async () => {
      mockSignInWithPopup.mockResolvedValueOnce({ user: mockUser });
      const user = await authService.signInWithGoogle();
      expect(user).toBe(mockUser);
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });

    it('propagates popup-closed-by-user errors', async () => {
      mockSignInWithPopup.mockRejectedValueOnce(
        Object.assign(new Error('auth/popup-closed-by-user'), { code: 'auth/popup-closed-by-user' }),
      );
      await expect(authService.signInWithGoogle()).rejects.toThrow('auth/popup-closed-by-user');
    });
  });

  describe('signOut', () => {
    it('calls Firebase signOut', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      await authService.signOut();
      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
    });
  });

  describe('getUser', () => {
    it('returns current user after auth state is ready', async () => {
      mockAuth.currentUser = mockUser;
      const user = await authService.getUser();
      expect(user).toBe(mockUser);
      expect(mockAuth.authStateReady).toHaveBeenCalled();
    });

    it('returns null when no user is signed in', async () => {
      mockAuth.currentUser = null;
      const user = await authService.getUser();
      expect(user).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('sends a password reset email with the configured app URL', async () => {
      vi.stubEnv('VITE_APP_URL', 'https://myapp.com');
      mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);

      await authService.resetPassword('test@example.com');

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        { url: 'https://myapp.com/auth' },
      );
    });

    it('throws when VITE_APP_URL is not configured and window.location.origin is empty', async () => {
      vi.stubEnv('VITE_APP_URL', '');
      const originalOrigin = window.location.origin;
      Object.defineProperty(window, 'location', {
        value: { ...window.location, origin: '' },
        writable: true,
      });

      await expect(authService.resetPassword('test@example.com')).rejects.toThrow(
        'App URL is not configured',
      );

      Object.defineProperty(window, 'location', {
        value: { ...window.location, origin: originalOrigin },
        writable: true,
      });
    });
  });

  describe('updatePassword', () => {
    it('updates the password for the current user', async () => {
      mockAuth.currentUser = mockUser;
      mockUpdatePassword.mockResolvedValueOnce(undefined);

      await authService.updatePassword('newSecurePassword');

      expect(mockUpdatePassword).toHaveBeenCalledWith(mockUser, 'newSecurePassword');
    });

    it('throws when no user is signed in', async () => {
      mockAuth.currentUser = null;
      await expect(authService.updatePassword('pw')).rejects.toThrow('Not authenticated');
    });
  });

  describe('onAuthStateChange', () => {
    it('registers an auth state listener and returns an unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      const mockCallback = vi.fn();
      mockOnAuthStateChanged.mockReturnValueOnce(mockUnsubscribe);

      const unsubscribe = authService.onAuthStateChange(mockCallback);

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(mockAuth, mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });
});
