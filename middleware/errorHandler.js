/**
 * TAHLEEL.ai Error Handler Middleware
 * Enterprise-grade error handling for $15K-$45K subscriptions
 */

const errorHandler = (error, req, res, next) => {
  console.error('🚨 TAHLEEL.ai Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || generateRequestId()
  };

  // Handle specific error types
  
  // Validation Errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse = {
      ...errorResponse,
      error: 'Validation Error',
      message: error.message,
      details: error.errors || {}
    };
  }
  
  // Multer File Upload Errors
  else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorResponse = {
      ...errorResponse,
      error: 'File Too Large',
      message: 'Video file exceeds 500MB limit',
      maxFileSize: '500MB',
      suggestion: 'Please compress your video or upload a shorter clip'
    };
  }
  
  else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorResponse = {
      ...errorResponse,
      error: 'Invalid File Upload',
      message: 'Only video files are allowed',
      supportedFormats: ['MP4', 'AVI', 'MOV', 'MKV']
    };
  }
  
  // Google Cloud Storage Errors
  else if (error.code === 404 && error.message.includes('storage')) {
    statusCode = 404;
    errorResponse = {
      ...errorResponse,
      error: 'Video Not Found',
      message: 'The requested video was not found in storage',
      suggestion: 'Please verify the video ID and try again'
    };
  }
  
  else if (error.code === 403 && error.message.includes('storage')) {
    statusCode = 403;
    errorResponse = {
      ...errorResponse,
      error: 'Storage Access Denied',
      message: 'Insufficient permissions to access video storage',
      suggestion: 'Please contact technical support'
    };
  }
  
  // OpenAI API Errors
  else if (error.message.includes('OpenAI') || error.message.includes('GPT')) {
    if (error.status === 429) {
      statusCode = 429;
      errorResponse = {
        ...errorResponse,
        error: 'AI Service Rate Limited',
        message: 'GPT-4 Vision analysis temporarily unavailable',
        retryAfter: '60 seconds',
        suggestion: 'Please wait a moment and try again'
      };
    } else if (error.status === 401) {
      statusCode = 503;
      errorResponse = {
        ...errorResponse,
        error: 'AI Service Authentication Failed',
        message: 'GPT-4 Vision service temporarily unavailable',
        suggestion: 'Please contact technical support'
      };
    } else {
      statusCode = 503;
      errorResponse = {
        ...errorResponse,
        error: 'AI Analysis Service Unavailable',
        message: 'GPT-4 Vision analysis temporarily unavailable',
        suggestion: 'Please try again in a few minutes'
      };
    }
  }
  
  // Claude AI Errors
  else if (error.message.includes('Claude') || error.message.includes('Anthropic')) {
    if (error.status === 429) {
      statusCode = 429;
      errorResponse = {
        ...errorResponse,
        error: 'Tactical Intelligence Rate Limited',
        message: 'Claude tactical analysis temporarily unavailable',
        retryAfter: '60 seconds',
        suggestion: 'Please wait a moment and try again'
      };
    } else if (error.status === 401) {
      statusCode = 503;
      errorResponse = {
        ...errorResponse,
        error: 'Tactical Intelligence Service Authentication Failed',
        message: 'Claude service temporarily unavailable',
        suggestion: 'Please contact technical support'
      };
    } else {
      statusCode = 503;
      errorResponse = {
        ...errorResponse,
        error: 'Tactical Intelligence Service Unavailable',
        message: 'Claude tactical enhancement temporarily unavailable',
        suggestion: 'Analysis will continue with GPT-4 Vision only'
      };
    }
  }
  
  // FFmpeg Processing Errors
  else if (error.message.includes('ffmpeg') || error.message.includes('frame')) {
    statusCode = 422;
    errorResponse = {
      ...errorResponse,
      error: 'Video Processing Failed',
      message: 'Unable to extract frames from video',
      possibleCauses: [
        'Corrupted video file',
        'Unsupported video format',
        'Video too short or too long'
      ],
      suggestion: 'Please try uploading a different video file'
    };
  }
  
  // Network/Timeout Errors
  else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorResponse = {
      ...errorResponse,
      error: 'Service Unavailable',
      message: 'External service temporarily unavailable',
      suggestion: 'Please try again in a few minutes'
    };
  }
  
  else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    statusCode = 408;
    errorResponse = {
      ...errorResponse,
      error: 'Processing Timeout',
      message: 'Analysis took longer than expected',
      suggestion: 'Please try again with a shorter video or contact support'
    };
  }
  
  // JSON Parse Errors
  else if (error instanceof SyntaxError && error.message.includes('JSON')) {
    statusCode = 400;
    errorResponse = {
      ...errorResponse,
      error: 'Invalid Request Data',
      message: 'Request contains invalid JSON',
      suggestion: 'Please check your request format and try again'
    };
  }
  
  // Cast/Type Errors
  else if (error.name === 'CastError') {
    statusCode = 400;
    errorResponse = {
      ...errorResponse,
      error: 'Invalid ID Format',
      message: 'The provided ID format is invalid',
      suggestion: 'Please use a valid UUID format'
    };
  }
  
  // MongoDB/Database Errors (if added later)
  else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    statusCode = 503;
    errorResponse = {
      ...errorResponse,
      error: 'Database Service Unavailable',
      message: 'Database temporarily unavailable',
      suggestion: 'Please try again in a few minutes'
    };
  }
  
  // Rate Limiting Errors
  else if (error.message.includes('rate limit') || error.status === 429) {
    statusCode = 429;
    errorResponse = {
      ...errorResponse,
      error: 'Rate Limit Exceeded',
      message: 'Too many requests - please wait before trying again',
      retryAfter: '60 seconds',
      suggestion: 'Please wait a moment and try again'
    };
  }
  
  // Authorization Errors
  else if (error.status === 401 || error.message.includes('Unauthorized')) {
    statusCode = 401;
    errorResponse = {
      ...errorResponse,
      error: 'Unauthorized',
      message: 'Authentication required',
      suggestion: 'Please check your API credentials'
    };
  }
  
  else if (error.status === 403 || error.message.includes('Forbidden')) {
    statusCode = 403;
    errorResponse = {
      ...errorResponse,
      error: 'Access Forbidden',
      message: 'Insufficient permissions for this operation',
      suggestion: 'Please check your subscription level'
    };
  }
  
  // Custom Business Logic Errors
  else if (error.message.includes('TAHLEEL_')) {
    // Custom app errors with TAHLEEL_ prefix
    statusCode = 400;
    errorResponse = {
      ...errorResponse,
      error: 'Business Logic Error',
      message: error.message.replace('TAHLEEL_', ''),
      suggestion: 'Please review your request and try again'
    };
  }
  
  // Development vs Production Error Details
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      stack: error.stack,
      originalError: error.message,
      errorCode: error.code,
      errorStatus: error.status
    };
  }
  
  // Add subscription-specific messaging for high-value customers
  if (statusCode >= 500) {
    errorResponse.supportInfo = {
      priority: 'high',
      contact: 'support@tahleel.ai',
      sla: '24/7 support for Arab League subscriptions',
      escalation: 'Automatic escalation for enterprise customers'
    };
  }
  
  // Emit error event for monitoring/alerting
  if (req.app && req.app.get('io')) {
    req.app.get('io').emit('system-error', {
      error: error.message,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      severity: statusCode >= 500 ? 'critical' : 'warning'
    });
  }
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Generate unique request ID for tracking
 */
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route Not Found',
    message: `${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'POST /api/upload/signed-url',
      'POST /api/analysis/start',
      'GET /api/results/:videoId',
      'GET /health'
    ],
    timestamp: new Date().toISOString(),
    suggestion: 'Please check the API documentation for available endpoints'
  });
};

/**
 * Global uncaught exception handler
 */
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  
  // For production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    console.log('🛑 Shutting down due to uncaught exception...');
    process.exit(1);
  }
});

/**
 * Global unhandled promise rejection handler
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION at:', promise);
  console.error('Reason:', reason);
  
  // For production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    console.log('🛑 Shutting down due to unhandled promise rejection...');
    process.exit(1);
  }
});

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};
