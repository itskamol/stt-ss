// ISAPI Common Types
export interface ISAPIResponse {
    requestURL?: string;
    statusCode: number;
    statusString: string;
    subStatusCode: string;
    errorCode?: number;
    errorMsg?: string;
}

export interface ISAPIXMLResponse {
    requestURL?: string;
    statusCode: number;
    statusString: string;
    subStatusCode: string;
}

// Person Management Types
export interface PersonSearchRequest {
    UserInfoSearchCond: {
        searchID: string;
        searchResultPosition: number;
        maxResults: number;
        EmployeeNoList?: Array<{
            employeeNo: string;
        }>;
    };
}

export interface PersonSearchResponse {
    UserInfoSearch: {
        searchID: string;
        responseStatusStrg: string;
        numOfMatches: number;
        totalMatches: number;
        UserInfo: PersonInfo[];
    };
}

export interface PersonInfo {
    employeeNo: string;
    name: string;
    userType: 'normal' | 'visitor' | 'blackList' | 'patient' | 'maintenance';
    Valid?: {
        enable: boolean;
        beginTime?: string;
        endTime?: string;
        timeType?: string;
    };
    doorRight?: string;
    RightPlan?: Array<{
        doorNo: number;
        planTemplateNo: string;
    }>;
    userVerifyMode?: string;
    checkUser?: boolean;
}

export interface PersonAddRequest {
    UserInfo: PersonInfo;
}

export interface PersonModifyRequest {
    UserInfo: Partial<PersonInfo>;
}

export interface PersonDeleteRequest {
    UserInfoDetail: {
        mode: 'all' | 'byList';
        EmployeeNoList?: Array<{
            employeeNo: string;
        }>;
    };
}

// Face Management Types
export interface FaceSearchRequest {
    FacePictureSearchCond: {
        searchID: string;
        searchResultPosition: number;
        maxResults: number;
        faceLibType: string;
        FDID?: string;
        employeeNo?: string;
    };
}

export interface FaceSearchResponse {
    FacePictureSearch: {
        searchID: string;
        responseStatusStrg: string;
        numOfMatches: number;
        totalMatches: number;
        MatchList: Array<{
            employeeNo: string;
            name: string;
            bornTime?: string;
            faceURL: string;
        }>;
    };
}

export interface FaceAddRequest {
    faceLibType: string;
    FDID: string;
    name: string;
    gender?: 'male' | 'female';
    bornTime?: string;
    employeeNo?: string;
}

export interface FaceModifyRequest {
    faceLibType: string;
    FDID: string;
    FPID?: string;
    name?: string;
    gender?: 'male' | 'female';
    bornTime?: string;
}

export interface FaceLibraryInfo {
    FDID: string;
    faceLibType: string;
    name: string;
    recordDataNumber: number;
    libArmingType: string;
    libAttribute: string;
    personnelFileEnabled: boolean;
}

// Fingerprint Management Types
export interface FingerprintAddRequest {
    employeeNo: string;
    fingerPrintID: string;
    fingerType: string;
    fingerData: string;
}

export interface FingerprintSearchResponse {
    FingerPrintInfo: Array<{
        employeeNo: string;
        fingerPrintID: string;
        fingerType: string;
        status: string;
    }>;
}

// Event Host Types
export interface HttpHostNotification {
    id: string;
    url: string;
    protocolType: 'HTTP' | 'HTTPS';
    parameterFormatType: 'XML' | 'JSON' | 'querystring';
    addressingFormatType: 'hostname' | 'ipaddress';
    hostName?: string;
    ipAddress?: string;
    ipv6Address?: string;
    portNo: number;
    userName?: string;
    password?: string;
    httpAuthenticationMethod: 'none' | 'MD5digest' | 'base64';
    uploadImagesDataType?: 'URL' | 'binary';
    httpBroken?: boolean;
    SubscribeEvent?: {
        heartbeat: number;
        eventMode: 'all' | 'list';
        EventList?: Array<{
            type: string;
            minorAlarm?: string;
            minorException?: string;
            minorOperation?: string;
            minorEvent?: string;
            pictureURLType?: string;
            channels?: string;
        }>;
        channels?: string;
        pictureURLType?: string;
    };
}

export interface HttpHostNotificationList {
    HttpHostNotification: HttpHostNotification[];
}

// User Management Types
export interface UserInfo {
    id: number;
    enabled: boolean;
    userName: string;
    password?: string;
    userLevel: 'Administrator' | 'Operator' | 'Viewer' | 'installer' | 'manufacturer';
    loginPassword?: string;
    userActivationStatus?: boolean;
}

export interface UserList {
    User: UserInfo[];
}

export interface UserCheckResponse {
    statusValue: number;
    statusString: string;
    isDefaultPassword: boolean;
    isRiskPassword: boolean;
    isActivated: boolean;
    residualValidity: number;
    lockStatus: 'unlock' | 'lock';
    unlockTime: number;
    retryLoginTime: number;
}

// Schedule Management Types
export interface AttendanceWeekPlan {
    enable: boolean;
    WeekPlanCfg: Array<{
        id: number;
        week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
        enable: boolean;
        TimeSegment: {
            beginTime: string;
            endTime: string;
        };
    }>;
}

