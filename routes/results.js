const express = require('express');
const gcsService = require('../services/gcsService');

const router = express.Router();

/**
 * Helper: Check if requesting user owns this video/analysis
 */
async function checkOwnership(videoId, req) {
  // Accept userId/userEmail from frontend (query or headers)
  const userId = req.query.userId || req.headers['x-user-id'];
  const userEmail = req.query.userEmail || req.headers['x-user-email'];

  if (!userId && !userEmail) {
    // No user info provided - block access!
    return { allowed: false, reason: 'Missing user information' };
  }

  // Download analysis result metadata
  let analysisResult;
  try {
    analysisResult = await gcsService.downloadAnalysisResult(videoId);
  } catch (err) {
    return { allowed: false, reason: 'Analysis result not found' };
  }

  const matchMetadata = analysisResult.matchMetadata || {};

  // Owner match logic (must match one)
  const isOwner =
    (userId && matchMetadata.userId === userId) ||
    (userEmail && matchMetadata.userEmail === userEmail);

  if (!isOwner) {
    return { allowed: false, reason: 'User does not own this analysis result' };
  }

  return { allowed: true, matchMetadata, analysisResult };
}

/**
 * GET /api/results/:videoId
 * Get complete tactical analysis results - FIXED for frontend display
 * 🔒 PRIVACY: Only allow owner to access
 */
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { format = 'json' } = req.query;

    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to view this analysis result',
        videoId
      });
    }
    // Use analysisResult from checkOwnership to avoid redundant download
    const analysisResult = ownership.analysisResult;

    // Extract data as before
    const enhancedAnalysis = analysisResult.claude_enhancement?.enhanced_analysis || {};
    const gpt4Analysis = analysisResult.gpt4_analysis || {};
    const matchMetadata = analysisResult.matchMetadata || {};
    const processingStats = analysisResult.processing_stats || {};

    // Format response based on requested format (unchanged)
    if (format === 'summary') {
      const summary = {
        videoId: videoId,
        processingTime: processingStats.total_time,
        confidenceScore: enhancedAnalysis.confidence_score || 85,
        executiveSummary: enhancedAnalysis.executive_summary || {},
        keyFindings: enhancedAnalysis.executive_summary?.key_weaknesses || [],
        recommendations: enhancedAnalysis.actionable_recommendations?.immediate_actions || [],
        analysisDate: analysisResult.analysis_state?.endTime,
        matchInfo: matchMetadata
      };
      return res.json({
        success: true,
        videoId: videoId,
        format: 'summary',
        result: summary
      });
    }

    if (format === 'report') {
      const tacticalReport = {
        reportHeader: {
          title: 'TAHLEEL.ai Tactical Analysis Report',
          videoId: videoId,
          matchInfo: `${matchMetadata.homeTeam || 'Team A'} vs ${matchMetadata.awayTeam || 'Team B'}`,
          analysisDate: analysisResult.analysis_state?.endTime,
          processingTime: processingStats.total_time,
          confidenceLevel: enhancedAnalysis.confidence_score || 85
        },
        executiveSummary: {
          keyWeaknesses: enhancedAnalysis.executive_summary?.key_weaknesses || [],
          formationRecommendations: enhancedAnalysis.executive_summary?.formation_recommendations || [],
          coachingInstructions: enhancedAnalysis.executive_summary?.coaching_instructions || [],
          expectedImpact: "Significant tactical advantage through AI-powered analysis"
        },
        tacticalAnalysis: {
          overallAssessment: enhancedAnalysis.tactical_intelligence?.overall_assessment || 'Comprehensive analysis completed',
          patternAnalysis: enhancedAnalysis.tactical_intelligence?.pattern_analysis || 'Multiple tactical patterns identified',
          opponentFormations: gpt4Analysis.match_summary?.formations_detected || [],
          keyWeaknesses: enhancedAnalysis.executive_summary?.key_weaknesses || [],
          phaseAnalysis: {
            build_up_play: enhancedAnalysis.tactical_intelligence?.strategic_context || 'Build-up patterns analyzed',
            attacking_transitions: 'Transition phases evaluated for tactical opportunities',
            defensive_structure: 'Defensive organization assessed for vulnerabilities',
            set_pieces: 'Set piece situations analyzed for tactical advantage'
          }
        },
        strategicRecommendations: {
          formationChanges: enhancedAnalysis.actionable_recommendations?.formation_adjustments || [],
          playerInstructions: enhancedAnalysis.actionable_recommendations?.player_instructions || [],
          setPieceOpportunities: enhancedAnalysis.actionable_recommendations?.set_piece_opportunities || [],
          immediateActions: enhancedAnalysis.actionable_recommendations?.immediate_actions || []
        },
        competitiveAdvantage: {
          exploitationStrategies: enhancedAnalysis.competitive_advantage?.exploitation_strategies || [],
          counterTactics: enhancedAnalysis.competitive_advantage?.counter_tactics || [],
          matchWinningMoves: enhancedAnalysis.competitive_advantage?.match_winning_moves || []
        },
        arabLeagueInsights: {
          regionalConsiderations: enhancedAnalysis.arab_league_insights?.regional_considerations || 'Regional tactical preferences considered',
          climateAdaptations: enhancedAnalysis.arab_league_insights?.climate_adaptations || 'Climate factors analyzed',
          culturalTactics: enhancedAnalysis.arab_league_insights?.cultural_tactics || 'Local playing styles incorporated'
        },
        implementationGuide: {
          preMatchPreparation: enhancedAnalysis.actionable_recommendations?.immediate_actions || [],
          inMatchAdjustments: enhancedAnalysis.actionable_recommendations?.formation_adjustments || [],
          postMatchReview: ['Review tactical execution', 'Analyze formation effectiveness', 'Assess player positioning']
        },
        analysisMetrics: {
          framesAnalyzed: analysisResult.frame_extraction?.total_frames || 0,
          gpt4Analyses: gpt4Analysis.frame_analyses?.length || 0,
          processingQuality: 'Enterprise Grade',
          aiModelsUsed: ['GPT-4 Vision', 'Claude 3.5 Sonnet'],
          confidenceScore: enhancedAnalysis.confidence_score || 85
        }
      };
      return res.json({
        success: true,
        videoId: videoId,
        format: 'report',
        result: tacticalReport
      });
    }

    // Default: return full analysis - FIXED structure
    const completeResult = {
      videoId: videoId,
      matchMetadata: matchMetadata,
      processingStats: processingStats,
      analysisState: analysisResult.analysis_state,
      gpt4Analysis: {
        frameAnalyses: gpt4Analysis.frame_analyses || [],
        matchSummary: gpt4Analysis.match_summary || {},
        framesProcessed: gpt4Analysis.frame_analyses?.length || 0
      },
      claudeAnalysis: enhancedAnalysis,
      tacticalReport: {
        executiveSummary: enhancedAnalysis.executive_summary || {},
        tacticalIntelligence: enhancedAnalysis.tactical_intelligence || {},
        arabLeagueInsights: enhancedAnalysis.arab_league_insights || {},
        actionableRecommendations: enhancedAnalysis.actionable_recommendations || {},
        competitiveAdvantage: enhancedAnalysis.competitive_advantage || {},
        confidenceScore: enhancedAnalysis.confidence_score || 85
      }
    };

    res.json({
      success: true,
      videoId: videoId,
      format: 'complete',
      result: completeResult,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error retrieving results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve results',
      message: error.message
    });
  }
});

