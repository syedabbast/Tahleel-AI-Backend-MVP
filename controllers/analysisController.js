const gcsService = require('../services/gcsService');
const frameService = require('../services/frameService');
const gpt4Service = require('../services/gpt4Service');
const claudeService = require('../services/claudeService');

class AnalysisController {
  /**
   * Main analysis pipeline orchestrator (background process)
   */
  async processVideoBackground(videoId, videoFileName, matchMetadata, io) {
    let analysisState = {
      videoId: videoId,
      status: 'processing',
      currentStage: 'initialization',
      progress: 0,
      startTime: new Date().toISOString(),
      stages: {
        frame_extraction: { status: 'pending', progress: 0 },
        gpt4_analysis: { status: 'pending', progress: 0 },
        claude_enhancement: { status: 'pending', progress: 0 },
        final_report: { status: 'pending', progress: 0 }
      }
    };

    try {
      console.log(`🚀 Starting analysis pipeline for video: ${videoId}`);

      // Emit initial status
      io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);

      // Progress callback function
      const progressCallback = (update) => {
        analysisState.currentStage = update.stage;
        analysisState.progress = this.calculateOverallProgress(analysisState.stages, update);
        analysisState.stages[update.stage] = {
          status: 'processing',
          progress: update.progress,
          message: update.message
        };

        io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);
        console.log(`📊 Progress: ${update.stage} - ${update.progress}% - ${update.message}`);
      };

