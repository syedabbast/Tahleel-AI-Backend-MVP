const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');

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

  /**
   * Generate signed URL for video upload
   */
  async generateSignedUploadUrl(fileName, contentType) {
    try {
      const videoId = uuidv4();
      const fullFileName = `videos/${videoId}/${fileName}`;
      
      const file = this.bucket.file(fullFileName);
      
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 30 * 60 * 1000, // 30 minutes
        contentType: contentType
      });
      
      console.log(`📤 Generated upload URL for: ${fullFileName}`);
      
      return {
        uploadUrl: signedUrl,
        fileName: fullFileName,
        videoId: videoId,
        bucketName: this.bucketName
      };
      
    } catch (error) {
      console.error('❌ Error generating signed upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for reading video - MISSING METHOD THAT CAUSED THE ERROR
   */
  async generateSignedDownloadUrl(fileName) {
    try {
      const file = this.bucket.file(fileName);
      
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      
      console.log(`📥 Generated download URL for: ${fileName}`);
      return signedUrl;
      
    } catch (error) {
      console.error('❌ Error generating signed download URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Upload frame to GCS temp folder
   */
  async uploadFrame(frameBuffer, videoId, frameNumber) {
    try {
      const fileName = `frames/${videoId}/frame_${frameNumber.toString().padStart(4, '0')}.jpg`;
      const file = this.bucket.file(fileName);
      
      await file.save(frameBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            videoId: videoId,
            frameNumber: frameNumber.toString(),
            uploadTime: new Date().toISOString()
          }
        }
      });
      
      console.log(`🖼️ Uploaded frame: ${fileName}`);
      return fileName;
      
    } catch (error) {
      console.error('❌ Error uploading frame:', error);
      throw new Error(`Failed to upload frame: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for frame
   */
  async getFrameUrl(fileName) {
    try {
      const file = this.bucket.file(fileName);
      
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 30 * 60 * 1000, // 30 minutes
      });
      
      return signedUrl;
      
    } catch (error) {
      console.error('❌ Error generating frame URL:', error);
      throw new Error(`Failed to generate frame URL: ${error.message}`);
    }
  }

  /**
   * Upload analysis result
   */
  async uploadAnalysisResult(analysisData, videoId) {
    try {
      const fileName = `results/${videoId}/analysis.json`;
      const file = this.bucket.file(fileName);
      
      await file.save(JSON.stringify(analysisData, null, 2), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            videoId: videoId,
            analysisTime: new Date().toISOString(),
            version: '1.0.0'
          }
        }
      });
      
      console.log(`📊 Uploaded analysis result: ${fileName}`);
      return fileName;
      
    } catch (error) {
      console.error('❌ Error uploading analysis result:', error);
      throw new Error(`Failed to upload analysis result: ${error.message}`);
    }
  }

  /**
   * Download analysis result
   */
  async downloadAnalysisResult(videoId) {
    try {
      const fileName = `results/${videoId}/analysis.json`;
      const file = this.bucket.file(fileName);
      
      const [content] = await file.download();
      const analysisData = JSON.parse(content.toString());
      
      console.log(`📥 Downloaded analysis result for video: ${videoId}`);
      return analysisData;
      
    } catch (error) {
      console.error('❌ Error downloading analysis result:', error);
      throw new Error(`Failed to download analysis result: ${error.message}`);
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanupTempFiles(videoId) {
    try {
      // Delete frames
      const [frameFiles] = await this.bucket.getFiles({
        prefix: `frames/${videoId}/`
      });
      
      const deletePromises = frameFiles.map(file => file.delete());
      await Promise.all(deletePromises);
      
      console.log(`🧹 Cleaned up ${frameFiles.length} temp frames for video: ${videoId}`);
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      // Don't throw error for cleanup failures
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(fileName) {
    try {
      const file = this.bucket.file(fileName);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error('❌ Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName) {
    try {
      const file = this.bucket.file(fileName);
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      console.error('❌ Error getting file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

module.exports = new GCSService();
