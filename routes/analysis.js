const express = require('express');
const analysisController = require('../controllers/analysisController');
const gcsService = require('../services/gcsService');

const router = express.Router();

/**
 * POST /api/analysis/start
 * Start comprehensive tactical analysis pipeline (async job)
 * ENFORCES PER-USER MONTHLY QUOTA
 */
router.post('/start', async (req, res) => {
  try {
    const { videoId, matchMetadata } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId is required'
      });
    }

    // === ENTERPRISE QUOTA ENFORCEMENT ===
    const MONTHLY_QUOTA = 10;
    // Get userId/userEmail from matchMetadata (passed from frontend)
    const userId = matchMetadata?.userId;
    const userEmail = matchMetadata?.userEmail;
    if (!userId && !userEmail) {
      return res.status(401).json({
        success: false,
        error: 'userId or userEmail required for quota enforcement'
      });
    }

    // Count number of completed analyses for this user in the current month
    const [resultFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: 'results/'
    });

    const now = new Date();
    const thisMonth = now.getMonth();
    let quotaUsed = 0;

    for (const file of resultFiles) {
      try {
        const [content] = await file.download();
        const analysisData = JSON.parse(content.toString());
        const md = analysisData.matchMetadata || {};
        if (
          ((userId && md.userId === userId) ||
           (userEmail && md.userEmail === userEmail))
        ) {
          const date = new Date(analysisData.analysis_state?.endTime || analysisData.analysis_state?.startTime);
          if (date.getMonth() === thisMonth && date.getFullYear() === now.getFullYear()) {
            quotaUsed++;
          }
        }
      } catch {}
    }

    if (quotaUsed >= MONTHLY_QUOTA) {
      return res.status(403).json({
        success: false,
        error: 'Monthly quota exceeded',
        quota: { used: quotaUsed, allowed: MONTHLY_QUOTA }
      });
    }
    // === END QUOTA ENFORCEMENT ===

    console.log(`🚀 Starting tactical analysis for video: ${videoId}`);

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
    const videoFileName = videoFile.name;

    // Prepare request for analysis controller
    const analysisRequest = {
      body: {
        videoId: videoId,
        videoFileName: videoFileName,
        matchMetadata: matchMetadata || {}
      },
      app: req.app // Pass app for Socket.io access
    };

    // Start analysis job asynchronously and return immediately
    await analysisController.startAnalysisJob(analysisRequest, res);

    // The controller will handle the immediate response and launch background processing.
  } catch (error) {
    console.error('❌ Error starting analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/analysis/quick
 * Start quick tactical analysis for urgent needs
 */
router.post('/quick', async (req, res) => {
  try {
    const { videoId, urgencyLevel = 'high' } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId is required'
      });
    }

    console.log(`⚡ Starting quick analysis for video: ${videoId}`);

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
    const videoFileName = videoFile.name;

    // Prepare request for quick analysis
    const quickAnalysisRequest = {
      body: {
        videoId: videoId,
        videoFileName: videoFileName,
        urgencyLevel: urgencyLevel
      },
      app: req.app
    };

    // Start quick analysis pipeline asynchronously and return immediately
    await analysisController.processQuickAnalysis(quickAnalysisRequest, res);

    // The controller handles both immediate response and analysis.
  } catch (error) {
    console.error('❌ Error starting quick analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start quick analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/status/:videoId
 * Get current analysis status and progress
 */
router.get('/status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Use analysis controller to get status
    const statusRequest = {
      params: { videoId: videoId }
    };

    await analysisController.getAnalysisStatus(statusRequest, res);

  } catch (error) {
    console.error('❌ Error getting analysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis status',
      message: error.message
    });
  }
});

/**
 * POST /api/analysis/resume/:videoId
 * Resume failed or interrupted analysis
 */