      // STAGE 1: Frame Extraction
      console.log('🎬 Stage 1: Frame Extraction');
      analysisState.currentStage = 'frame_extraction';
      io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);

      const frames = await frameService.extractFrames(
        videoFileName,
        videoId,
        progressCallback
      );

      analysisState.stages.frame_extraction = { status: 'completed', progress: 100 };

      if (frames.length === 0) {
        throw new Error('No frames extracted from video');
      }

      // STAGE 2: GPT-4 Vision Analysis
      console.log('🤖 Stage 2: GPT-4 Vision Analysis');
      analysisState.currentStage = 'gpt4_analysis';
      io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);

      const gpt4Analysis = await gpt4Service.analyzeFrames(frames, progressCallback);

      analysisState.stages.gpt4_analysis = { status: 'completed', progress: 100 };

      // Generate GPT-4 match summary
      const matchSummary = await gpt4Service.generateMatchSummary(gpt4Analysis, matchMetadata);

      // STAGE 3: Claude Enhancement
      console.log('🧠 Stage 3: Claude Tactical Enhancement');
      analysisState.currentStage = 'claude_enhancement';
      io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);

      const enhancement = await claudeService.enhanceTacticalAnalysis({
        frame_analyses: gpt4Analysis,
        match_summary: matchSummary
      }, matchMetadata);

      analysisState.stages.claude_enhancement = { status: 'completed', progress: 100 };

      // STAGE 4: Final Report Generation
      console.log('📊 Stage 4: Final Report Generation');
      analysisState.currentStage = 'final_report';
      io.to(`analysis-${videoId}`).emit('analysis-progress', analysisState);

      const processingStats = {
        total_time: this.calculateProcessingTime(analysisState.startTime),
        frames_analyzed: frames.length,
        gpt4_analyses: gpt4Analysis.length,
        claude_enhancements: 1,
        analysis_quality: 'enterprise_grade'
      };

      const finalReport = await claudeService.generateFinalReport(
        enhancement,
        matchMetadata,
        processingStats
      );

      analysisState.stages.final_report = { status: 'completed', progress: 100 };

      // Compile complete analysis result
      const completeAnalysis = {
        videoId: videoId,
        matchMetadata: matchMetadata,
        processing_stats: processingStats,
        frame_extraction: {
          total_frames: frames.length,
          frame_details: frames
        },
        gpt4_analysis: {
          frame_analyses: gpt4Analysis,
          match_summary: matchSummary
        },
        claude_enhancement: enhancement,
        final_report: finalReport,
        analysis_state: {
          ...analysisState,
          status: 'completed',
          endTime: new Date().toISOString(),
          totalProcessingTime: processingStats.total_time
        }
      };

      // Store analysis result in GCS
      await gcsService.uploadAnalysisResult(completeAnalysis, videoId);

      // Cleanup temporary files
      setTimeout(async () => {
        try {
          await gcsService.cleanupTempFiles(videoId);
          console.log(`🧹 Cleanup completed for video: ${videoId}`);
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError);
        }
      }, parseInt(process.env.TEMP_CLEANUP_DELAY_MINUTES) * 60 * 1000 || 30 * 60 * 1000);

      // Final progress update
      analysisState.status = 'completed';
      analysisState.progress = 100;
      io.to(`analysis-${videoId}`).emit('analysis-completed', {
        videoId: videoId,
        status: 'completed',
        result: completeAnalysis,
        processingTime: processingStats.total_time
      });

      console.log(`✅ Analysis pipeline completed for video: ${videoId}`);
      console.log(`⏱️ Total processing time: ${processingStats.total_time}`);

    } catch (error) {
      console.error(`❌ Analysis pipeline failed for video ${videoId}:`, error);

      // FIXED: analysisState is now accessible here
      const errorState = {
        videoId: videoId,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString(),
        currentStage: analysisState.currentStage || 'unknown'
      };

      io.to(`analysis-${videoId}`).emit('analysis-error', errorState);
    }
  }

  /**
   * Route handler: starts analysis job asynchronously
   */
  async startAnalysisJob(req, res) {
    const { videoId, videoFileName, matchMetadata } = req.body;
    const io = req.app.get('io');

    // Respond immediately
    res.json({
      success: true,
      jobStarted: true,
      videoId,
      message: 'Analysis job started.',
    });

    // Start analysis in background
    setImmediate(() => {
      this.processVideoBackground(videoId, videoFileName, matchMetadata, io)
        .catch((error) => {
          console.error(`❌ Background analysis failed for video ${videoId}:`, error);
          io.to(`analysis-${videoId}`).emit('analysis-error', {
            videoId,
            status: 'failed',
            error: error.message,
            failedAt: new Date().toISOString(),
            currentStage: 'initialization',
          });
        });
    });
  }

  /**
   * Quick analysis for urgent tactical needs (unchanged)
   */
  async processQuickAnalysis(req, res) {
    const { videoId, videoFileName, urgencyLevel = 'high' } = req.body;
    const io = req.app.get('io');

    try {
      console.log(`⚡ Starting quick analysis for video: ${videoId}`);

      // Extract fewer frames for speed (every 30 seconds instead of 10)
      const quickFrames = await frameService.extractFrames(
        videoFileName,
        videoId,
        (progress) => {
          io.to(`analysis-${videoId}`).emit('quick-analysis-progress', progress);
        },
        30 // 30-second intervals
      );

      // Analyze only first 5 frames for immediate insights
      const limitedFrames = quickFrames.slice(0, 5);
      const quickGPTAnalysis = await gpt4Service.analyzeFrames(limitedFrames);

      // Generate quick insights with Claude Haiku
      const quickInsights = await claudeService.generateQuickInsights(
        quickGPTAnalysis,
        urgencyLevel
      );

      const quickResult = {
        videoId: videoId,
        analysis_type: 'quick_analysis',
        urgency_level: urgencyLevel,
        frames_analyzed: limitedFrames.length,
        quick_insights: quickInsights,
        processing_time: this.calculateProcessingTime(new Date().toISOString()),
        timestamp: new Date().toISOString()
      };

      io.to(`analysis-${videoId}`).emit('quick-analysis-completed', quickResult);

      res.json({
        success: true,
        videoId: videoId,
        type: 'quick_analysis',
        result: quickResult,
        message: 'Quick tactical insights generated'
      });

    } catch (error) {
      console.error(`❌ Quick analysis failed for video ${videoId}:`, error);

      res.status(500).json({
        success: false,
        videoId: videoId,
        type: 'quick_analysis',
        error: error.message
      });
    }
  }

  /**
   * Calculate overall progress across all stages
   */
  calculateOverallProgress(stages, currentUpdate) {
    const stageWeights = {
      frame_extraction: 25,
      gpt4_analysis: 40,
      claude_enhancement: 25,
      final_report: 10
    };

    let totalProgress = 0;

    Object.keys(stages).forEach(stage => {
      const stageProgress = stages[stage].progress || 0;
      const weight = stageWeights[stage] || 0;
      totalProgress += (stageProgress * weight) / 100;
    });

    // Add current update
    if (currentUpdate && stageWeights[currentUpdate.stage]) {
      const currentWeight = stageWeights[currentUpdate.stage];
      const previousProgress = stages[currentUpdate.stage]?.progress || 0;
      totalProgress -= (previousProgress * currentWeight) / 100;
      totalProgress += (currentUpdate.progress * currentWeight) / 100;
    }

    return Math.round(totalProgress);
  }

  /**
   * Calculate processing time
   */
  calculateProcessingTime(startTime) {
    const start = new Date(startTime);
    const end = new Date();
    const diffMs = end - start;
    const diffMinutes = Math.round(diffMs / 60000);
    const diffSeconds = Math.round((diffMs % 60000) / 1000);

    return `${diffMinutes}m ${diffSeconds}s`;
  }

  /**
   * Get analysis status (unchanged)
   */
  async getAnalysisStatus(req, res) {
    const { videoId } = req.params;

    try {
      // Try to get analysis result from GCS
      const analysisExists = await gcsService.fileExists(`results/${videoId}/analysis.json`);

      if (analysisExists) {
        const analysisResult = await gcsService.downloadAnalysisResult(videoId);

        res.json({
          success: true,
          videoId: videoId,
          status: 'completed',
          result: analysisResult
        });
      } else {
        res.json({
          success: true,
          videoId: videoId,
          status: 'not_found',
          message: 'Analysis not found or still processing'
        });
      }

    } catch (error) {
      console.error(`❌ Error getting analysis status for ${videoId}:`, error);

      res.status(500).json({
        success: false,
        videoId: videoId,
        error: error.message
      });
    }
  }
}

module.exports = new AnalysisController();