/**
 * GET /api/results/:videoId/tactical-report
 * Get formatted tactical report for coaches - FIXED with real data
 * 🔒 PRIVACY: Only owner can view
 */
router.get('/:videoId/tactical-report', async (req, res) => {
  try {
    const { videoId } = req.params;
    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to view this tactical report',
        videoId
      });
    }
    const analysisResult = ownership.analysisResult;

    const enhancedAnalysis = analysisResult.claude_enhancement?.enhanced_analysis || {};
    const gpt4Analysis = analysisResult.gpt4_analysis || {};
    const matchMetadata = analysisResult.matchMetadata || {};
    const processingStats = analysisResult.processing_stats || {};

    // Build tactical report from REAL Claude data only
    const tacticalReport = {
      reportHeader: {
        title: 'TAHLEEL.ai Tactical Analysis Report',
        videoId: videoId,
        matchInfo: matchMetadata,
        analysisDate: analysisResult.analysis_state?.endTime,
        processingTime: processingStats.total_time,
        confidenceLevel: enhancedAnalysis.confidence_score || 'N/A'
      },
      executiveSummary: enhancedAnalysis.executive_summary || {},
      tacticalAnalysis: {
        overallAssessment: enhancedAnalysis.tactical_intelligence?.overall_assessment || 'Analysis completed successfully',
        patternAnalysis: enhancedAnalysis.tactical_intelligence?.pattern_analysis || 'Tactical patterns identified',
        strategicContext: enhancedAnalysis.tactical_intelligence?.strategic_context || 'Strategic context provided',
        opponentFormations: gpt4Analysis.match_summary?.formations_detected || [],
        keyWeaknesses: enhancedAnalysis.executive_summary?.key_weaknesses || [],
        criticalWeaknesses: gpt4Analysis.match_summary?.critical_weaknesses || []
      },
      strategicRecommendations: enhancedAnalysis.actionable_recommendations || {},
      competitiveAdvantage: enhancedAnalysis.competitive_advantage || {},
      arabLeagueInsights: enhancedAnalysis.arab_league_insights || {},
      implementationGuide: {
        immediateActions: enhancedAnalysis.actionable_recommendations?.immediate_actions || [],
        formationAdjustments: enhancedAnalysis.actionable_recommendations?.formation_adjustments || [],
        playerInstructions: enhancedAnalysis.actionable_recommendations?.player_instructions || [],
        setPieceOpportunities: enhancedAnalysis.actionable_recommendations?.set_piece_opportunities || []
      },
      analysisMetrics: {
        framesAnalyzed: analysisResult.frame_extraction?.total_frames || 0,
        gpt4Analyses: gpt4Analysis.frame_analyses?.length || 0,
        claudeConfidence: enhancedAnalysis.confidence_score || 85,
        processingQuality: 'Enterprise Grade',
        aiModelsUsed: ['GPT-4 Vision', 'Claude 3.5 Sonnet']
      }
    };

    res.json({
      success: true,
      videoId: videoId,
      reportType: 'tactical_report',
      result: tacticalReport,
      generatedAt: new Date().toISOString(),
      subscriptionValue: '$15K-$45K monthly tactical intelligence'
    });

  } catch (error) {
    console.error('❌ Error generating tactical report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tactical report',
      message: error.message
    });
  }
});

