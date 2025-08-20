#!/usr/bin/env node

/**
 * Hikvision Device Endpoint Tester
 * This script tests all Hikvision device endpoints with real credentials
 * 
 * Usage: 
 *   node test-hikvision-endpoints-simple.js <host> <port> <username> <password>
 *   node test-hikvision-endpoints-simple.js 192.168.100.111 80 admin "!@#Mudofaa@"
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

class HikvisionTester {
    constructor(host, port, username, password) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.baseUrl = `http://${host}:${port}`;
        this.results = {
            deviceInfo: {},
            system: {},
            network: {},
            accessControl: {},
            authentication: {},
            events: {},
            users: {},
            faces: {},
            cards: {},
            fingerprints: {},
            webhooks: {},
            capabilities: {},
            errors: []
        };
    }

    async testAllEndpoints() {
        console.log(`🧪 Testing Hikvision device at ${this.host}:${this.port}`);
        console.log(`👤 User: ${this.username}`);
        console.log('='.repeat(60));

        try {
            // Test all endpoint categories
            await this.testDeviceInfoEndpoints();
            await this.testSystemEndpoints();
            await this.testNetworkEndpoints();
            await this.testAccessControlEndpoints();
            await this.testAuthenticationEndpoints();
            await this.testEventEndpoints();
            await this.testUserEndpoints();
            await this.testFaceEndpoints();
            await this.testCardEndpoints();
            await this.testFingerprintEndpoints();
            await this.testWebhookEndpoints();
            await this.testCapabilityEndpoints();

            // Generate and display summary
            this.displaySummary();
            return this.results;

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }

    async makeRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.host,
                port: this.port,
                path: url,
                method: method,
                headers: {
                    'User-Agent': 'Hikvision-Tester/1.0'
                }
            };

            if (data) {
                const dataString = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(dataString);
            }

            const req = http.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 401) {
                        const authHeader = res.headers['www-authenticate'];
                        if (authHeader && authHeader.toLowerCase().startsWith('digest')) {
                            this.makeDigestRequest(url, method, data, authHeader)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            reject(new Error('Authentication failed'));
                        }
                    } else if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async makeDigestRequest(url, method, data, authHeader) {
        return new Promise((resolve, reject) => {
            const digestParams = this.parseDigestHeader(authHeader);
            const authorizationHeader = this.createDigestAuthHeader(digestParams, method, url);

            const options = {
                hostname: this.host,
                port: this.port,
                path: url,
                method: method,
                headers: {
                    'Authorization': authorizationHeader,
                    'User-Agent': 'Hikvision-Tester/1.0'
                }
            };

            if (data) {
                const dataString = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(dataString);
            }

            const req = http.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    parseDigestHeader(header) {
        const params = {};
        header.slice(7).split(',').forEach(part => {
            const [key, value] = part.trim().split(/=(.*)/s);
            params[key] = value.replace(/"/g, '');
        });
        return params;
    }

    createDigestAuthHeader(params, method, url) {
        const realm = params.realm;
        const qop = params.qop;
        const nonce = params.nonce;
        const opaque = params.opaque;
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');

        const ha1 = crypto.createHash('md5')
            .update(`${this.username}:${realm}:${this.password}`)
            .digest('hex');
        
        const ha2 = crypto.createHash('md5')
            .update(`${method}:${url}`)
            .digest('hex');
        
        const response = crypto.createHash('md5')
            .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
            .digest('hex');

        const authParts = [
            `username="${this.username}"`,
            `realm="${realm}"`,
            `nonce="${nonce}"`,
            `uri="${url}"`,
            `qop=${qop}`,
            `nc=${nc}`,
            `cnonce="${cnonce}"`,
            `response="${response}"`,
            `opaque="${opaque}"`
        ];

        return `Digest ${authParts.join(', ')}`;
    }

    async testDeviceInfoEndpoints() {
        console.log('🔍 Testing Device Info Endpoints...');
        
        const endpoints = [
            { name: 'deviceInfo', url: '/ISAPI/System/deviceInfo' },
            { name: 'deviceInfo_lower', url: '/ISAPI/System/deviceinfo' },
            { name: 'deviceStatus', url: '/ISAPI/System/status' },
            { name: 'deviceInfo_content', url: '/ISAPI/ContentMgmt/System/deviceInfo' },
            { name: 'capabilities', url: '/ISAPI/System/capabilities' },
            { name: 'deviceInfo_system', url: '/ISAPI/system/deviceInfo' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.deviceInfo[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.deviceInfo[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Device info ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testSystemEndpoints() {
        console.log('⚙️  Testing System Endpoints...');
        
        const endpoints = [
            { name: 'systemInfo', url: '/ISAPI/System/info' },
            { name: 'systemTime', url: '/ISAPI/System/time' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.system[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.system[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`System ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testNetworkEndpoints() {
        console.log('🌐 Testing Network Endpoints...');
        
        const endpoints = [
            { name: 'networkInterfaces', url: '/ISAPI/System/Network/interfaces' },
            { name: 'networkInterface1', url: '/ISAPI/System/Network/interfaces/1' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.network[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.network[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Network ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testAccessControlEndpoints() {
        console.log('🚪 Testing Access Control Endpoints...');
        
        const endpoints = [
            { name: 'doorInfo', url: '/ISAPI/AccessControl/Door/info' },
            { name: 'doorParam', url: '/ISAPI/AccessControl/Door/param/1' },
            { name: 'accessControlCapabilities', url: '/ISAPI/AccessControl/capabilities' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.accessControl[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.accessControl[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Access control ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testAuthenticationEndpoints() {
        console.log('🔐 Testing Authentication Endpoints...');
        
        const endpoints = [
            { name: 'authenticationInfo', url: '/ISAPI/AccessControl/Authentication' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.authentication[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.authentication[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Authentication ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testEventEndpoints() {
        console.log('📡 Testing Event Endpoints...');
        
        const endpoints = [
            { name: 'eventChannels', url: '/ISAPI/Event/channels' },
            { name: 'eventNotificationHosts', url: '/ISAPI/Event/notification/httpHosts' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.events[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.events[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Event ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testUserEndpoints() {
        console.log('👥 Testing User Endpoints...');
        
        const endpoints = [
            { name: 'userInfo', url: '/ISAPI/AccessControl/UserInfo' },
            { name: 'userCount', url: '/ISAPI/AccessControl/UserInfo/count' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.users[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.users[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`User ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testFaceEndpoints() {
        console.log('👤 Testing Face Endpoints...');
        
        const endpoints = [
            { name: 'faceLibrary', url: '/ISAPI/Intelligent/FDLib' },
            { name: 'faceLibraryCount', url: '/ISAPI/Intelligent/FDLib/count' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.faces[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.faces[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Face ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testCardEndpoints() {
        console.log('💳 Testing Card Endpoints...');
        
        const endpoints = [
            { name: 'cardInfo', url: '/ISAPI/AccessControl/CardInfo' },
            { name: 'cardCount', url: '/ISAPI/AccessControl/CardInfo/count' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.cards[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.cards[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Card ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testFingerprintEndpoints() {
        console.log('👆 Testing Fingerprint Endpoints...');
        
        const endpoints = [
            { name: 'fingerPrint', url: '/ISAPI/AccessControl/FingerPrint' },
            { name: 'fingerPrintCount', url: '/ISAPI/AccessControl/FingerPrint/count' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.fingerprints[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.fingerprints[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Fingerprint ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testWebhookEndpoints() {
        console.log('🔔 Testing Webhook Endpoints...');
        
        const endpoints = [
            { name: 'httpHosts', url: '/ISAPI/Event/notification/httpHosts' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.webhooks[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.webhooks[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Webhook ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testCapabilityEndpoints() {
        console.log('🔧 Testing Capability Endpoints...');
        
        const endpoints = [
            { name: 'systemCapabilities', url: '/ISAPI/System/capabilities' },
            { name: 'videoInputs', url: '/ISAPI/System/Video/inputs' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.url);
                this.results.capabilities[endpoint.name] = { success: true, data: response };
                console.log(`  ✅ ${endpoint.name}`);
            } catch (error) {
                this.results.capabilities[endpoint.name] = { success: false, error: error.message };
                this.results.errors.push(`Capability ${endpoint.name}: ${error.message}`);
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
            }
        }
    }

    displaySummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        let totalEndpoints = 0;
        let successfulEndpoints = 0;

        const categories = [
            'deviceInfo', 'system', 'network', 'accessControl', 
            'authentication', 'events', 'users', 'faces', 
            'cards', 'fingerprints', 'webhooks', 'capabilities'
        ];

        categories.forEach(category => {
            if (this.results[category] && typeof this.results[category] === 'object') {
                const endpoints = Object.keys(this.results[category]);
                const successful = endpoints.filter(
                    endpoint => this.results[category][endpoint].success
                ).length;
                const failed = endpoints.length - successful;
                
                totalEndpoints += endpoints.length;
                successfulEndpoints += successful;

                console.log(`${category.padEnd(20)}: ${successful}/${endpoints.length} ✅`);
            }
        });

        const successRate = Math.round((successfulEndpoints / totalEndpoints) * 100);
        
        console.log('='.repeat(60));
        console.log(`Total Endpoints: ${totalEndpoints}`);
        console.log(`Successful: ${successfulEndpoints} (${successRate}%)`);
        console.log(`Failed: ${totalEndpoints - successfulEndpoints}`);
        console.log(`Errors: ${this.results.errors.length}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Error Summary:');
            this.results.errors.slice(0, 10).forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
            
            if (this.results.errors.length > 10) {
                console.log(`... and ${this.results.errors.length - 10} more errors`);
            }
        }

        console.log('\n🎯 Working Endpoints:');
        const workingEndpoints = [];
        categories.forEach(category => {
            if (this.results[category]) {
                Object.keys(this.results[category]).forEach(endpoint => {
                    if (this.results[category][endpoint].success) {
                        workingEndpoints.push(`${category}.${endpoint}`);
                    }
                });
            }
        });
        
        workingEndpoints.slice(0, 20).forEach(endpoint => {
            console.log(`  ✅ ${endpoint}`);
        });
        
        if (workingEndpoints.length > 20) {
            console.log(`  ... and ${workingEndpoints.length - 20} more working endpoints`);
        }

        console.log('\n📋 Test completed successfully!');
        console.log(`📄 Full results saved to: hikvision-test-results.json`);
        
        // Save detailed results to file
        require('fs').writeFileSync(
            'hikvision-test-results.json', 
            JSON.stringify(this.results, null, 2)
        );
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length !== 4) {
        console.log('Usage: node test-hikvision-endpoints-simple.js <host> <port> <username> <password>');
        console.log('Example: node test-hikvision-endpoints-simple.js 192.168.100.111 80 admin "!@#Mudofaa@"');
        process.exit(1);
    }

    const [host, port, username, password] = args;
    
    const tester = new HikvisionTester(
        host,
        parseInt(port),
        username,
        password
    );

    tester.testAllEndpoints().catch(console.error);
}

module.exports = HikvisionTester;