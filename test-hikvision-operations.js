#!/usr/bin/env node

/**
 * Hikvision Real Data Operations Tester
 * This script performs real operations on the device using working endpoints
 * 
 * Usage: 
 *   node test-hikvision-operations.js <host> <port> <username> <password>
 *   node test-hikvision-operations.js 192.168.100.111 80 admin "!@#Mudofaa@"
 */

const http = require('http');
const crypto = require('crypto');

class HikvisionOperationsTester {
    constructor(host, port, username, password) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.baseUrl = `http://${host}:${port}`;
        this.results = {
            operations: {},
            errors: []
        };
    }

    async testRealOperations() {
        console.log(`🧪 Testing Real Operations on Hikvision device at ${this.host}:${this.port}`);
        console.log(`👤 User: ${this.username}`);
        console.log('='.repeat(60));

        try {
            // Test real operations
            await this.testDeviceOperations();
            await this.testNetworkOperations();
            await this.testUserOperations();
            await this.testEventOperations();
            await this.testAccessControlOperations();

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
                    'User-Agent': 'Hikvision-Operations-Tester/1.0'
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
                    'User-Agent': 'Hikvision-Operations-Tester/1.0'
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

    async testDeviceOperations() {
        console.log('📱 Testing Device Operations...');
        
        try {
            // Get detailed device information
            const deviceInfo = await this.makeRequest('/ISAPI/System/deviceInfo');
            this.results.operations.deviceInfo = this.parseDeviceInfo(deviceInfo);
            console.log('  ✅ Device Information Retrieved');
            
            // Get system capabilities
            const capabilities = await this.makeRequest('/ISAPI/System/capabilities');
            this.results.operations.capabilities = this.parseCapabilities(capabilities);
            console.log('  ✅ System Capabilities Retrieved');
            
            // Get system time
            const systemTime = await this.makeRequest('/ISAPI/System/time');
            this.results.operations.systemTime = this.parseSystemTime(systemTime);
            console.log('  ✅ System Time Retrieved');
            
        } catch (error) {
            this.results.errors.push(`Device operations failed: ${error.message}`);
            console.log(`  ❌ Device operations failed: ${error.message}`);
        }
    }

    async testNetworkOperations() {
        console.log('🌐 Testing Network Operations...');
        
        try {
            // Get network interfaces
            const networkInterfaces = await this.makeRequest('/ISAPI/System/Network/interfaces');
            this.results.operations.networkInterfaces = this.parseNetworkInterfaces(networkInterfaces);
            console.log('  ✅ Network Interfaces Retrieved');
            
            // Get specific interface info
            const interface1 = await this.makeRequest('/ISAPI/System/Network/interfaces/1');
            this.results.operations.interface1 = this.parseNetworkInterface(interface1);
            console.log('  ✅ Interface 1 Details Retrieved');
            
        } catch (error) {
            this.results.errors.push(`Network operations failed: ${error.message}`);
            console.log(`  ❌ Network operations failed: ${error.message}`);
        }
    }

    async testUserOperations() {
        console.log('👥 Testing User Operations...');
        
        try {
            // Get user count
            const userCount = await this.makeRequest('/ISAPI/AccessControl/UserInfo/count');
            this.results.operations.userCount = this.parseUserCount(userCount);
            console.log('  ✅ User Count Retrieved');
            
            // Get user list
            const userList = await this.makeRequest('/ISAPI/Security/users');
            this.results.operations.userList = this.parseUserList(userList);
            console.log('  ✅ User List Retrieved');
            
            // Get specific user details
            const userDetail = await this.makeRequest('/ISAPI/Security/users/1');
            this.results.operations.userDetail = this.parseUserDetail(userDetail);
            console.log('  ✅ User Details Retrieved');
            
        } catch (error) {
            this.results.errors.push(`User operations failed: ${error.message}`);
            console.log(`  ❌ User operations failed: ${error.message}`);
        }
    }

    async testEventOperations() {
        console.log('📡 Testing Event Operations...');
        
        try {
            // Get event notification hosts
            const eventHosts = await this.makeRequest('/ISAPI/Event/notification/httpHosts');
            this.results.operations.eventHosts = this.parseEventHosts(eventHosts);
            console.log('  ✅ Event Notification Hosts Retrieved');
            
        } catch (error) {
            this.results.errors.push(`Event operations failed: ${error.message}`);
            console.log(`  ❌ Event operations failed: ${error.message}`);
        }
    }

    async testAccessControlOperations() {
        console.log('🚪 Testing Access Control Operations...');
        
        try {
            // Get door parameters
            const doorParam = await this.makeRequest('/ISAPI/AccessControl/Door/param/1');
            this.results.operations.doorParam = this.parseDoorParam(doorParam);
            console.log('  ✅ Door Parameters Retrieved');
            
            // Get access control capabilities
            const accessCapabilities = await this.makeRequest('/ISAPI/AccessControl/capabilities');
            this.results.operations.accessCapabilities = this.parseAccessCapabilities(accessCapabilities);
            console.log('  ✅ Access Control Capabilities Retrieved');
            
        } catch (error) {
            this.results.errors.push(`Access control operations failed: ${error.message}`);
            console.log(`  ❌ Access control operations failed: ${error.message}`);
        }
    }

    // Parser methods
    parseDeviceInfo(xmlData) {
        try {
            const deviceInfo = {};
            const regex = /<(\w+)>([^<]+)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                deviceInfo[match[1]] = match[2];
            }
            
            return {
                deviceName: deviceInfo.deviceName || 'Unknown',
                model: deviceInfo.model || 'Unknown',
                serialNumber: deviceInfo.serialNumber || 'Unknown',
                firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
                manufacturer: deviceInfo.manufacturer || 'Hikvision',
                deviceType: deviceInfo.deviceType || 'Unknown',
                macAddress: deviceInfo.macAddress || 'Unknown'
            };
        } catch (error) {
            return { error: 'Failed to parse device info' };
        }
    }

    parseCapabilities(xmlData) {
        try {
            const capabilities = {
                supportReboot: xmlData.includes('<isSupportReboot>true</isSupportReboot>'),
                supportDeviceInfo: xmlData.includes('<isSupportDeviceInfo>true</isSupportDeviceInfo>'),
                supportTimeCap: xmlData.includes('<isSupportTimeCap>true</isSupportTimeCap>'),
                supportFactoryReset: xmlData.includes('<isSupportFactoryReset>true</isSupportFactoryReset>'),
                supportFaceRecognition: xmlData.includes('<isSupportFaceRecognizeMode>true</isSupportFaceRecognizeMode>'),
                supportFingerprint: xmlData.includes('<isSupportFingerPrintCfg>true</isSupportFingerPrintCfg>'),
                supportCardManagement: xmlData.includes('<isSupportCardInfo>true</isSupportCardInfo>'),
                supportEventSubscription: xmlData.includes('<isSupportSubscribeEvent>true</isSupportSubscribeEvent>')
            };
            
            return capabilities;
        } catch (error) {
            return { error: 'Failed to parse capabilities' };
        }
    }

    parseSystemTime(xmlData) {
        try {
            const timeInfo = {};
            const regex = /<(\w+)>([^<]+)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                timeInfo[match[1]] = match[2];
            }
            
            return {
                timeMode: timeInfo.timeMode || 'Unknown',
                localTime: timeInfo.localTime || 'Unknown',
                timeZone: timeInfo.timeZone || 'Unknown'
            };
        } catch (error) {
            return { error: 'Failed to parse system time' };
        }
    }

    parseNetworkInterfaces(xmlData) {
        try {
            const interfaces = [];
            const interfaceRegex = /<NetworkInterface>([\s\S]*?)<\/NetworkInterface>/g;
            let match;
            
            while ((match = interfaceRegex.exec(xmlData)) !== null) {
                const interfaceData = match[1];
                const interfaceObj = {};
                const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
                let fieldMatch;
                
                while ((fieldMatch = fieldRegex.exec(interfaceData)) !== null) {
                    interfaceObj[fieldMatch[1]] = fieldMatch[2];
                }
                
                interfaces.push(interfaceObj);
            }
            
            return interfaces;
        } catch (error) {
            return { error: 'Failed to parse network interfaces' };
        }
    }

    parseNetworkInterface(xmlData) {
        try {
            const interfaceObj = {};
            const regex = /<(\w+)>([^<]*)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                interfaceObj[match[1]] = match[2];
            }
            
            return interfaceObj;
        } catch (error) {
            return { error: 'Failed to parse network interface' };
        }
    }

    parseUserCount(jsonData) {
        try {
            return JSON.parse(jsonData);
        } catch (error) {
            return { error: 'Failed to parse user count' };
        }
    }

    parseUserList(xmlData) {
        try {
            const users = [];
            const userRegex = /<User>([\s\S]*?)<\/User>/g;
            let match;
            
            while ((match = userRegex.exec(xmlData)) !== null) {
                const userData = match[1];
                const userObj = {};
                const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
                let fieldMatch;
                
                while ((fieldMatch = fieldRegex.exec(userData)) !== null) {
                    userObj[fieldMatch[1]] = fieldMatch[2];
                }
                
                users.push(userObj);
            }
            
            return users;
        } catch (error) {
            return { error: 'Failed to parse user list' };
        }
    }

    parseUserDetail(xmlData) {
        try {
            const userObj = {};
            const regex = /<(\w+)>([^<]*)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                userObj[match[1]] = match[2];
            }
            
            return userObj;
        } catch (error) {
            return { error: 'Failed to parse user detail' };
        }
    }

    parseEventHosts(xmlData) {
        try {
            const hosts = [];
            const hostRegex = /<HttpHostNotification>([\s\S]*?)<\/HttpHostNotification>/g;
            let match;
            
            while ((match = hostRegex.exec(xmlData)) !== null) {
                const hostData = match[1];
                const hostObj = {};
                const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
                let fieldMatch;
                
                while ((fieldMatch = fieldRegex.exec(hostData)) !== null) {
                    hostObj[fieldMatch[1]] = fieldMatch[2];
                }
                
                hosts.push(hostObj);
            }
            
            return hosts;
        } catch (error) {
            return { error: 'Failed to parse event hosts' };
        }
    }

    parseDoorParam(xmlData) {
        try {
            const doorObj = {};
            const regex = /<(\w+)>([^<]*)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                doorObj[match[1]] = match[2];
            }
            
            return doorObj;
        } catch (error) {
            return { error: 'Failed to parse door parameters' };
        }
    }

    parseAccessCapabilities(xmlData) {
        try {
            const capabilities = {};
            const regex = /<(\w+)>([^<]*)<\/\1>/g;
            let match;
            
            while ((match = regex.exec(xmlData)) !== null) {
                capabilities[match[1]] = match[2];
            }
            
            return capabilities;
        } catch (error) {
            return { error: 'Failed to parse access capabilities' };
        }
    }

    displaySummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 REAL OPERATIONS SUMMARY');
        console.log('='.repeat(60));

        // Display device information
        if (this.results.operations.deviceInfo) {
            console.log('\n📱 Device Information:');
            const device = this.results.operations.deviceInfo;
            console.log(`  Name: ${device.deviceName}`);
            console.log(`  Model: ${device.model}`);
            console.log(`  Serial: ${device.serialNumber}`);
            console.log(`  Firmware: ${device.firmwareVersion}`);
            console.log(`  Type: ${device.deviceType}`);
        }

        // Display capabilities
        if (this.results.operations.capabilities) {
            console.log('\n🔧 System Capabilities:');
            const caps = this.results.operations.capabilities;
            console.log(`  Reboot: ${caps.supportReboot ? '✅' : '❌'}`);
            console.log(`  Face Recognition: ${caps.supportFaceRecognition ? '✅' : '❌'}`);
            console.log(`  Fingerprint: ${caps.supportFingerprint ? '✅' : '❌'}`);
            console.log(`  Card Management: ${caps.supportCardManagement ? '✅' : '❌'}`);
            console.log(`  Event Subscription: ${caps.supportEventSubscription ? '✅' : '❌'}`);
        }

        // Display user information
        if (this.results.operations.userCount) {
            console.log('\n👥 User Information:');
            console.log(`  Total Users: ${this.results.operations.userCount.UserInfoCount?.userNumber || 'Unknown'}`);
        }

        if (this.results.operations.userList && this.results.operations.userList.length > 0) {
            console.log('  User List:');
            this.results.operations.userList.forEach(user => {
                console.log(`    - ID: ${user.id}, Name: ${user.userName}, Level: ${user.userLevel}`);
            });
        }

        // Display network information
        if (this.results.operations.networkInterfaces && this.results.operations.networkInterfaces.length > 0) {
            console.log('\n🌐 Network Interfaces:');
            this.results.operations.networkInterfaces.forEach((iface, index) => {
                console.log(`  Interface ${index + 1}:`);
                console.log(`    ID: ${iface.id}`);
                console.log(`    MAC: ${iface.macAddress}`);
                if (iface.IPAddress && iface.IPAddress.ipAddress) {
                    console.log(`    IP: ${iface.IPAddress.ipAddress}`);
                    console.log(`    Type: ${iface.IPAddress.addressingType}`);
                }
            });
        }

        // Display event hosts
        if (this.results.operations.eventHosts && this.results.operations.eventHosts.length > 0) {
            console.log('\n📡 Event Notification Hosts:');
            this.results.operations.eventHosts.forEach(host => {
                console.log(`  Host ${host.id}:`);
                console.log(`    URL: ${host.url || 'Not configured'}`);
                console.log(`    IP: ${host.ipAddress}:${host.portNo}`);
                if (host.SubscribeEvent) {
                    console.log(`    Event Mode: ${host.SubscribeEvent.eventMode}`);
                    console.log(`    Heartbeat: ${host.SubscribeEvent.heartbeat}s`);
                }
            });
        }

        // Display access control info
        if (this.results.operations.doorParam) {
            console.log('\n🚪 Door Parameters:');
            const door = this.results.operations.doorParam;
            console.log(`  Name: ${door.doorName || 'Not set'}`);
            console.log(`  Magnetic Type: ${door.magneticType}`);
            console.log(`  Open Duration: ${door.openDuration}s`);
            console.log(`  Disabled Open Duration: ${door.disabledOpenDuration}s`);
        }

        console.log('\n❌ Errors:');
        if (this.results.errors.length === 0) {
            console.log('  No errors encountered!');
        } else {
            this.results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        // Save detailed results
        require('fs').writeFileSync(
            'hikvision-operations-results.json', 
            JSON.stringify(this.results, null, 2)
        );
        
        console.log('\n📄 Detailed results saved to: hikvision-operations-results.json');
        console.log('🎯 Real operations test completed successfully!');
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length !== 4) {
        console.log('Usage: node test-hikvision-operations.js <host> <port> <username> <password>');
        console.log('Example: node test-hikvision-operations.js 192.168.100.111 80 admin "!@#Mudofaa@"');
        process.exit(1);
    }

    const [host, port, username, password] = args;
    
    const tester = new HikvisionOperationsTester(
        host,
        parseInt(port),
        username,
        password
    );

    tester.testRealOperations().catch(console.error);
}

module.exports = HikvisionOperationsTester;