export interface AttendancePlanTemplate {
    enable: boolean;
    property: 'check' | 'break' | 'overtime';
    templateName: string;
    weekPlanNo: number;
    holidayGroupNo?: string;
}

export interface HolidayPlanCfg {
    enable: boolean;
    beginDate: string;
    endDate: string;
    HolidayPlanCfg: Array<{
        id: number;
        enable: boolean;
        verifyMode: string;
        TimeSegment: {
            beginTime: string;
            endTime: string;
        };
    }>;
}

// Card Reader Configuration Types
export interface CardReaderCfg {
    enable: boolean;
    okLedPolarity: 'cathode' | 'anode';
    errorLedPolarity: 'cathode' | 'anode';
    buzzerPolarity: 'cathode' | 'anode';
    swipeInterval: number;
    pressTimeout: number;
    enableFailAlarm: boolean;
    maxReadCardFailNum: number;
    enableTamperCheck: boolean;
    offlineCheckTime: number;
    fingerPrintCheckLevel: number;
    useLocalController: boolean;
    localControllerID: number;
    localControllerReaderID: number;
    cardReaderChannel: number;
    fingerPrintImageQuality: number;
    fingerPrintContrastTimeOut: number;
    fingerPrintRecogizeInterval: number;
    fingerPrintMatchFastMode: number;
    fingerPrintModuleSensitive: number;
    fingerPrintModuleLightCondition: 'outdoor' | 'indoor';
    faceMatchThresholdN: number;
    faceQuality: number;
    faceRecogizeTimeOut: number;
    faceRecogizeInterval: number;
    cardReaderFunction: string[];
    cardReaderDescription: string;
    faceImageSensitometry: number;
    livingBodyDetect: boolean;
    faceMatchThreshold1: number;
    buzzerTime: number;
    faceMatch1SecurityLevel: number;
    faceMatchNSecurityLevel: number;
    envirMode: 'indoor' | 'other';
    liveDetLevelSet: 'low' | 'middle' | 'high';
    liveDetAntiAttackCntLimit: number;
    enableLiveDetAntiAttack: boolean;
    supportDelFPByID: boolean;
    fingerPrintCapacity: number;
    fingerPrintNum: number;
    defaultVerifyMode: string;
    faceRecogizeEnable: number;
    FPAlgorithmVersion: string;
    cardReaderVersion: string;
    enableReverseCardNo: boolean;
    independSwipeIntervals: number;
    maskFaceMatchThresholdN: number;
    maskFaceMatchThreshold1: number;
    faceMotionDetLevel: 'low' | 'meduim' | 'height';
    showMode: 'concise' | 'normal' | 'advertising' | 'meeting' | 'selfDefine' | 'boxStatus';
    enableScreenOff: boolean;
    screenOffTimeout: number;
}

// Wiegand Configuration Types
export interface WiegandCfg {
    communicateDirection: 'receive' | 'send';
    wiegandMode: string;
    inputWiegandMode: string;
    signalInterval: number;
    enable: boolean;
    pulseDuration: number;
    facilityCodeEnabled: boolean;
    facilityCode: number;
    dataType: 'employeeNo' | 'cardNo';
}

// Face Compare Condition Types
export interface FaceCompareCond {
    faceWidthLowerLimit: number;
    pitch: number;
    yaw: number;
    width: number;
    height: number;
    leftBorder: number;
    rightBorder: number;
    upBorder: number;
    bottomBorder: number;
    interorbitalDistance: number;
    faceScore: number;
    maxDistance: number;
    similarity: number;
    antiFake: number;
    identifyType: 'highest' | 'single' | 'multipl';
    chooseType: 'middle' | 'biggest' | 'all';
    enabled: 'singleFace' | 'close' | 'multiFace';
    faceScoreEnabled: boolean;
}

// Identity Terminal Types
export interface IdentityTerminal {
    terminalMode: 'authMode' | 'registerMode';
    idCardReader: string;
    camera: string;
    fingerPrintModule: string;
    videoStorageTime: number;
    faceContrastThreshold: number;
    twoDimensionCode: 'enable' | 'disable';
    blackListCheck: 'enable' | 'disable';
    idCardCheckCenter: 'local' | 'server';
    faceAlgorithm: 'DeepLearn' | 'Tradition';
    comNo: number;
    memoryLearning: 'enable' | 'disable';
    saveCertifiedImage: 'enable' | 'disable';
    MCUVersion: string;
    usbOutput: 'enable' | 'disable';
    serialOutput: 'enable' | 'disable';
    readInfoOfCard: 'serialNo' | 'file';
    workMode: 'passMode' | 'accessControlMode';
    ecoMode: {
        eco: 'enable' | 'disable';
        faceMatchThreshold1: number;
        faceMatchThresholdN: number;
        changeThreshold: number;
        maskFaceMatchThresholdN: number;
        maskFaceMatchThreshold1: number;
    };
    readCardRule: 'wiegand26' | 'wiegand34';
    enableScreenOff: boolean;
    screenOffTimeout: number;
    enableScreensaver: boolean;
    faceModuleVersion: string;
    showMode: 'concise' | 'normal' | 'advertising' | 'meeting' | 'selfDefine' | 'boxStatus';
    needDeviceCheck: boolean;
}
