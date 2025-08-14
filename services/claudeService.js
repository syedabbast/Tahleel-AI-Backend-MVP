const Anthropic = require('@anthropic-ai/sdk');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });
  }

  /**
   * Enhance GPT-4 analysis with Claude tactical intelligence
   */
  async enhanceTacticalAnalysis(gpt4Analysis, matchMetadata) {
    try {
      console.log('🧠 Enhancing analysis with Claude tactical intelligence...');
      
      const response = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `You are TAHLEEL.ai's tactical intelligence system for Arab League teams paying $15K-$45K monthly subscriptions.

MATCH DATA:
${JSON.stringify(matchMetadata, null, 2)}

GPT-4 VISION ANALYSIS:
${JSON.stringify(gpt4Analysis, null, 2)}

ENHANCE THIS ANALYSIS:

1. TACTICAL INTELLIGENCE ENHANCEMENT:
   - Synthesize frame analyses into coherent tactical narrative
   - Identify patterns GPT-4 might have missed
   - Provide deeper strategic context

2. ARAB LEAGUE SPECIFIC INSIGHTS:
   - Consider regional playing styles and preferences
   - Account for climate and pitch conditions
   - Reference common tactical approaches in the region

3. ACTIONABLE COACHING RECOMMENDATIONS:
   - Specific formation adjustments to exploit weaknesses
   - Player instruction modifications
   - Set piece opportunities
   - Substitution timing recommendations

4. COMPETITIVE ADVANTAGE ANALYSIS:
   - How to exploit identified weaknesses
   - Counter-strategies for opponent strengths
   - Match-winning tactical adjustments

5. EXECUTIVE SUMMARY:
   - 3 key weaknesses to exploit immediately
   - 2 formation changes to implement
   - 5 specific coaching instructions

RESPONSE FORMAT (JSON):
{
  "executive_summary": {
    "key_weaknesses": ["weakness1", "weakness2", "weakness3"],
    "formation_recommendations": ["formation1", "formation2"],
    "coaching_instructions": ["instruction1", "instruction2", "instruction3", "instruction4", "instruction5"]
  },
  "tactical_intelligence": {
    "overall_assessment": "comprehensive analysis",
    "pattern_analysis": "patterns identified",
    "strategic_context": "deeper insights"
  },
  "arab_league_insights": {
    "regional_considerations": "local factors",
    "climate_adaptations": "environmental factors",
    "cultural_tactics": "regional preferences"
  },
  "actionable_recommendations": {
    "immediate_actions": ["action1", "action2"],
    "formation_adjustments": ["adjustment1", "adjustment2"],
    "player_instructions": ["instruction1", "instruction2"],
    "set_piece_opportunities": ["opportunity1", "opportunity2"]
  },
  "competitive_advantage": {
    "exploitation_strategies": ["strategy1", "strategy2"],
    "counter_tactics": ["tactic1", "tactic2"],
    "match_winning_moves": ["move1", "move2"]
  },
  "confidence_score": 92,
  "processing_notes": "Claude enhancement details"
}

Provide analysis that justifies the premium subscription cost and gives teams actual competitive advantage.`
          }
        ]
      });

      const enhancement = this.parseClaudeResponse(response.content[0].text);
      
      console.log('✅ Claude tactical enhancement completed');
      
      return {
        enhanced_analysis: enhancement,
        enhancement_timestamp: new Date().toISOString(),
        model_used: "claude-3-5-sonnet-20241022"
      };
      
    } catch (error) {
      console.error('❌ Claude enhancement failed:', error);
      throw new Error(`Claude tactical enhancement failed: ${error.message}`);
    }
  }

  /**
   * Generate final tactical report
   */
  async generateFinalReport(enhancedAnalysis, matchMetadata, processingStats) {
    try {
      console.log('📊 Generating final tactical report...');
      
      const response = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: `Generate the final TAHLEEL.ai tactical report for Arab League coaches:

MATCH METADATA:
${JSON.stringify(matchMetadata, null, 2)}

ENHANCED ANALYSIS:
${JSON.stringify(enhancedAnalysis, null, 2)}

PROCESSING STATISTICS:
${JSON.stringify(processingStats, null, 2)}

CREATE COMPREHENSIVE REPORT:

1. EXECUTIVE SUMMARY (for team owners/directors)
2. TACTICAL ANALYSIS (for coaches)
3. PLAYER PERFORMANCE INSIGHTS (for training staff)
4. STRATEGIC RECOMMENDATIONS (for match preparation)
5. IMPLEMENTATION GUIDE (step-by-step actions)

REPORT STRUCTURE (JSON):
{
  "report_header": {
    "title": "TAHLEEL.ai Tactical Analysis Report",
    "match_info": "match details",
    "analysis_date": "timestamp",
    "processing_time": "total time",
    "confidence_level": "overall confidence"
  },
  "executive_summary": {
    "key_findings": ["finding1", "finding2", "finding3"],
    "immediate_actions": ["action1", "action2", "action3"],
    "expected_impact": "competitive advantage description"
  },
  "tactical_analysis": {
    "opponent_formations": ["formation analysis"],
    "key_weaknesses": ["detailed weakness analysis"],
    "tactical_patterns": ["pattern descriptions"],
    "phase_analysis": {
      "build_up_play": "analysis",
      "attacking_transitions": "analysis", 
      "defensive_structure": "analysis",
      "set_pieces": "analysis"
    }
  },
  "strategic_recommendations": {
    "formation_changes": ["specific changes"],
    "player_instructions": ["detailed instructions"],
    "set_piece_strategies": ["specific strategies"],
    "substitution_timing": ["timing recommendations"]
  },
  "implementation_guide": {
    "pre_match_preparation": ["step1", "step2"],
    "in_match_adjustments": ["adjustment1", "adjustment2"],
    "post_match_review": ["review1", "review2"]
  },
  "competitive_intelligence": {
    "opponent_predictability": "assessment",
    "exploitation_opportunities": ["opportunity1", "opportunity2"],
    "counter_strategy_priorities": ["priority1", "priority2"]
  },
  "report_metrics": {
    "analysis_depth": "comprehensive/detailed/standard",
    "actionability_score": 95,
    "confidence_score": 92,
    "expected_roi": "tactical advantage value"
  }
}

This report must justify the $15K-$45K monthly subscription cost with actionable intelligence.`
          }
        ]
      });

      const finalReport = this.parseClaudeResponse(response.content[0].text);
      
      console.log('✅ Final tactical report generated');
      
      return {
        final_report: finalReport,
        generation_timestamp: new Date().toISOString(),
        total_processing_time: processingStats.total_time,
        analysis_quality: "enterprise_grade"
      };
      
    } catch (error) {
      console.error('❌ Final report generation failed:', error);
      throw new Error(`Final report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate quick tactical insights for urgent analysis
   */
  async generateQuickInsights(frameAnalyses, urgencyLevel = "high") {
    try {
      console.log(`⚡ Generating quick tactical insights (${urgencyLevel} priority)...`);
      
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307", // Faster model for quick insights
        max_tokens: 1500,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: `URGENT TACTICAL ANALYSIS for TAHLEEL.ai (${urgencyLevel} priority):

FRAME ANALYSES:
${JSON.stringify(frameAnalyses.slice(0, 5), null, 2)} // First 5 frames for speed

PROVIDE IMMEDIATE INSIGHTS:
1. TOP 3 WEAKNESSES to exploit NOW
2. FORMATION RECOMMENDATION for next match
3. KEY PLAYER INSTRUCTIONS (2-3 specific points)
4. IMMEDIATE TACTICAL ADJUSTMENT

FORMAT (JSON):
{
  "urgent_insights": {
    "top_weaknesses": ["weakness1", "weakness2", "weakness3"],
    "formation_recommendation": "recommended formation",
    "key_instructions": ["instruction1", "instruction2", "instruction3"],
    "immediate_adjustment": "critical adjustment needed"
  },
  "confidence": 85,
  "analysis_speed": "rapid"
}

Prioritize actionable intelligence over detailed analysis.`
          }
        ]
      });

      const quickInsights = this.parseClaudeResponse(response.content[0].text);
      
      console.log('⚡ Quick insights generated successfully');
      
      return {
        quick_insights: quickInsights,
        generation_time: new Date().toISOString(),
        urgency_level: urgencyLevel,
        model_used: "claude-3-haiku-20240307"
      };
      
    } catch (error) {
      console.error('❌ Quick insights generation failed:', error);
      throw new Error(`Quick insights generation failed: ${error.message}`);
    }
  }

  /**
   * Parse Claude response and extract JSON
   */
  parseClaudeResponse(responseText) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return structured fallback
      return {
        error: "Could not parse Claude response",
        raw_response: responseText,
        confidence_score: 0
      };
      
    } catch (error) {
      console.error('❌ Failed to parse Claude response:', error);
      return {
        error: "JSON parsing failed",
        raw_response: responseText,
        confidence_score: 0
      };
    }
  }

  /**
   * Validate analysis quality
   */
  validateAnalysisQuality(analysis) {
    const qualityChecks = {
      has_tactical_insights: !!analysis.tactical_intelligence,
      has_recommendations: !!analysis.actionable_recommendations,
      has_competitive_advantage: !!analysis.competitive_advantage,
      confidence_threshold: analysis.confidence_score >= 70,
      completeness_score: 0
    };
    
    // Calculate completeness
    const requiredFields = ['executive_summary', 'tactical_intelligence', 'actionable_recommendations'];
    const presentFields = requiredFields.filter(field => !!analysis[field]);
    qualityChecks.completeness_score = (presentFields.length / requiredFields.length) * 100;
    
    qualityChecks.overall_quality = qualityChecks.completeness_score >= 80 && qualityChecks.confidence_threshold;
    
    return qualityChecks;
  }
}

module.exports = new ClaudeService();
