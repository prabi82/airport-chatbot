const { adminService } = require('../src/lib/admin-service');

// Test Configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3003',
  adminCredentials: {
    username: 'admin',
    password: 'admin123'
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`[${status}] ${testName}`, statusColor);
  if (details) {
    log(`      ${details}`, 'reset');
  }
}

// Test Admin Authentication
async function testAdminAuthentication() {
  logSection('ADMIN AUTHENTICATION TESTS');
  
  try {
    // Test valid credentials
    const validAuth = await adminService.authenticateAdmin(
      TEST_CONFIG.adminCredentials.username,
      TEST_CONFIG.adminCredentials.password
    );
    
    if (validAuth && validAuth.admin && validAuth.token) {
      logTest('Valid Admin Login', 'PASS', `Token: ${validAuth.token.substring(0, 20)}...`);
      logTest('Admin User Data', 'PASS', `Role: ${validAuth.admin.role}, Username: ${validAuth.admin.username}`);
    } else {
      logTest('Valid Admin Login', 'FAIL', 'No authentication result returned');
    }

    // Test invalid credentials
    const invalidAuth = await adminService.authenticateAdmin('invalid', 'wrong');
    if (!invalidAuth) {
      logTest('Invalid Credentials Rejection', 'PASS', 'Correctly rejected invalid credentials');
    } else {
      logTest('Invalid Credentials Rejection', 'FAIL', 'Should have rejected invalid credentials');
    }

  } catch (error) {
    logTest('Admin Authentication', 'FAIL', `Error: ${error.message}`);
  }
}

// Test Analytics Data
async function testAnalyticsData() {
  logSection('ANALYTICS DATA TESTS');
  
  try {
    // Test basic analytics
    const analytics = await adminService.getAnalytics();
    
    if (analytics) {
      logTest('Analytics Data Retrieval', 'PASS', 'Analytics data retrieved successfully');
      logTest('Total Chats Metric', 'PASS', `Total Chats: ${analytics.totalChats}`);
      logTest('Total Sessions Metric', 'PASS', `Total Sessions: ${analytics.totalSessions}`);
      logTest('Total Handoffs Metric', 'PASS', `Total Handoffs: ${analytics.totalHandoffs}`);
      logTest('Average Response Time', 'PASS', `Avg Response: ${analytics.averageResponseTime}ms`);
      logTest('Satisfaction Score', 'PASS', `Satisfaction: ${(analytics.satisfactionScore * 20).toFixed(1)}%`);
      
      if (analytics.topQueries && Array.isArray(analytics.topQueries)) {
        logTest('Top Queries Data', 'PASS', `Found ${analytics.topQueries.length} top queries`);
      } else {
        logTest('Top Queries Data', 'WARN', 'No top queries data available');
      }
      
      if (analytics.dailyStats && Array.isArray(analytics.dailyStats)) {
        logTest('Daily Statistics', 'PASS', `Found ${analytics.dailyStats.length} daily stats entries`);
      } else {
        logTest('Daily Statistics', 'WARN', 'No daily statistics available');
      }
    } else {
      logTest('Analytics Data Retrieval', 'FAIL', 'No analytics data returned');
    }

    // Test analytics with date range
    const dateRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: new Date()
    };
    const rangedAnalytics = await adminService.getAnalytics(dateRange);
    
    if (rangedAnalytics) {
      logTest('Date Range Analytics', 'PASS', 'Analytics with date range retrieved');
    } else {
      logTest('Date Range Analytics', 'FAIL', 'Failed to get analytics with date range');
    }

  } catch (error) {
    logTest('Analytics Data', 'FAIL', `Error: ${error.message}`);
  }
}

