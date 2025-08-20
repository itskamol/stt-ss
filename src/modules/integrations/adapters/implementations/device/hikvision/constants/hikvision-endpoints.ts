/**
 * Hikvision ISAPI Endpoint Constants
 * This file contains all the working endpoints based on real device testing
 */

export const HIKVISION_ENDPOINTS = {
    // Device Information
    DEVICE_INFO: {
        PRIMARY: '/ISAPI/System/deviceInfo',
        ALTERNATIVES: [
            '/ISAPI/System/deviceinfo',
            '/ISAPI/system/deviceInfo',
            '/ISAPI/System/capabilities',
        ],
    },

    // System
    SYSTEM: {
        TIME: '/ISAPI/System/time',
        CAPABILITIES: '/ISAPI/System/capabilities',
        REBOOT: '/ISAPI/System/reboot',
        FACTORY_RESET: '/ISAPI/System/factoryReset',
    },

    // Network
    NETWORK: {
        INTERFACES: '/ISAPI/System/Network/interfaces',
        INTERFACE_1: '/ISAPI/System/Network/interfaces/1',
        INTERFACE_2: '/ISAPI/System/Network/interfaces/2',
    },

    // User Management (Fixed endpoints)
    USERS: {
        LIST: '/ISAPI/Security/users',
        SINGLE: '/ISAPI/Security/users/{id}',
        COUNT: '/ISAPI/AccessControl/UserInfo/count', // Still works for count
        CHECK: '/ISAPI/Security/userCheck',
    },

    // Access Control
    ACCESS_CONTROL: {
        DOOR_PARAM: '/ISAPI/AccessControl/Door/param/1',
        CAPABILITIES: '/ISAPI/AccessControl/capabilities',
        REMOTE_CONTROL: '/ISAPI/AccessControl/RemoteControl/door/1',
    },

    // Event Management
    EVENTS: {
        HTTP_HOSTS: '/ISAPI/Event/notification/httpHosts',
        CHANNELS: '/ISAPI/Event/channels',
    },

    // Face Recognition (Conditional support)
    FACE: {
        FD_LIB: '/ISAPI/Intelligent/FDLib',
        FACE_DATA_RECORD: '/ISAPI/Intelligent/FDLib/FaceDataRecord',
        FACE_SEARCH: '/ISAPI/Intelligent/FDLib/FDSearch',
        CAPABILITIES: '/ISAPI/AccessControl/capabilities', // Check isSupportFaceRecognizeMode
    },

    // Card Management (Conditional support)
    CARD: {
        INFO: '/ISAPI/AccessControl/CardInfo',
        COUNT: '/ISAPI/AccessControl/CardInfo/count',
        CAPABILITIES: '/ISAPI/AccessControl/CardInfo/capabilities',
    },

    // Fingerprint Management (Conditional support)
    FINGERPRINT: {
        INFO: '/ISAPI/AccessControl/FingerPrint',
        COUNT: '/ISAPI/AccessControl/FingerPrint/count',
    },

    // System Configuration
    CONFIG: {
        AUTHENTICATION: '/ISAPI/AccessControl/Authentication',
        CARD_READER: '/ISAPI/AccessControl/CardReaderCfg/{id}',
        WIEGAND: '/ISAPI/AccessControl/WiegandCfg/wiegandNo/{id}',
        FACE_COMPARE: '/ISAPI/AccessControl/FaceCompareCond',
        IDENTITY_TERMINAL: '/ISAPI/AccessControl/IdentityTerminal',
        NFC: '/ISAPI/AccessControl/Configuration/NFCCfg',
        CARD_VERIFICATION: '/ISAPI/AccessControl/CardVerificationRule',
    },

    // Video
    VIDEO: {
        INPUTS: '/ISAPI/System/Video/inputs',
        CHANNELS: '/ISAPI/System/Video/inputs/channels',
    },
};

/**
 * Working endpoints based on testing
 * These endpoints have been verified to work on real devices
 */
export const WORKING_ENDPOINTS = [
    HIKVISION_ENDPOINTS.DEVICE_INFO.PRIMARY,
    HIKVISION_ENDPOINTS.DEVICE_INFO.ALTERNATIVES[0],
    HIKVISION_ENDPOINTS.DEVICE_INFO.ALTERNATIVES[1],
    HIKVISION_ENDPOINTS.SYSTEM.CAPABILITIES,
    HIKVISION_ENDPOINTS.SYSTEM.TIME,
    HIKVISION_ENDPOINTS.NETWORK.INTERFACES,
    HIKVISION_ENDPOINTS.NETWORK.INTERFACE_1,
    HIKVISION_ENDPOINTS.ACCESS_CONTROL.DOOR_PARAM,
    HIKVISION_ENDPOINTS.ACCESS_CONTROL.CAPABILITIES,
    HIKVISION_ENDPOINTS.USERS.LIST,
    HIKVISION_ENDPOINTS.USERS.COUNT,
    HIKVISION_ENDPOINTS.EVENTS.HTTP_HOSTS,
    HIKVISION_ENDPOINTS.VIDEO.INPUTS,
];

/**
 * Endpoints that may not be supported on all devices
 * These should be checked for support before use
 */
export const CONDITIONAL_ENDPOINTS = [
    HIKVISION_ENDPOINTS.FACE.FD_LIB,
    HIKVISION_ENDPOINTS.FACE.FACE_DATA_RECORD,
    HIKVISION_ENDPOINTS.FACE.FACE_SEARCH,
    HIKVISION_ENDPOINTS.CARD.INFO,
    HIKVISION_ENDPOINTS.CARD.COUNT,
    HIKVISION_ENDPOINTS.FINGERPRINT.INFO,
    HIKVISION_ENDPOINTS.FINGERPRINT.COUNT,
    HIKVISION_ENDPOINTS.CONFIG.AUTHENTICATION,
];

/**
 * Error patterns that indicate an endpoint is not supported
 */
export const UNSUPPORTED_ERROR_PATTERNS = [
    'notSupport',
    'Invalid Operation',
    'invalidContent',
    'badURLFormat',
    'does not exist',
    'not found',
];

/**
 * Device capability flags
 */
export const DEVICE_CAPABILITIES = {
    FACE_RECOGNITION: 'isSupportFaceRecognizeMode',
    FINGERPRINT: 'isSupportFingerPrintCfg',
    CARD_MANAGEMENT: 'isSupportCardInfo',
    EVENT_SUBSCRIPTION: 'isSupportSubscribeEvent',
    REBOOT: 'isSupportReboot',
    DEVICE_INFO: 'isSupportDeviceInfo',
    TIME_CAP: 'isSupportTimeCap',
    FACTORY_RESET: 'isSupportFactoryReset',
};
