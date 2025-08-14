const ffmpeg = require('fluent-ffmpeg');
const gcsService = require('./gcsService');

class FrameService {
  constructor() {
    this.frameInterval = parseInt(process.env.FRAME_EXTRACTION_INTERVAL) || 10; // seconds
  }

  /**
   * Extract frames from video stored in GCS
   */
  async extractFrames(videoFileName, videoId, progressCallback) {
    try {
      console.log(`🎬 Starting frame extraction for video: ${videoFileName}`);
      
      // Generate signed URL for video download
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);
      
      // Get video duration first
      const duration = await this.getVideoDuration(videoUrl);
      console.log(`⏱️ Video duration: ${duration} seconds`);
      
      // Calculate frame timestamps
      const frameTimestamps = this.calculateFrameTimestamps(duration);
      console.log(`🖼️ Will extract ${frameTimestamps.length} frames`);
      
      const extractedFrames = [];
      
      // Extract frames at specified intervals
      for (let i = 0; i < frameTimestamps.length; i++) {
        const timestamp = frameTimestamps[i];
        
        try {
          const frameBuffer = await this.extractFrameAtTimestamp(videoUrl, timestamp);
          const frameFileName = await gcsService.uploadFrame(frameBuffer, videoId, i + 1);
          
          extractedFrames.push({
            frameNumber: i + 1,
            timestamp: timestamp,
            fileName: frameFileName,
            url: await gcsService.getFrameUrl(frameFileName)
          });
          
          // Progress callback
          if (progressCallback) {
            progressCallback({
              stage: 'frame_extraction',
              progress: Math.round(((i + 1) / frameTimestamps.length) * 100),
              message: `Extracted frame ${i + 1}/${frameTimestamps.length}`
            });
          }
          
        } catch (frameError) {
          console.error(`❌ Failed to extract frame at ${timestamp}s:`, frameError);
          // Continue with other frames
        }
      }
      
      console.log(`✅ Frame extraction completed: ${extractedFrames.length} frames`);
      return extractedFrames;
      
    } catch (error) {
      console.error('❌ Frame extraction failed:', error);
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Get video duration
   */
  async getVideoDuration(videoUrl) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video duration: ${err.message}`));
          return;
        }
        
        const duration = metadata.format.duration;
        resolve(Math.floor(duration));
      });
    });
  }

  /**
   * Calculate frame timestamps based on interval
   */
  calculateFrameTimestamps(duration) {
    const timestamps = [];
    
    // Always include first frame
    timestamps.push(5); // Skip first 5 seconds for better quality
    
    // Extract frames at regular intervals
    for (let time = this.frameInterval; time < duration - 10; time += this.frameInterval) {
      timestamps.push(time);
    }
    
    // Always include a frame near the end
    if (duration > 20) {
      timestamps.push(duration - 10);
    }
    
    return timestamps;
  }

  /**
   * Extract single frame at specific timestamp
   */
  async extractFrameAtTimestamp(videoUrl, timestamp) {
    return new Promise((resolve, reject) => {
      const buffers = [];
      
      ffmpeg(videoUrl)
        .seekInput(timestamp)
        .frames(1)
        .format('image2')
        .outputOptions([
          '-vf', 'scale=1280:720', // Resize for consistent processing
          '-q:v', '2' // High quality
        ])
        .on('error', (err) => {
          reject(new Error(`Frame extraction failed at ${timestamp}s: ${err.message}`));
        })
        .on('end', () => {
          const frameBuffer = Buffer.concat(buffers);
          resolve(frameBuffer);
        })
        .pipe()
        .on('data', (chunk) => {
          buffers.push(chunk);
        });
    });
  }

  /**
   * Extract key moments from video (goals, cards, etc.)
   */
  async extractKeyMoments(videoFileName, videoId, keyTimestamps, progressCallback) {
    try {
      console.log(`🔑 Extracting key moments for video: ${videoFileName}`);
      
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);
      const keyFrames = [];
      
      for (let i = 0; i < keyTimestamps.length; i++) {
        const timestamp = keyTimestamps[i];
        
        try {
          const frameBuffer = await this.extractFrameAtTimestamp(videoUrl, timestamp.time);
          const frameFileName = await gcsService.uploadFrame(
            frameBuffer, 
            videoId, 
            `key_${timestamp.type}_${i + 1}`
          );
          
          keyFrames.push({
            type: timestamp.type,
            timestamp: timestamp.time,
            description: timestamp.description || '',
            fileName: frameFileName,
            url: await gcsService.getFrameUrl(frameFileName)
          });
          
          if (progressCallback) {
            progressCallback({
              stage: 'key_moments',
              progress: Math.round(((i + 1) / keyTimestamps.length) * 100),
              message: `Extracted ${timestamp.type} at ${timestamp.time}s`
            });
          }
          
        } catch (frameError) {
          console.error(`❌ Failed to extract key moment at ${timestamp.time}s:`, frameError);
        }
      }
      
      console.log(`✅ Key moments extraction completed: ${keyFrames.length} frames`);
      return keyFrames;
      
    } catch (error) {
      console.error('❌ Key moments extraction failed:', error);
      throw new Error(`Key moments extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate video thumbnail
   */
  async generateThumbnail(videoFileName, videoId) {
    try {
      console.log(`📸 Generating thumbnail for video: ${videoFileName}`);
      
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);
      const duration = await this.getVideoDuration(videoUrl);
      
      // Extract thumbnail from middle of video
      const thumbnailTimestamp = Math.floor(duration / 2);
      const thumbnailBuffer = await this.extractFrameAtTimestamp(videoUrl, thumbnailTimestamp);
      
      const thumbnailFileName = await gcsService.uploadFrame(thumbnailBuffer, videoId, 'thumbnail');
      const thumbnailUrl = await gcsService.getFrameUrl(thumbnailFileName);
      
      console.log(`✅ Thumbnail generated: ${thumbnailFileName}`);
      
      return {
        fileName: thumbnailFileName,
        url: thumbnailUrl,
        timestamp: thumbnailTimestamp
      };
      
    } catch (error) {
      console.error('❌ Thumbnail generation failed:', error);
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }
}

module.exports = new FrameService();
