const express = require('express');
const analysisController = require('../controllers/analysisController');
const gcsService = require('../services/gcsService');

const router = express.Router();

/**
 * POST /api/analysis/start
 * Start comprehensive tactical analysis pipeline
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
    
    // Start analysis pipeline (async - returns immediately)
    setImmediate(() => {
      analysisController.processVideo(analysisRequest, {
        json: (result) => {
          console.log(`✅ Analysis completed for ${videoId}:`, result.success ? 'SUCCESS' : 'FAILED');
        },
        status: (code) => ({ json: (result) => console.log(`❌ Analysis failed for ${videoId} with status ${code}`) })
      });
    });
    
    res.json({
      success: true,
      videoId: videoId,
      status: 'analysis_started',
      message: 'Tactical analysis pipeline started',
      estimatedTime: '3-5 minutes',
      trackingInfo: {
        socketRoom: `analysis-${videoId}`,
        progressEvents: ['analysis-progress', 'analysis-completed', 'analysis-error']
      }
    });
    
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
    
    // Start quick analysis pipeline
    setImmediate(() => {
      analysisController.processQuickAnalysis(quickAnalysisRequest, {
        json: (result) => {
          console.log(`⚡ Quick analysis completed for ${videoId}:`, result.success ? 'SUCCESS' : 'FAILED');
        },
        status: (code) => ({ json: (result) => console.log(`❌ Quick analysis failed for ${videoId}`) })
      });
    });
    
    res.json({
      success: true,
      videoId: videoId,
      type: 'quick_analysis',
      urgencyLevel: urgencyLevel,
      status: 'quick_analysis_started',
      message: 'Quick tactical analysis started',
      estimatedTime: '30-60 seconds',
      trackingInfo: {
        socketRoom: `analysis-${videoId}`,
        progressEvents: ['quick-analysis-progress', 'quick-analysis-completed']
      }
    });
    
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
    
    setImmediate(() => {
      analysisController.processVideo(resumeRequest, {
        json: (result) => {
          console.log(`🔄 Resumed analysis for ${videoId}:`, result.success ? 'SUCCESS' : 'FAILED');
        },
        status: (code) => ({ json: (result) => console.log(`❌ Resume failed for ${videoId}`) })
      });
    });
    
    res.json({
      success: true,
      videoId: videoId,
      status: 'analysis_resumed',
      resumedFromStage: resumeStage,
      stageStatus: stageStatus,
      message: 'Analysis resumed successfully'
    });
    
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
 * Get analysis history for all videos
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    console.log('📊 Fetching analysis history...');
    
    // Get all result files from GCS
    const [resultFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: 'results/'
    });
    
    const analysisHistory = [];
    
    // Process result files (limit to avoid timeout)
    const filesToProcess = resultFiles.slice(offset, offset + parseInt(limit));
    
    for (const file of filesToProcess) {
      try {
        const [content] = await file.download();
        const analysisData = JSON.parse(content.toString());
        
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
        total: resultFiles.length
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
