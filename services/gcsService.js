const { Storage } = require('@google-cloud/storage');

class GCSService {
  constructor() {
    try {
      // Production: Parse JSON credentials from environment
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: credentials
        });
        console.log('✅ Using JSON credentials for GCS');
      } else {
        // Fallback for development
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        console.log('✅ Using default credentials for GCS');
      }
      
      this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'tahleel-ai-videos';
      this.bucket = this.storage.bucket(this.bucketName);
      
      console.log(`✅ GCS initialized - Project: ${process.env.GOOGLE_CLOUD_PROJECT_ID}, Bucket: ${this.bucketName}`);
      
    } catch (error) {
      console.error('❌ GCS initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Test GCS connection
   */
  async testConnection() {
    try {
      console.log('🧪 Testing GCS connection...');
      
      // Test bucket access
      const [exists] = await this.bucket.exists();
      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }
      
      console.log('✅ GCS connection successful');
      return true;
      
    } catch (error) {
      console.error('❌ GCS connection test failed:', error.message);
      return false;
    }
  }

  // ... rest of your existing methods stay the same
}

module.exports = new GCSService();
