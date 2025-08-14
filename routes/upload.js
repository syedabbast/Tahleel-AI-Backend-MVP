const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const gcsService = require('../services/gcsService');

const router = express.Router();

// Configure multer for memory storage (we'll upload directly to GCS)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

/**
 * GET /api/upload/signed-url
 * Generate signed URL for direct video upload to GCS
 */
router.get('/signed-url', async (req, res) => {
  try {
    const { fileName, contentType } = req.query;
    
    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and contentType are required'
      });
    }
    
    // Validate content type
    if (!contentType.startsWith('video/')) {
      return res.status(400).json({
        success: false,
        error: 'Only video files are supported'
      });
    }
    
    console.log(`🔗 Generating signed upload URL for: ${fileName}`);
    
    const uploadData = await gcsService.generateSignedUploadUrl(fileName, contentType);
    
    res.json({
      success: true,
      uploadUrl: uploadData.uploadUrl,
      videoId: uploadData.videoId,
      fileName: uploadData.fileName,
      bucketName: uploadData.bucketName,
      expiresIn: '30 minutes',
      message: 'Upload URL generated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error generating signed upload URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL',
      message: error.message
    });
  }
});

/**
 * POST /api/upload/verify
 * Verify video upload completion and prepare for analysis
 */
router.post('/verify', async (req, res) => {
  try {
    const { videoId, fileName, matchMetadata } = req.body;
    
    if (!videoId || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'videoId and fileName are required'
      });
    }
    
    console.log(`✅ Verifying upload for video: ${videoId}`);
    
    // Check if file exists in GCS
    const fileExists = await gcsService.fileExists(fileName);
    
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        error: 'Video file not found in storage',
        videoId: videoId
      });
    }
    
    // Get file metadata
    const metadata = await gcsService.getFileMetadata(fileName);
    
    // Validate file size (should be > 1MB for real video)
    const fileSizeBytes = parseInt(metadata.size);
    const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));
    
    if (fileSizeBytes < 1024 * 1024) { // Less than 1MB
      return res.status(400).json({
        success: false,
        error: 'Video file too small - upload may have failed',
        videoId: videoId,
        fileSize: fileSizeMB + ' MB'
      });
    }
    
    console.log(`📊 Video verified: ${fileName} (${fileSizeMB} MB)`);
    
    // Prepare analysis metadata
    const analysisMetadata = {
      videoId: videoId,
      fileName: fileName,
      fileSize: fileSizeMB + ' MB',
      uploadTime: new Date().toISOString(),
      matchMetadata: matchMetadata || {},
      status: 'ready_for_analysis'
    };
    
    res.json({
      success: true,
      videoId: videoId,
      fileName: fileName,
      fileSize: fileSizeMB + ' MB',
      uploadTime: metadata.timeCreated,
      status: 'verified',
      readyForAnalysis: true,
      analysisMetadata: analysisMetadata,
      message: 'Video upload verified successfully'
    });
    
  } catch (error) {
    console.error('❌ Error verifying upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify upload',
      message: error.message
    });
  }
});

/**
 * POST /api/upload/direct
 * Direct video upload to backend (alternative to signed URL)
 */
router.post('/direct', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }
    
    const { matchMetadata } = req.body;
    const videoId = uuidv4();
    const fileName = `videos/${videoId}/${req.file.originalname}`;
    
    console.log(`📤 Direct upload starting for: ${req.file.originalname}`);
    
    // Upload to GCS
    const file = gcsService.bucket.file(fileName);
    
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          videoId: videoId,
          originalName: req.file.originalname,
          uploadTime: new Date().toISOString(),
          matchMetadata: JSON.stringify(matchMetadata || {})
        }
      }
    });
    
    const fileSizeMB = Math.round(req.file.size / (1024 * 1024));
    
    console.log(`✅ Direct upload completed: ${fileName} (${fileSizeMB} MB)`);
    
    res.json({
      success: true,
      videoId: videoId,
      fileName: fileName,
      originalName: req.file.originalname,
      fileSize: fileSizeMB + ' MB',
      contentType: req.file.mimetype,
      uploadMethod: 'direct',
      readyForAnalysis: true,
      message: 'Video uploaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Direct upload failed:', error);
    res.status(500).json({
      success: false,
      error: 'Direct upload failed',
      message: error.message
    });
  }
});

/**
 * GET /api/upload/status/:videoId
 * Check upload status and file information
 */
router.get('/status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Find video file in GCS
    const [files] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `videos/${videoId}/`
    });
    
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
        videoId: videoId
      });
    }
    
    const videoFile = files[0];
    const [metadata] = await videoFile.getMetadata();
    
    const fileSizeMB = Math.round(parseInt(metadata.size) / (1024 * 1024));
    
    res.json({
      success: true,
      videoId: videoId,
      fileName: videoFile.name,
      fileSize: fileSizeMB + ' MB',
      contentType: metadata.contentType,
      uploadTime: metadata.timeCreated,
      status: 'uploaded',
      readyForAnalysis: true
    });
    
  } catch (error) {
    console.error('❌ Error checking upload status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check upload status',
      message: error.message
    });
  }
});

/**
 * DELETE /api/upload/:videoId
 * Delete uploaded video and associated files
 */
router.delete('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    console.log(`🗑️ Deleting video and associated files: ${videoId}`);
    
    // Delete video files
    const [videoFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `videos/${videoId}/`
    });
    
    // Delete frame files
    const [frameFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `frames/${videoId}/`
    });
    
    // Delete result files
    const [resultFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `results/${videoId}/`
    });
    
    const allFiles = [...videoFiles, ...frameFiles, ...resultFiles];
    
    if (allFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No files found for videoId',
        videoId: videoId
      });
    }
    
    // Delete all files
    const deletePromises = allFiles.map(file => file.delete());
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${allFiles.length} files for video: ${videoId}`);
    
    res.json({
      success: true,
      videoId: videoId,
      deletedFiles: allFiles.length,
      message: 'Video and associated files deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video',
      message: error.message
    });
  }
});

/**
 * GET /api/upload/test
 * Test upload service functionality
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    service: 'TAHLEEL.ai Upload Service',
    status: 'operational',
    endpoints: {
      signed_url: 'GET /api/upload/signed-url',
      verify: 'POST /api/upload/verify',
      direct: 'POST /api/upload/direct',
      status: 'GET /api/upload/status/:videoId',
      delete: 'DELETE /api/upload/:videoId'
    },
    configuration: {
      max_file_size: '500MB',
      supported_formats: ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'],
      storage: 'Google Cloud Storage',
      upload_methods: ['signed_url', 'direct']
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