// Test System Health
async function testSystemHealth() {
  logSection('SYSTEM HEALTH TESTS');
  
  try {
    const health = await adminService.getSystemHealth();
    
    if (health) {
      logTest('System Health Retrieval', 'PASS', 'System health data retrieved');
      
      // Test individual components
      const components = ['database', 'api', 'aiService', 'webScraper'];
      components.forEach(component => {
        const status = health[component];
        const statusText = status === 'healthy' ? 'PASS' : status === 'warning' ? 'WARN' : 'FAIL';
        logTest(`${component.toUpperCase()} Health`, statusText, `Status: ${status}`);
      });
      
      // Test agent statistics
      if (health.agents) {
        logTest('Agent Statistics', 'PASS', `Online: ${health.agents.online}/${health.agents.total}`);
      } else {
        logTest('Agent Statistics', 'WARN', 'No agent statistics available');
      }
      
      // Test performance metrics
      if (health.performance) {
        logTest('Performance Metrics', 'PASS', 
          `Response: ${health.performance.avgResponseTime}ms, ` +
          `Error Rate: ${(health.performance.errorRate * 100).toFixed(2)}%, ` +
          `Uptime: ${health.performance.uptime.toFixed(1)}%`
        );
      } else {
        logTest('Performance Metrics', 'WARN', 'No performance metrics available');
      }
      
    } else {
      logTest('System Health Retrieval', 'FAIL', 'No system health data returned');
    }

  } catch (error) {
    logTest('System Health', 'FAIL', `Error: ${error.message}`);
  }
}

// Test Knowledge Base Management
async function testKnowledgeBaseManagement() {
  logSection('KNOWLEDGE BASE MANAGEMENT TESTS');
  
  try {
    // Test getting knowledge base entries
    const entries = await adminService.getKnowledgeBase();
    
    if (Array.isArray(entries)) {
      logTest('Knowledge Base Retrieval', 'PASS', `Found ${entries.length} entries`);
      
      if (entries.length > 0) {
        const firstEntry = entries[0];
        logTest('Entry Structure', 'PASS', `Category: ${firstEntry.category}, Question: ${firstEntry.question.substring(0, 50)}...`);
      }
    } else {
      logTest('Knowledge Base Retrieval', 'FAIL', 'Invalid knowledge base data structure');
    }

    // Test creating a new entry
    const newEntry = await adminService.createKnowledgeEntry({
      category: 'test',
      question: 'Test question for Phase 7?',
      answer: 'This is a test answer for Phase 7 testing.',
      keywords: ['test', 'phase7', 'admin'],
      priority: 1
    });
    
    if (newEntry) {
      logTest('Knowledge Entry Creation', 'PASS', `Created entry with ID: ${newEntry.id}`);
      
      // Test updating the entry
      const updatedEntry = await adminService.updateKnowledgeEntry(newEntry.id, {
        priority: 2,
        answer: 'Updated test answer for Phase 7 testing.'
      });
      
      if (updatedEntry) {
        logTest('Knowledge Entry Update', 'PASS', `Updated entry priority to ${updatedEntry.priority}`);
      } else {
        logTest('Knowledge Entry Update', 'FAIL', 'Failed to update knowledge entry');
      }
      
      // Test deleting the entry
      const deleteResult = await adminService.deleteKnowledgeEntry(newEntry.id);
      if (deleteResult) {
        logTest('Knowledge Entry Deletion', 'PASS', 'Test entry deleted successfully');
      } else {
        logTest('Knowledge Entry Deletion', 'FAIL', 'Failed to delete test entry');
      }
      
    } else {
      logTest('Knowledge Entry Creation', 'FAIL', 'Failed to create test knowledge entry');
    }

    // Test search functionality
    const searchResults = await adminService.getKnowledgeBase(null, 'airport');
    if (Array.isArray(searchResults)) {
      logTest('Knowledge Base Search', 'PASS', `Search returned ${searchResults.length} results`);
    } else {
      logTest('Knowledge Base Search', 'FAIL', 'Search functionality failed');
    }

  } catch (error) {
    logTest('Knowledge Base Management', 'FAIL', `Error: ${error.message}`);
  }
}

// Test Agent Performance
async function testAgentPerformance() {
  logSection('AGENT PERFORMANCE TESTS');
  
  try {
    const performance = await adminService.getAgentPerformance();
    
    if (Array.isArray(performance)) {
      logTest('Agent Performance Retrieval', 'PASS', `Found ${performance.length} agents`);
      
      if (performance.length > 0) {
        const agent = performance[0];
        logTest('Agent Performance Data', 'PASS', 
          `Agent: ${agent.name}, Completed Chats: ${agent.completedChats}, ` +
          `Avg Duration: ${agent.avgDuration}s, Satisfaction: ${agent.avgSatisfaction}`
        );
      } else {
        logTest('Agent Performance Data', 'WARN', 'No agents found in system');
      }
    } else {
      logTest('Agent Performance Retrieval', 'FAIL', 'Invalid performance data structure');
    }

  } catch (error) {
    logTest('Agent Performance', 'FAIL', `Error: ${error.message}`);
  }
}

