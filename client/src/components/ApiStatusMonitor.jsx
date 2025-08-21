import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Wifi, WifiOff, Activity } from 'lucide-react';
import API from '../services/api';

const ApiStatusMonitor = () => {
  const [apiStatuses, setApiStatuses] = useState({});
  const [recentErrors, setRecentErrors] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Load initial data
  useEffect(() => {
    loadApiStatuses();
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    const handleApiError = (data) => {
      console.log('🚨 Received API error:', data);
      
      // Update recent errors
      setRecentErrors(prev => {
        const newErrors = [data, ...prev.slice(0, 19)]; // Keep last 20 errors
        return newErrors;
      });
      
      // Update API status if needed
      setApiStatuses(prev => ({
        ...prev,
        [data.apiName]: {
          status: 'error',
          lastError: data,
          lastCheck: new Date(),
          userMessage: data.userMessage
        }
      }));
      
      setLastUpdate(new Date());
    };

    const handleApiStatus = (data) => {
      console.log('📊 Received API status:', data);
      
      setApiStatuses(prev => ({
        ...prev,
        [data.apiName]: {
          ...data,
          lastCheck: new Date(data.lastCheck),
          userMessage: data.userMessage
        }
      }));
      
      setLastUpdate(new Date());
    };

    const handleWebSocketMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'api_error') {
          handleApiError(message.data);
        } else if (message.type === 'api_status') {
          handleApiStatus(message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Check if WebSocket is available
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      setWsConnected(true);
      window.ws.addEventListener('message', handleWebSocketMessage);
      console.log('🔗 API Status Monitor connected to WebSocket');
      
      return () => {
        if (window.ws) {
          window.ws.removeEventListener('message', handleWebSocketMessage);
        }
      };
    } else {
      console.warn('⚠️ WebSocket not available, falling back to polling');
      setWsConnected(false);
      // Try to reconnect or poll for updates
      const interval = setInterval(loadApiStatuses, 15000); // Check more frequently
      return () => clearInterval(interval);
    }
  }, []);

  const loadApiStatuses = async () => {
    try {
      const response = await API.get('/api/status/apis');
      if (response.data.success) {
        setApiStatuses(response.data.data.statuses || {});
        setRecentErrors(response.data.data.recentErrors || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load API statuses:', error);
    }
  };

  const performHealthCheck = async () => {
    try {
      const response = await API.post('/api/status/health-check');
      if (response.data.success) {
        // Statuses will be updated via WebSocket
        console.log('Health check triggered:', response.data.data);
      }
    } catch (error) {
      console.error('Failed to perform health check:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'online-auth-error':
        return <CheckCircle className="w-4 h-4 text-yellow-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
      case 'offline':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'border-green-500 bg-green-50';
      case 'online-auth-error':
      case 'degraded':
        return 'border-yellow-500 bg-yellow-50';
      case 'error':
      case 'offline':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString();
  };

  const hasErrors = Object.values(apiStatuses).some(status => status.status === 'error' || status.status === 'offline');
  const errorCount = recentErrors.length;

  return (
    <div className="relative">
      {/* Floating Status Indicator */}
      <div
        className={`fixed top-4 right-4 z-50 cursor-pointer transition-all duration-200 ${
          isVisible ? 'w-96' : 'w-12'
        }`}
        onClick={() => setIsVisible(!isVisible)}
      >
        {!isVisible ? (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
              hasErrors ? 'bg-red-500' : 'bg-green-500'
            }`}
            title={hasErrors ? `${errorCount} API errors` : 'All APIs online'}
          >
            {wsConnected ? (
              <Wifi className="w-6 h-6 text-white" />
            ) : (
              <WifiOff className="w-6 h-6 text-white" />
            )}
            {errorCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {errorCount > 99 ? '99+' : errorCount}
              </span>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                API Status
              </h3>
              <div className="flex items-center space-x-2">
                {wsConnected ? (
                  <Wifi className="w-4 h-4 text-green-500" title="Real-time monitoring active" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-400" title="Real-time monitoring offline" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    performHealthCheck();
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  title="Run health check"
                >
                  Check All
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            {lastUpdate && (
              <p className="text-xs text-gray-500 mb-3">
                Last update: {formatTime(lastUpdate)}
              </p>
            )}

            {/* API Status List */}
            <div className="space-y-2 mb-4">
              {Object.entries(apiStatuses).map(([apiName, status]) => (
                <div
                  key={apiName}
                  className={`p-2 rounded border-l-4 ${getStatusColor(status.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getStatusIcon(status.status)}
                      <span className="ml-2 font-medium">{apiName}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime(status.lastCheck)}
                    </span>
                  </div>
                  
                  {status.userMessage && (
                    <p className="text-sm text-gray-600 mt-1">{status.userMessage}</p>
                  )}
                  
                  {status.responseTime && (
                    <p className="text-xs text-gray-500 mt-1">
                      Response time: {status.responseTime}ms
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Recent Errors */}
            {recentErrors.length > 0 && (
              <>
                <h4 className="font-medium text-sm mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-red-500" />
                  Recent Errors ({recentErrors.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recentErrors.slice(0, 5).map((error) => (
                    <div
                      key={error.id}
                      className="p-2 bg-red-50 border border-red-200 rounded text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="font-medium">{error.apiName}</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${getSeverityColor(error.severity)}`}>
                            {error.severity}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(error.timestamp)}
                        </span>
                      </div>
                      <p className="text-red-700 mt-1">{error.userMessage}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {Object.keys(apiStatuses).length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p>Loading API status...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiStatusMonitor;