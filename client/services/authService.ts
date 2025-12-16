import { User } from '../types';
import { backendService } from './backendService';

// This service is now a wrapper around the backend calls for the UI components

export const login = async (username: string, password: string): Promise<User | null> => {
  return await backendService.login(username, password);
};

export const changePassword = async (username: string, newPassword: string): Promise<boolean> => {
  return await backendService.changePassword(username, newPassword);
};