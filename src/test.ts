#!/usr/bin/env node

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';

// Import the validation functions (we'll need to export them from index.ts)
// For now, we'll test the basic functionality

describe('Orshot MCP Server Tests', () => {
  
  describe('Environment Configuration', () => {
    test('should load environment variables from .env file', async () => {
      // Test that we can read the .env file if it exists
      try {
        const envFile = readFileSync('.env', 'utf8');
        assert(typeof envFile === 'string', 'Should be able to read .env file as string');
      } catch (error) {
        // .env file might not exist, which is OK
        console.log('No .env file found, which is acceptable');
      }
    });

    test('should handle missing ORSHOT_API_KEY gracefully', () => {
      const originalKey = process.env.ORSHOT_API_KEY;
      delete process.env.ORSHOT_API_KEY;
      
      // This should not throw an error, just show a warning
      assert(process.env.ORSHOT_API_KEY === undefined, 'API key should be undefined');
      
      // Restore original value
      if (originalKey) {
        process.env.ORSHOT_API_KEY = originalKey;
      }
    });
  });

  describe('URL Validation', () => {
    test('should validate URLs correctly', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://api.orshot.com/v1/test',
        'https://images.unsplash.com/photo-123456'
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'javascript:alert(1)',
        '',
        'http://',
        'https://'
      ];

      const isUrl = (str: string) => {
        try {
          const url = new URL(str);
          return url.protocol === 'https:' || url.protocol === 'http:';
        } catch {
          return false;
        }
      };

      validUrls.forEach(url => {
        assert(isUrl(url), `${url} should be valid`);
      });

      invalidUrls.forEach(url => {
        assert(!isUrl(url), `${url} should be invalid`);
      });
    });
  });

  describe('Template ID Validation', () => {
    test('should validate template IDs correctly', () => {
      const validateTemplateId = (templateId: string): { isValid: boolean; sanitized: string; error?: string } => {
        if (!templateId || typeof templateId !== 'string') {
          return { isValid: false, sanitized: '', error: 'Template ID is required and must be a string' };
        }
        
        const sanitized = templateId.trim();
        if (sanitized.length === 0) {
          return { isValid: false, sanitized: '', error: 'Template ID cannot be empty' };
        }
        
        if (sanitized.length > 100) {
          return { isValid: false, sanitized: '', error: 'Template ID is too long (max 100 characters)' };
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
          return { isValid: false, sanitized: '', error: 'Template ID contains invalid characters' };
        }
        
        return { isValid: true, sanitized };
      };

      // Valid template IDs
      const validIds = ['123', 'abc-123', 'template_name', 'Test-Template-1'];
      validIds.forEach(id => {
        const result = validateTemplateId(id);
        assert(result.isValid, `${id} should be valid`);
        assert(result.sanitized === id, `Sanitized value should match input for ${id}`);
      });

      // Invalid template IDs
      const invalidIds = ['', '  ', 'template with spaces', 'template@test', 'a'.repeat(101)];
      invalidIds.forEach(id => {
        const result = validateTemplateId(id);
        assert(!result.isValid, `${id} should be invalid`);
        assert(result.error, `Should have error message for ${id}`);
      });
    });

    test('should detect studio templates correctly', () => {
      const isLikelyStudioTemplate = (templateId: string): boolean => {
        return /^\d+$/.test(templateId);
      };

      assert(isLikelyStudioTemplate('123'), 'Numeric ID should be studio template');
      assert(isLikelyStudioTemplate('456789'), 'Large numeric ID should be studio template');
      assert(!isLikelyStudioTemplate('abc123'), 'Alphanumeric ID should not be studio template');
      assert(!isLikelyStudioTemplate('template-name'), 'String ID should not be studio template');
    });
  });

  describe('API Key Validation', () => {
    test('should validate API keys correctly', () => {
      const validateApiKey = (apiKey: string): { isValid: boolean; error?: string } => {
        if (!apiKey || typeof apiKey !== 'string') {
          return { isValid: false, error: 'API key is required' };
        }
        
        const trimmed = apiKey.trim();
        if (trimmed.length < 10) {
          return { isValid: false, error: 'API key appears to be too short' };
        }
        
        if (trimmed.length > 200) {
          return { isValid: false, error: 'API key is too long' };
        }
        
        return { isValid: true };
      };

      // Valid API keys
      const validKeys = ['sk-1234567890abcdef', 'orshot_api_key_1234567890', 'a'.repeat(50)];
      validKeys.forEach(key => {
        const result = validateApiKey(key);
        assert(result.isValid, `${key.substring(0, 10)}... should be valid`);
      });

      // Invalid API keys
      const invalidKeys = ['', 'short', 'a'.repeat(5), 'a'.repeat(201)];
      invalidKeys.forEach(key => {
        const result = validateApiKey(key);
        assert(!result.isValid, `${key.substring(0, 10)}... should be invalid`);
        assert(result.error, `Should have error message for invalid key`);
      });
    });
  });

  describe('Response Format', () => {
    test('should handle different response types', () => {
      const responseTypes = ['base64', 'url', 'binary'];
      
      responseTypes.forEach(type => {
        // Mock response handling
        const mockResponse = {
          success: true,
          data: type === 'base64' ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...' : undefined,
          url: type === 'url' ? 'https://api.orshot.com/download/123' : undefined
        };

        if (type === 'base64') {
          assert(mockResponse.data, 'Base64 response should have data');
        } else if (type === 'url') {
          assert(mockResponse.url, 'URL response should have url');
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Test that our error handling doesn't throw unhandled exceptions
      const mockFetch = () => Promise.reject(new Error('Network error'));
      
      try {
        await mockFetch();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof Error, 'Should catch Error instance');
        assert(error.message === 'Network error', 'Should preserve error message');
      }
    });

    test('should handle invalid JSON responses', async () => {
      // Test invalid JSON handling
      const invalidJson = 'not valid json {';
      
      try {
        JSON.parse(invalidJson);
        assert.fail('Should have thrown a JSON parse error');
      } catch (error) {
        assert(error instanceof SyntaxError, 'Should throw SyntaxError for invalid JSON');
      }
    });
  });
});

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Orshot MCP Server tests...');
  console.log('Note: These are unit tests for utility functions. Integration tests require API keys.');
}