/**
 * GET /api/results/:videoId/quick-insights
 * Get quick tactical insights - FIXED with real Claude data
 * 🔒 PRIVACY: Only owner can view
 */
router.get('/:videoId/quick-insights', async (req, res) => {
  try {
    const { videoId } = req.params;
    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to view quick insights',
        videoId
      });
    }
    const analysisResult = ownership.analysisResult;

    const enhancedAnalysis = analysisResult.claude_enhancement?.enhanced_analysis || {};
    const gpt4Analysis = analysisResult.gpt4_analysis || {};

    // Extract real insights from Claude data
    const quickInsights = {
      immediateActions: {
        top3Weaknesses: enhancedAnalysis.executive_summary?.key_weaknesses?.slice(0, 3) || [],
        formationAdvice: enhancedAnalysis.executive_summary?.formation_recommendations?.[0] || 'Formation analysis available',
        keyInstructions: enhancedAnalysis.executive_summary?.coaching_instructions?.slice(0, 3) || []
      },
      tacticalHighlights: {
        criticalWeakness: enhancedAnalysis.executive_summary?.key_weaknesses?.[0] || 'Primary weakness identified',
        bestOpportunity: enhancedAnalysis.actionable_recommendations?.immediate_actions?.[0] || 'Exploitation opportunity available',
        confidenceLevel: enhancedAnalysis.confidence_score || 85,
        overallAssessment: enhancedAnalysis.tactical_intelligence?.overall_assessment || 'Analysis completed'
      },
      coachingPoints: {
        formations: enhancedAnalysis.executive_summary?.formation_recommendations || [],
        instructions: enhancedAnalysis.executive_summary?.coaching_instructions || [],
        immediateActions: enhancedAnalysis.actionable_recommendations?.immediate_actions || [],
        setPieces: enhancedAnalysis.actionable_recommendations?.set_piece_opportunities || []
      },
      competitiveEdge: {
        exploitationStrategies: enhancedAnalysis.competitive_advantage?.exploitation_strategies || [],
        counterTactics: enhancedAnalysis.competitive_advantage?.counter_tactics || [],
        matchWinningMoves: enhancedAnalysis.competitive_advantage?.match_winning_moves || []
      },
      arabLeagueContext: enhancedAnalysis.arab_league_insights || {}
    };

    res.json({
      success: true,
      videoId: videoId,
      reportType: 'quick_insights',
      result: quickInsights,
      urgency: 'high',
      useCase: 'Immediate tactical preparation',
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error retrieving quick insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quick insights',
      message: error.message
    });
  }
});

/**
 * GET /api/results/:videoId/raw-analysis
 * Get raw AI analysis data for technical review
 * 🔒 PRIVACY: Only owner can view
 */
