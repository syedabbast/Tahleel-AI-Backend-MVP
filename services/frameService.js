const ffmpeg = require('fluent-ffmpeg');
const gcsService = require('./gcsService');
const winston = require('winston');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');

const MAX_CONCURRENT_FRAMES = parseInt(process.env.FRAME_EXTRACTION_CONCURRENCY) || 8;
const RETRY_LIMIT = parseInt(process.env.FRAME_EXTRACTION_RETRIES) || 2;

// Setup Winston logger for enterprise-grade logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/frame-service.log' })
  ]
});

class FrameService {
  constructor() {
    this.frameInterval = parseInt(process.env.FRAME_EXTRACTION_INTERVAL) || 10; // seconds
  }

  /**
   * Extract frames from video stored in GCS
   * Parallelized for performance
   */
  async extractFrames(videoFileName, videoId, progressCallback) {
    logger.info(`🎬 Starting frame extraction for video: ${videoFileName}`, { videoId });
    try {
      // Generate signed URL for video download
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);

      // Get video duration first
      const duration = await this.getVideoDuration(videoUrl);
      logger.info(`⏱️ Video duration: ${duration} seconds`, { videoId });

      // Calculate frame timestamps
      const frameTimestamps = this.calculateFrameTimestamps(duration);
      logger.info(`🖼️ Will extract ${frameTimestamps.length} frames`, { videoId });

      const extractedFrames = [];
      let completed = 0;

      // Parallelize frame extraction and upload
      const tasks = frameTimestamps.map((timestamp, i) => async () => {
        for (let attempt = 1; attempt <= RETRY_LIMIT + 1; attempt++) {
          try {
            // Extract frame as buffer
            const frameBuffer = await this.extractFrameAtTimestamp(videoUrl, timestamp);
            // Upload frame to GCS
            const frameFileName = await gcsService.uploadFrame(frameBuffer, videoId, i + 1);
            const frameUrl = await gcsService.getFrameUrl(frameFileName);
            extractedFrames[i] = {
              frameNumber: i + 1,
              timestamp: timestamp,
              fileName: frameFileName,
              url: frameUrl
            };

            completed++;
            if (progressCallback) {
              progressCallback({
                stage: 'frame_extraction',
                progress: Math.round((completed / frameTimestamps.length) * 100),
                message: `Extracted frame ${completed}/${frameTimestamps.length}`
              });
            }
            logger.info(`✅ Extracted frame ${i + 1} at ${timestamp}s`, { videoId, timestamp, frameFileName });
            break; // Success, exit retry loop
          } catch (err) {
            logger.error(`❌ Failed to extract/upload frame at ${timestamp}s (Attempt ${attempt}): ${err.message}`, {
              videoId,
              timestamp,
              error: err
            });
            if (attempt > RETRY_LIMIT) {
              // Final failure, store empty record
              extractedFrames[i] = {
                frameNumber: i + 1,
                timestamp,
                fileName: null,
                url: null,
                error: err.message
              };
            } else {
              // Wait before retrying
              await new Promise(res => setTimeout(res, 1000 * attempt));
            }
          }
        }
      });

      // Run tasks in parallel batches
      await this.runConcurrent(tasks, MAX_CONCURRENT_FRAMES);

      logger.info(`✅ Frame extraction completed: ${extractedFrames.filter(f => f.fileName).length} frames`, { videoId });
      return extractedFrames;

    } catch (error) {
      logger.error('❌ Frame extraction failed', { videoId, error });
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Utility: Run async tasks in batches for concurrency
   */
  async runConcurrent(tasks, concurrency) {
    let i = 0;
    await Promise.all(
      Array.from({ length: concurrency }).map(async () => {
        while (i < tasks.length) {
          const idx = i++;
          await tasks[idx]();
        }
      })
    );
  }

  /**
   * Get video duration
   */
  async getVideoDuration(videoUrl) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          logger.error('Failed to get video duration', { videoUrl, error: err });
          return reject(new Error(`Failed to get video duration: ${err.message}`));
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
    // Always include first frame after 5s for better quality
    timestamps.push(5);
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
    // Save to temporary file due to ffmpeg/fluent-ffmpeg streaming issues under load
    const tmpFile = path.join(os.tmpdir(), `frame_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`);
    return new Promise((resolve, reject) => {
      ffmpeg(videoUrl)
        .seekInput(timestamp)
        .frames(1)
        .output(tmpFile)
        .outputOptions([
          '-vf', 'scale=1280:720', // Resize for consistent processing
          '-q:v', '2' // High quality
        ])
        .on('error', (err) => {
          logger.error(`Frame extraction failed at ${timestamp}s`, { videoUrl, timestamp, error: err });
          fs.existsSync(tmpFile) && fs.unlinkSync(tmpFile); // Clean up
          reject(new Error(`Frame extraction failed at ${timestamp}s: ${err.message}`));
        })
        .on('end', () => {
          // Read buffer from file then clean up
          fs.readFile(tmpFile, (readErr, frameBuffer) => {
            fs.existsSync(tmpFile) && fs.unlinkSync(tmpFile); // Clean up
            if (readErr) {
              logger.error('Failed to read extracted frame file', { tmpFile, error: readErr });
              reject(new Error(`Failed to read extracted frame: ${readErr.message}`));
            } else {
              resolve(frameBuffer);
            }
          });
        })
        .run();
    });
  }

  // Key moments and thumbnail methods remain unchanged, but should also use logger for errors
  async extractKeyMoments(videoFileName, videoId, keyTimestamps, progressCallback) {
    logger.info(`🔑 Extracting key moments for video: ${videoFileName}`, { videoId });
    try {
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);
      const keyFrames = [];
      let completed = 0;

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
          completed++;
          if (progressCallback) {
            progressCallback({
              stage: 'key_moments',
              progress: Math.round((completed / keyTimestamps.length) * 100),
              message: `Extracted ${timestamp.type} at ${timestamp.time}s`
            });
          }
          logger.info(`✅ Extracted key moment ${timestamp.type} at ${timestamp.time}s`, { videoId, timestamp: timestamp.time, frameFileName });
        } catch (frameError) {
          logger.error(`❌ Failed to extract key moment at ${timestamp.time}s`, { videoId, timestamp: timestamp.time, error: frameError });
        }
      }
      logger.info(`✅ Key moments extraction completed: ${keyFrames.length} frames`, { videoId });
      return keyFrames;

    } catch (error) {
      logger.error('❌ Key moments extraction failed', { videoId, error });
      throw new Error(`Key moments extraction failed: ${error.message}`);
    }
  }

  async generateThumbnail(videoFileName, videoId) {
    logger.info(`📸 Generating thumbnail for video: ${videoFileName}`, { videoId });
    try {
      const videoUrl = await gcsService.generateSignedDownloadUrl(videoFileName);
      const duration = await this.getVideoDuration(videoUrl);
      const thumbnailTimestamp = Math.floor(duration / 2);
      const thumbnailBuffer = await this.extractFrameAtTimestamp(videoUrl, thumbnailTimestamp);
      const thumbnailFileName = await gcsService.uploadFrame(thumbnailBuffer, videoId, 'thumbnail');
      const thumbnailUrl = await gcsService.getFrameUrl(thumbnailFileName);
      logger.info(`✅ Thumbnail generated: ${thumbnailFileName}`, { videoId });
      return {
        fileName: thumbnailFileName,
        url: thumbnailUrl,
        timestamp: thumbnailTimestamp
      };

    } catch (error) {
      logger.error('❌ Thumbnail generation failed', { videoId, error });
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }
}

module.exports = new FrameService();
