/**
 * User type definitions
 */
import { createUserId } from '../../utils/ulid';

/**
 * User interface representing a system user
 */
export interface User {
  /**
   * Unique identifier for the user
   */
  id: string;

  /**
   * Username for display and reference
   */
  username: string;

  /**
   * Optional display name
   */
  displayName?: string;

  /**
   * User's first name
   */
  firstName?: string;

  /**
   * User's last name
   */
  lastName?: string;

  /**
   * Optional email address
   */
  email?: string;

  /**
   * When the user was created
   */
  createdAt: Date;
}

/**
 * Create a new user with the given properties
 * @param props Partial user properties (id and createdAt will be set automatically if not provided)
 * @returns A new User object
 */
export function createUser(props: Partial<User>): User {
  const id = props.id || createUserId().toString();
  const now = new Date();

  return {
    id,
    username: props.username || 'anonymous',
    displayName: props.displayName,
    firstName: props.firstName,
    lastName: props.lastName,
    email: props.email,
    createdAt: props.createdAt || now,
  };
}

/**
 * Create a default user instance
 * Currently used for development/testing only
 */
export function createDefaultUser(): User {
  return createUser({
    username: 'default',
    displayName: 'Default User',
  });
}

/**
 * Get the current user (hardcoded for now, to be replaced with actual auth)
 */
export function getCurrentUser(): User {
  return createUser({
    id: 'user_gab',
    username: 'gab',
    displayName: 'Gab',
    firstName: 'Gabriel',
    lastName: 'Michels',
    email: 'gab@crowd-wisdom.com',
  });
} 