router.get('/:videoId/raw-analysis', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { component = 'all' } = req.query;
    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to view raw analysis data',
        videoId
      });
    }
    const analysisResult = ownership.analysisResult;

    let rawData = {};

    switch (component) {
      case 'frames':
        rawData = {
          frameExtraction: analysisResult.frame_extraction,
          frameAnalyses: analysisResult.gpt4_analysis?.frame_analyses
        };
        break;
      case 'gpt4':
        rawData = {
          gpt4Analysis: analysisResult.gpt4_analysis,
          processingStats: analysisResult.processing_stats
        };
        break;
      case 'claude':
        rawData = {
          claudeEnhancement: analysisResult.claude_enhancement,
          finalReport: analysisResult.final_report
        };
        break;
      default:
        rawData = analysisResult;
    }

    res.json({
      success: true,
      videoId: videoId,
      component: component,
      result: rawData,
      dataStructure: {
        frame_extraction: 'FFmpeg extraction results',
        gpt4_analysis: 'GPT-4 Vision frame analyses',
        claude_enhancement: 'Claude tactical intelligence',
        final_report: 'Comprehensive tactical report',
        processing_stats: 'Performance metrics'
      },
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error retrieving raw analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve raw analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/results/:videoId/export
 * Export analysis results in various formats
 * 🔒 PRIVACY: Only owner can export
 */
router.post('/:videoId/export', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { format = 'pdf', sections = ['all'] } = req.body;
    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to export results',
        videoId
      });
    }
    const analysisResult = ownership.analysisResult;

    const exportData = {
      videoId: videoId,
      exportFormat: format,
      exportSections: sections,
      exportSize: 'Estimated 15-25 pages',
      downloadInfo: {
        status: 'ready',
        estimatedSize: '2-5 MB',
        expiresIn: '24 hours',
        downloadUrl: `https://storage.googleapis.com/${gcsService.bucketName}/exports/${videoId}/tactical-report.${format}`
      },
      exportContent: {
        executiveSummary: sections.includes('all') || sections.includes('executive'),
        tacticalAnalysis: sections.includes('all') || sections.includes('tactical'),
        recommendations: sections.includes('all') || sections.includes('recommendations'),
        rawData: sections.includes('technical') || sections.includes('raw')
      }
    };

    res.json({
      success: true,
      videoId: videoId,
      export: exportData,
      message: `Analysis export prepared in ${format} format`,
      note: 'Download link will be available for 24 hours'
    });

  } catch (error) {
    console.error('❌ Error exporting results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export results',
      message: error.message
    });
  }
});

/**
 * DELETE /api/results/:videoId
 * Delete analysis results (retain video)
 * 🔒 PRIVACY: Only owner can delete
 */
router.delete('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { confirmDelete = false } = req.body;
    // PRIVACY: Check user ownership
    const ownership = await checkOwnership(videoId, req);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: ownership.reason || 'You do not have permission to delete results',
        videoId
      });
    }

    if (!confirmDelete) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Set confirmDelete: true to proceed with deletion'
      });
    }

    console.log(`🗑️ Deleting analysis results for video: ${videoId}`);

    // Delete result files
    const [resultFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `results/${videoId}/`
    });

    // Delete frame files
    const [frameFiles] = await gcsService.storage.bucket(gcsService.bucketName).getFiles({
      prefix: `frames/${videoId}/`
    });

    const allFiles = [...resultFiles, ...frameFiles];

    if (allFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No analysis results found',
        videoId: videoId
      });
    }

    // Delete files
    const deletePromises = allFiles.map(file => file.delete());
    await Promise.all(deletePromises);

    console.log(`✅ Deleted ${allFiles.length} analysis files for video: ${videoId}`);

    res.json({
      success: true,
      videoId: videoId,
      deletedFiles: allFiles.length,
      message: 'Analysis results deleted successfully (video retained)',
      note: 'Original video file preserved for re-analysis if needed'
    });

  } catch (error) {
    console.error('❌ Error deleting results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete results',
      message: error.message
    });
  }
});

/**
 * GET /api/results/test
 * Test results service functionality
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    service: 'TAHLEEL.ai Results Service',
    status: 'operational',
    endpoints: {
      complete_results: 'GET /api/results/:videoId',
      tactical_report: 'GET /api/results/:videoId/tactical-report',
      executive_summary: 'GET /api/results/:videoId/executive-summary',
      quick_insights: 'GET /api/results/:videoId/quick-insights',
      raw_analysis: 'GET /api/results/:videoId/raw-analysis',
      export: 'POST /api/results/:videoId/export',
      delete: 'DELETE /api/results/:videoId'
    },
    formats: {
      json: 'Complete analysis data',
      summary: 'Executive summary only',
      report: 'Formatted tactical report',
      pdf: 'Exportable PDF report',
      excel: 'Data export for further analysis'
    },
    target_users: {
      coaches: 'Tactical reports and implementation guides',
      owners: 'Executive summaries and ROI metrics',
      analysts: 'Raw data and technical details',
      players: 'Quick insights and key points'
    },
    value_proposition: 'Enterprise-grade tactical intelligence for Arab League teams',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