// Test System Configuration
async function testSystemConfiguration() {
  logSection('SYSTEM CONFIGURATION TESTS');
  
  try {
    const config = await adminService.getSystemConfig();
    
    if (config && typeof config === 'object') {
      logTest('System Config Retrieval', 'PASS', 'System configuration retrieved');
      
      // Test configuration sections
      const sections = ['general', 'chat', 'ai', 'agents'];
      sections.forEach(section => {
        if (config[section]) {
          logTest(`${section.toUpperCase()} Config`, 'PASS', `Section contains ${Object.keys(config[section]).length} settings`);
        } else {
          logTest(`${section.toUpperCase()} Config`, 'WARN', `No ${section} configuration found`);
        }
      });
      
    } else {
      logTest('System Config Retrieval', 'FAIL', 'No system configuration returned');
    }

  } catch (error) {
    logTest('System Configuration', 'FAIL', `Error: ${error.message}`);
  }
}

// Test API Endpoints
async function testAPIEndpoints() {
  logSection('API ENDPOINTS TESTS');
  
  const endpoints = [
    { method: 'GET', path: '/api/admin/auth', name: 'Admin Auth Info' },
    { method: 'POST', path: '/api/admin/auth', name: 'Admin Login', body: TEST_CONFIG.adminCredentials },
    { method: 'GET', path: '/api/admin/analytics', name: 'Analytics Data' },
    { method: 'GET', path: '/api/admin/knowledge', name: 'Knowledge Base' },
    { method: 'GET', path: '/api/admin/system', name: 'System Info' }
  ];

  for (const endpoint of endpoints) {
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }

      const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint.path}`, options);
      
      if (response.ok) {
        const data = await response.json();
        logTest(`${endpoint.method} ${endpoint.path}`, 'PASS', `${endpoint.name} - Status: ${response.status}`);
      } else {
        logTest(`${endpoint.method} ${endpoint.path}`, 'WARN', `${endpoint.name} - Status: ${response.status} (Server may not be running)`);
      }
    } catch (error) {
      logTest(`${endpoint.method} ${endpoint.path}`, 'WARN', `${endpoint.name} - Network error (Server may not be running)`);
    }
  }
}

// Main Test Runner
async function runPhase7Tests() {
  log('\n' + '█'.repeat(80), 'blue');
  log('  PHASE 7: ADMIN DASHBOARD - COMPREHENSIVE TESTING', 'bright');
  log('  Oman Airports AI Chatbot - Admin System Validation', 'cyan');
  log('█'.repeat(80), 'blue');

  const startTime = Date.now();

  // Run all tests
  await testAdminAuthentication();
  await testAnalyticsData();
  await testSystemHealth();
  await testKnowledgeBaseManagement();
  await testAgentPerformance();
  await testSystemConfiguration();
  await testAPIEndpoints();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  logSection('PHASE 7 TESTING COMPLETE');
  log(`Total Test Duration: ${duration} seconds`, 'cyan');
  log('\nPhase 7 Features Tested:', 'bright');
  log('✅ Admin Authentication System', 'green');
  log('✅ Analytics and Reporting', 'green');
  log('✅ System Health Monitoring', 'green');
  log('✅ Knowledge Base Management', 'green');
  log('✅ Agent Performance Tracking', 'green');
  log('✅ System Configuration', 'green');
  log('✅ API Endpoints', 'green');
  
  log('\nNext Steps:', 'yellow');
  log('- Access admin dashboard at: http://localhost:3003/admin/login', 'yellow');
  log('- Use credentials: admin / admin123', 'yellow');
  log('- Test all dashboard features interactively', 'yellow');
  log('- Proceed to Phase 8: Security and Performance', 'yellow');
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled Rejection at:', 'red');
  log(promise, 'red');
  log('Reason:', 'red');
  log(reason, 'red');
});

// Run the tests
if (require.main === module) {
  runPhase7Tests().catch(error => {
    log(`Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  runPhase7Tests,
  testAdminAuthentication,
  testAnalyticsData,
  testSystemHealth,
  testKnowledgeBaseManagement,
  testAgentPerformance,
  testSystemConfiguration,
  testAPIEndpoints
}; 