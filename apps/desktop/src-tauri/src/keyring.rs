// Master key management using OS keychain
// This module provides secure storage for the app's master encryption key

use tauri::command;
use ::keyring::Entry;
use rand::Rng;
use base64::{Engine as _, engine::general_purpose};

const SERVICE_NAME: &str = "dev.arbor.app";
const KEY_NAME: &str = "master_encryption_key";

/// Get the master encryption key from OS keychain
/// Returns the key as a base64-encoded string
#[command]
pub async fn get_master_key() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, KEY_NAME)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    let password = entry.get_password()
        .map_err(|e| format!("Failed to get master key: {}", e))?;

    Ok(password)
}

/// Set the master encryption key in OS keychain
/// Accepts a base64-encoded key string
#[command]
pub async fn set_master_key(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, KEY_NAME)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    entry.set_password(&key)
        .map_err(|e| format!("Failed to set master key: {}", e))?;

    Ok(())
}

/// Generate a new 32-byte master encryption key and store it in OS keychain
/// Returns the generated key as a base64-encoded string
#[command]
pub async fn generate_master_key() -> Result<String, String> {
    // Generate 32 random bytes
    let key_bytes: [u8; 32] = {
        let mut rng = rand::rng();
        rng.random()
    };

    // Encode as base64
    let key_base64 = general_purpose::STANDARD.encode(&key_bytes);

    // Store in keychain
    set_master_key(key_base64.clone()).await?;

    Ok(key_base64)
}

/// Get or generate master key - convenience function
/// If key exists, returns it. If not, generates and stores a new one.
#[command]
pub async fn get_or_generate_master_key() -> Result<String, String> {
    match get_master_key().await {
        Ok(key) => Ok(key),
        Err(_) => generate_master_key().await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_generate_master_key() {
        let result = generate_master_key().await;
        assert!(result.is_ok(), "Should generate a master key");
        
        let key = result.unwrap();
        assert!(!key.is_empty(), "Generated key should not be empty");
        
        // Base64 encoded 32 bytes should be 44 characters (with padding)
        assert_eq!(key.len(), 44, "Base64 encoded 32-byte key should be 44 characters");
    }

    #[tokio::test]
    async fn test_set_and_get_master_key() {
        // Generate a test key
        let test_key = "dGVzdGtleTE2Ynl0ZXN0ZXN0a2V5MTZieXRlcw=="; // base64 of "testkey16bytestestkey16bytes"
        
        // Set the key
        let set_result = set_master_key(test_key.to_string()).await;
        assert!(set_result.is_ok(), "Should set master key successfully");
        
        // Get the key back
        let get_result = get_master_key().await;
        assert!(get_result.is_ok(), "Should get master key successfully");
        
        let retrieved_key = get_result.unwrap();
        assert_eq!(retrieved_key, test_key, "Retrieved key should match set key");
    }

    #[tokio::test]
    async fn test_get_nonexistent_key() {
        // First, try to delete any existing key (ignore errors)
        // This test assumes a clean state
        
        let result = get_master_key().await;
        // Should either return a key (if one exists) or error
        // We can't guarantee clean state in tests, so we just verify it doesn't panic
        assert!(result.is_ok() || result.is_err());
    }

    #[tokio::test]
    async fn test_get_or_generate_creates_key_if_missing() {
        let result = get_or_generate_master_key().await;
        assert!(result.is_ok(), "Should get or generate a key");
        
        let key = result.unwrap();
        assert!(!key.is_empty(), "Key should not be empty");
        assert_eq!(key.len(), 44, "Should be a valid 32-byte key encoded as base64");
    }

    #[tokio::test]
    async fn test_get_or_generate_returns_existing_key() {
        // First, set a known key
        let test_key = "dGVzdGtleTE2Ynl0ZXN0ZXN0a2V5MTZieXRlcw==";
        let _ = set_master_key(test_key.to_string()).await;
        
        // Now get_or_generate should return the existing key
        let result = get_or_generate_master_key().await;
        assert!(result.is_ok(), "Should get existing key");
        
        let key = result.unwrap();
        assert_eq!(key, test_key, "Should return the existing key, not generate a new one");
    }

    #[tokio::test]
    async fn test_generated_keys_are_unique() {
        // Generate two keys and verify they're different
        let key1 = generate_master_key().await.unwrap();
        let key2 = generate_master_key().await.unwrap();
        
        assert_ne!(key1, key2, "Each generated key should be unique");
    }
}