router.post('/resume/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { fromStage = 'frame_extraction' } = req.body;

    console.log(`🔄 Resuming analysis for video: ${videoId} from stage: ${fromStage}`);

    // Find video file
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
    const videoFileName = videoFile.name;

    // Check what stages are already completed
    const stageStatus = {
      frame_extraction: await gcsService.storage.bucket(gcsService.bucketName).getFiles({
        prefix: `frames/${videoId}/`
      }).then(([files]) => files.length > 0),
      analysis_result: await gcsService.fileExists(`results/${videoId}/analysis.json`)
    };

    // Determine resume strategy
    let resumeStage = fromStage;
    if (stageStatus.analysis_result) {
      return res.json({
        success: true,
        videoId: videoId,
        status: 'already_completed',
        message: 'Analysis already completed'
      });
    }

    // Restart analysis from appropriate stage
    const resumeRequest = {
      body: {
        videoId: videoId,
        videoFileName: videoFileName,
        resumeFromStage: resumeStage,
        matchMetadata: {}
      },
      app: req.app
    };

    // Use the async job starter for resume as well
    await analysisController.startAnalysisJob(resumeRequest, res);

  } catch (error) {
    console.error('❌ Error resuming analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/analysis/cancel/:videoId
 * Cancel ongoing analysis
 */
router.post('/cancel/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const io = req.app.get('io');

    console.log(`🛑 Cancelling analysis for video: ${videoId}`);

    // Emit cancellation event
    io.to(`analysis-${videoId}`).emit('analysis-cancelled', {
      videoId: videoId,
      status: 'cancelled',
      timestamp: new Date().toISOString()
    });

    // Cleanup temporary files
    setTimeout(async () => {
      try {
        await gcsService.cleanupTempFiles(videoId);
        console.log(`🧹 Cleanup completed for cancelled analysis: ${videoId}`);
      } catch (cleanupError) {
        console.error('❌ Cleanup failed for cancelled analysis:', cleanupError);
      }
    }, 5000);

    res.json({
      success: true,
      videoId: videoId,
      status: 'cancelled',
      message: 'Analysis cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/history
 * Get analysis history for current user only (multi-user filter)
 */
router.get('/history', async (req, res) => {
  try {
    // Accept userId/userEmail from query params
    const { limit = 10, offset = 0, userId, userEmail } = req.query;

    console.log('📊 Fetching analysis history...');

    // Get all result files from GCS
    const [resultFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: 'results/'
    });

    const analysisHistory = [];

    // Process files (limit to avoid timeout)
    const filesToProcess = resultFiles.slice(offset, offset + parseInt(limit));

    for (const file of filesToProcess) {
      try {
        const [content] = await file.download();
        const analysisData = JSON.parse(content.toString());
        const md = analysisData.matchMetadata || {};

        // If userId/userEmail provided, filter jobs for this user only
        if (userId && md.userId !== userId) continue;
        if (userEmail && md.userEmail !== userEmail) continue;

        analysisHistory.push({
          videoId: analysisData.videoId,
          processingTime: analysisData.processing_stats?.total_time,
          analysisDate: analysisData.analysis_state?.endTime || analysisData.analysis_state?.startTime,
          status: analysisData.analysis_state?.status,
          framesAnalyzed: analysisData.frame_extraction?.total_frames,
          confidenceScore: analysisData.final_report?.final_report?.report_metrics?.confidence_score || 'N/A'
        });
      } catch (parseError) {
        console.error('❌ Error parsing analysis file:', parseError);
      }
    }

    res.json({
      success: true,
      history: analysisHistory,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: analysisHistory.length
      },
      message: 'Analysis history retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error getting analysis history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis history',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/test
 * Test analysis service functionality
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    service: 'TAHLEEL.ai Analysis Service',
    status: 'operational',
    pipeline: {
      stage1: 'Frame Extraction (FFmpeg)',
      stage2: 'GPT-4 Vision Analysis',
      stage3: 'Claude Tactical Enhancement',
      stage4: 'Final Report Generation'
    },
    endpoints: {
      start: 'POST /api/analysis/start',
      quick: 'POST /api/analysis/quick',
      status: 'GET /api/analysis/status/:videoId',
      resume: 'POST /api/analysis/resume/:videoId',
      cancel: 'POST /api/analysis/cancel/:videoId',
      history: 'GET /api/analysis/history'
    },
    features: {
      real_time_progress: 'Socket.io events',
      estimated_time: '3-5 minutes full analysis',
      quick_analysis: '30-60 seconds',
      ai_models: ['GPT-4 Vision', 'Claude 3.5 Sonnet']
    },
    target_market: 'Arab League Teams ($15K-$45K subscriptions)',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
