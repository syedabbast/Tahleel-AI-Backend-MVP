const OpenAI = require('openai');

class GPT4Service {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze single frame for tactical information
   */
  async analyzeFrame(frameUrl, frameNumber, timestamp) {
    try {
      console.log(`🤖 Analyzing frame ${frameNumber} with GPT-4 Vision...`);
      
      const response = await this.client.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this football match frame for TAHLEEL.ai tactical intelligence:

FRAME INFO:
- Frame ${frameNumber} at ${timestamp} seconds
- Focus on tactical analysis for Arab League coaches

ANALYSIS REQUIRED:
1. FORMATION: Identify the formation (4-3-3, 4-4-2, 3-5-2, etc.)
2. PLAYER POSITIONS: Describe positioning and movement patterns
3. TACTICAL WEAKNESSES: Identify defensive gaps, poor positioning, vulnerabilities
4. ATTACKING PATTERNS: Describe attacking setup and opportunities
5. DEFENSIVE STRUCTURE: Analyze defensive line, compactness, coverage
6. KEY INSIGHTS: Specific tactical observations for coaches

RESPONSE FORMAT:
{
  "formation": "detected formation",
  "team_with_ball": "attacking team analysis",
  "defensive_team": "defending team analysis", 
  "tactical_weaknesses": ["weakness 1", "weakness 2"],
  "attacking_opportunities": ["opportunity 1", "opportunity 2"],
  "key_insights": ["insight 1", "insight 2"],
  "confidence_score": 85
}

Provide detailed tactical intelligence that Arab League coaches can use to gain competitive advantage.`
              },
              {
                type: "image_url",
                image_url: {
                  url: frameUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysis = this.parseGPTResponse(response.choices[0].message.content);
      
      console.log(`✅ Frame ${frameNumber} analysis completed`);
      
      return {
        frameNumber: frameNumber,
        timestamp: timestamp,
        analysis: analysis,
        processingTime: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ GPT-4 Vision analysis failed for frame ${frameNumber}:`, error);
      
      // Return fallback analysis
      return {
        frameNumber: frameNumber,
        timestamp: timestamp,
        analysis: {
          formation: "Unable to detect",
          team_with_ball: "Analysis unavailable",
          defensive_team: "Analysis unavailable",
          tactical_weaknesses: ["GPT-4 Vision analysis failed"],
          attacking_opportunities: ["Manual analysis required"],
          key_insights: ["Technical error occurred"],
          confidence_score: 0,
          error: error.message
        },
        processingTime: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze multiple frames in batch
   */
  async analyzeFrames(frames, progressCallback) {
    try {
      console.log(`🎬 Starting GPT-4 Vision analysis for ${frames.length} frames...`);
      
      const frameAnalyses = [];
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        try {
          const analysis = await this.analyzeFrame(
            frame.url, 
            frame.frameNumber, 
            frame.timestamp
          );
          
          frameAnalyses.push(analysis);
          
          // Progress callback
          if (progressCallback) {
            progressCallback({
              stage: 'gpt4_analysis',
              progress: Math.round(((i + 1) / frames.length) * 100),
              message: `Analyzed frame ${i + 1}/${frames.length}`
            });
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (frameError) {
          console.error(`❌ Failed to analyze frame ${frame.frameNumber}:`, frameError);
          
          // Continue with other frames
          frameAnalyses.push({
            frameNumber: frame.frameNumber,
            timestamp: frame.timestamp,
            analysis: {
              error: frameError.message,
              confidence_score: 0
            }
          });
        }
      }
      
      console.log(`✅ GPT-4 Vision analysis completed for ${frameAnalyses.length} frames`);
      return frameAnalyses;
      
    } catch (error) {
      console.error('❌ Batch frame analysis failed:', error);
      throw new Error(`GPT-4 Vision batch analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate match summary from frame analyses
   */
  async generateMatchSummary(frameAnalyses, matchMetadata) {
    try {
      console.log('📊 Generating match summary with GPT-4...');
      
      // Prepare frame insights for summary
      const frameInsights = frameAnalyses
        .filter(frame => frame.analysis && !frame.analysis.error)
        .map(frame => ({
          timestamp: frame.timestamp,
          formation: frame.analysis.formation,
          weaknesses: frame.analysis.tactical_weaknesses,
          opportunities: frame.analysis.attacking_opportunities,
          insights: frame.analysis.key_insights
        }));
      
      const response = await this.client.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "user",
            content: `Generate a comprehensive tactical summary for TAHLEEL.ai from this match analysis:

MATCH METADATA:
${JSON.stringify(matchMetadata, null, 2)}

FRAME ANALYSES:
${JSON.stringify(frameInsights, null, 2)}

GENERATE TACTICAL SUMMARY:
1. OVERALL FORMATIONS: Most common formations used by both teams
2. TACTICAL PATTERNS: Key tactical patterns observed throughout match
3. CRITICAL WEAKNESSES: Top 5 exploitable weaknesses identified
4. STRATEGIC OPPORTUNITIES: Best opportunities for counter-tactics
5. COACHING RECOMMENDATIONS: Specific advice for Arab League coaches
6. MATCH PHASES: How tactics evolved during different match periods

FORMAT AS JSON:
{
  "match_overview": "brief summary",
  "formations_detected": ["formation1", "formation2"],
  "tactical_patterns": ["pattern1", "pattern2"],
  "critical_weaknesses": ["weakness1", "weakness2"],
  "strategic_opportunities": ["opportunity1", "opportunity2"],
  "coaching_recommendations": ["rec1", "rec2"],
  "match_phases": {
    "first_half": "tactical analysis",
    "second_half": "tactical analysis"
  },
  "confidence_score": 85
}

Provide insights that give Arab League teams competitive advantage worth $15K-$45K monthly subscription.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.4
      });

      const summary = this.parseGPTResponse(response.choices[0].message.content);
      
      console.log('✅ Match summary generated successfully');
      return summary;
      
    } catch (error) {
      console.error('❌ Match summary generation failed:', error);
      throw new Error(`Match summary generation failed: ${error.message}`);
    }
  }

  /**
   * Parse GPT response and extract JSON
   */
  parseGPTResponse(responseText) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return structured fallback
      return {
        error: "Could not parse GPT response",
        raw_response: responseText,
        confidence_score: 0
      };
      
    } catch (error) {
      console.error('❌ Failed to parse GPT response:', error);
      return {
        error: "JSON parsing failed",
        raw_response: responseText,
        confidence_score: 0
      };
    }
  }

  /**
   * Analyze specific tactical situation
   */
  async analyzeTacticalSituation(frameUrl, situationType, context) {
    try {
      console.log(`🎯 Analyzing ${situationType} situation...`);
      
      const response = await this.client.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ${situationType} situation for TAHLEEL.ai:

CONTEXT: ${context}

FOCUS ON:
1. Player positioning effectiveness
2. Tactical execution quality
3. Potential improvements
4. Coaching points

Provide specific tactical advice for Arab League coaches.`
              },
              {
                type: "image_url",
                image_url: {
                  url: frameUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      return {
        situationType: situationType,
        analysis: response.choices[0].message.content,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Tactical situation analysis failed:`, error);
      throw new Error(`Tactical situation analysis failed: ${error.message}`);
    }
  }
}

module.exports = new GPT4Service();
