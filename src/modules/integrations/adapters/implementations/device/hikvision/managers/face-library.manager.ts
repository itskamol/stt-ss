import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import {
  FaceSearchRequest,
  FaceSearchResponse,
  FaceAddRequest,
  FaceModifyRequest,
  FaceLibraryInfo,
  ISAPIResponse
} from '../types';

@Injectable()
export class HikvisionFaceLibraryManager {
  constructor(
    private readonly httpClient: HikvisionHttpClient,
    private readonly logger: LoggerService,
    private readonly xmlJsonService: XmlJsonService,
  ) {}

  /**
   * Check if device supports face library management
   */
  async checkFaceLibrarySupport(device: any): Promise<boolean> {
    try {
      this.logger.debug('Checking face library support', { deviceId: device.id });

      const response = await this.httpClient.request(device, {
        method: 'GET',
        url: '/ISAPI/AccessControl/capabilities',
      });

      // Parse XML response to check for isSupportFDLib
      const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);
      const isSupportFDLib = jsonResponse?.AccessControlCap?.isSupportFDLib === 'true';

      this.logger.debug('Face library support check completed', {
        deviceId: device.id,
        supported: isSupportFDLib,
      });

      return isSupportFDLib;
    } catch (error) {
      this.logger.error('Failed to check face library support', error.message, {
        deviceId: device.id,
      });
      return false;
    }
  }

  /**
   * Get face library capabilities
   */
  async getFaceLibraryCapabilities(device: any): Promise<any> {
    try {
      this.logger.debug('Getting face library capabilities', { deviceId: device.id });

      const response = await this.httpClient.request(device, {
        method: 'GET',
        url: '/ISAPI/Intelligent/FDLib/capabilities?format=json',
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get face library capabilities', error.message, {
        deviceId: device.id,
      });
      throw error;
    }
  }

  /**
   * Create face library
   */
  async createFaceLibrary(
    device: any,
    libraryData: {
      faceLibType: 'blackFD' | 'staticFD';
      name: string;
      customInfo?: string;
      libArmingType?: string;
      libAttribute?: string;
      FDID: string;
    }
  ): Promise<ISAPIResponse & { FDID?: string }> {
    try {
      this.logger.debug('Creating face library', { deviceId: device.id, FDID: libraryData.FDID });

      const response = await this.httpClient.request<ISAPIResponse & { FDID?: string }>(device, {
        method: 'POST',
        url: '/ISAPI/Intelligent/FDLib?format=json',
        data: libraryData,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.debug('Face library created successfully', {
        deviceId: device.id,
        FDID: response.FDID,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create face library', error.message, {
        deviceId: device.id,
        FDID: libraryData.FDID,
      });
      throw error;
    }
  }

  /**
   * Get all face libraries
   */
  async getAllFaceLibraries(device: any): Promise<FaceLibraryInfo[]> {
    try {
      this.logger.debug('Getting all face libraries', { deviceId: device.id });

      const response = await this.httpClient.request<{
        FDRecordDataInfo: FaceLibraryInfo[];
        totalRecordDataNumber: number;
      }>(device, {
        method: 'GET',
        url: '/ISAPI/Intelligent/FDLib/Count?format=json',
      });

      this.logger.debug('Face libraries retrieved', {
        deviceId: device.id,
        count: response.FDRecordDataInfo?.length || 0,
      });

      return response.FDRecordDataInfo || [];
    } catch (error) {
      this.logger.error('Failed to get face libraries', error.message, {
        deviceId: device.id,
      });
      throw error;
    }
  }

  /**
   * Delete all face libraries
   */
  async deleteAllFaceLibraries(device: any): Promise<ISAPIResponse> {
    try {
      this.logger.debug('Deleting all face libraries', { deviceId: device.id });

      const response = await this.httpClient.request<ISAPIResponse>(device, {
        method: 'DELETE',
        url: '/ISAPI/Intelligent/FDLib?format=json',
      });

      this.logger.debug('All face libraries deleted', {
        deviceId: device.id,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to delete all face libraries', error.message, {
        deviceId: device.id,
      });
      throw error;
    }
  }

  /**
   * Search face pictures
   */
  async searchFacePictures(
    device: any,
    searchRequest: FaceSearchRequest
  ): Promise<FaceSearchResponse> {
    try {
      this.logger.debug('Searching face pictures', { deviceId: device.id, searchRequest });

      const response = await this.httpClient.request<FaceSearchResponse>(device, {
        method: 'POST',
        url: '/ISAPI/Intelligent/FDLib/FDSearch?format=json',
        data: searchRequest,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.debug('Face picture search completed', {
        deviceId: device.id,
        totalMatches: response.FacePictureSearch.totalMatches,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to search face pictures', error.message, {
        deviceId: device.id,
        searchRequest,
      });
      throw error;
    }
  }

  /**
   * Add face picture with binary data
   */
  async addFacePicture(
    device: any,
    faceData: FaceAddRequest,
    imageBuffer: Buffer,
    filename: string = 'face_picture.jpg'
  ): Promise<ISAPIResponse & { FPID?: string; rowKey?: string }> {
    try {
      this.logger.debug('Adding face picture', { deviceId: device.id, employeeNo: faceData.employeeNo });

      // Create multipart form data
      const FormData = require('form-data');
      const form = new FormData();

      // Add JSON metadata
      form.append('FaceDataRecord', JSON.stringify(faceData), {
        contentType: 'application/json',
      });

      // Add binary image data
      form.append('face picture', imageBuffer, {
        filename,
        contentType: 'image/jpeg',
      });

      const response = await this.httpClient.request<ISAPIResponse & { FPID?: string; rowKey?: string }>(device, {
        method: 'POST',
        url: '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json',
        data: form,
        headers: {
          ...form.getHeaders(),
        },
      });

      this.logger.debug('Face picture added successfully', {
        deviceId: device.id,
        FPID: response.FPID,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to add face picture', error.message, {
        deviceId: device.id,
        employeeNo: faceData.employeeNo,
      });
      throw error;
    }
  }

  /**
   * Apply face picture (add or update)
   */
  async applyFacePicture(
    device: any,
    faceData: Partial<FaceAddRequest>,
    imageBuffer?: Buffer,
    filename: string = 'face_picture.jpg'
  ): Promise<ISAPIResponse> {
    try {
      this.logger.debug('Applying face picture', { deviceId: device.id, FDID: faceData.FDID });

      // Create multipart form data
      const FormData = require('form-data');
      const form = new FormData();

      // Add JSON metadata
      form.append('FaceDataRecord', JSON.stringify(faceData), {
        contentType: 'application/json',
      });

      // Add binary image data if provided
      if (imageBuffer) {
        form.append('face picture', imageBuffer, {
          filename,
          contentType: 'image/jpeg',
        });
      }

      const response = await this.httpClient.request<ISAPIResponse>(device, {
        method: 'PUT',
        url: '/ISAPI/Intelligent/FDLib/FDSetUp?format=json',
        data: form,
        headers: {
          ...form.getHeaders(),
        },
      });

      this.logger.debug('Face picture applied successfully', {
        deviceId: device.id,
        FDID: faceData.FDID,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to apply face picture', error.message, {
        deviceId: device.id,
        FDID: faceData.FDID,
      });
      throw error;
    }
  }

  /**
   * Modify face picture
   */
  async modifyFacePicture(
    device: any,
    faceData: FaceModifyRequest,
    imageBuffer?: Buffer,
    filename: string = 'face_picture.jpg'
  ): Promise<ISAPIResponse> {
    try {
      this.logger.debug('Modifying face picture', { deviceId: device.id, FPID: faceData.FPID });

      // Create multipart form data
      const FormData = require('form-data');
      const form = new FormData();

      // Add JSON metadata
      form.append('FaceDataRecord', JSON.stringify(faceData), {
        contentType: 'application/json',
      });

      // Add binary image data if provided
      if (imageBuffer) {
        form.append('face picture', imageBuffer, {
          filename,
          contentType: 'image/jpeg',
        });
      }

      const response = await this.httpClient.request<ISAPIResponse>(device, {
        method: 'PUT',
        url: '/ISAPI/Intelligent/FDLib/FDModify?format=json',
        data: form,
        headers: {
          ...form.getHeaders(),
        },
      });

      this.logger.debug('Face picture modified successfully', {
        deviceId: device.id,
        FPID: faceData.FPID,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to modify face picture', error.message, {
        deviceId: device.id,
        FPID: faceData.FPID,
      });
      throw error;
    }
  }

  /**
   * Delete face pictures
   */
  async deleteFacePictures(
    device: any,
    FDID: string,
    faceLibType: string
  ): Promise<ISAPIResponse> {
    try {
      this.logger.debug('Deleting face pictures', { deviceId: device.id, FDID, faceLibType });

      const response = await this.httpClient.request<ISAPIResponse>(device, {
        method: 'PUT',
        url: `/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=${FDID}&faceLibType=${faceLibType}`,
      });

      this.logger.debug('Face pictures deleted successfully', {
        deviceId: device.id,
        FDID,
        statusCode: response.statusCode,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to delete face pictures', error.message, {
        deviceId: device.id,
        FDID,
        faceLibType,
      });
      throw error;
    }
  }

  /**
   * Capture face data from device
   */
  async captureFaceData(
    device: any,
    captureOptions: {
      captureInfrared?: boolean;
      dataType?: 'url' | 'binary';
      readerID?: number;
    } = {}
  ): Promise<any> {
    try {
      this.logger.debug('Capturing face data', { deviceId: device.id, captureOptions });

      const captureRequest = {
        captureInfrared: captureOptions.captureInfrared || true,
        dataType: captureOptions.dataType || 'url',
        readerID: captureOptions.readerID || 1,
      };

      // Convert to XML format as required by the API
      const xmlData = this.xmlJsonService.jsonToXml(
        { CaptureFaceDataCond: captureRequest },
        'CaptureFaceDataCond'
      );

      const response = await this.httpClient.request(device, {
        method: 'POST',
        url: '/ISAPI/AccessControl/CaptureFaceData',
        data: xmlData,
        headers: {
          'Content-Type': 'application/xml',
        },
      });

      this.logger.debug('Face data capture initiated', {
        deviceId: device.id,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to capture face data', error.message, {
        deviceId: device.id,
        captureOptions,
      });
      throw error;
    }
  }

  /**
   * Get face data capture progress
   */
  async getCaptureFaceDataProgress(device: any): Promise<any> {
    try {
      this.logger.debug('Getting face data capture progress', { deviceId: device.id });

      const response = await this.httpClient.request(device, {
        method: 'GET',
        url: '/ISAPI/AccessControl/CaptureFaceData/Progress',
      });

      // Parse XML response
      const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

      return jsonResponse;
    } catch (error) {
      this.logger.error('Failed to get face data capture progress', error.message, {
        deviceId: device.id,
      });
      throw error;
    }
  }

  /**
   * Get face library count and capacity information
   */
  async getFaceLibraryCount(device: any): Promise<{
    totalRecordDataNumber: number;
    FDRecordDataInfo: FaceLibraryInfo[];
    FDCapacity: {
      total: number;
      use: number;
      remain: number;
      maxRecordDataNumber: number;
      useRecordDataNumber: number;
      remainRecordDataNumber: number;
    };
  }> {
    try {
      this.logger.debug('Getting face library count', { deviceId: device.id });

      const response = await this.httpClient.request(device, {
        method: 'GET',
        url: '/ISAPI/Intelligent/FDLib/Count?format=json',
      });

      return response as {
        totalRecordDataNumber: number;
        FDRecordDataInfo: FaceLibraryInfo[];
        FDCapacity: {
          total: number;
          use: number;
          remain: number;
          maxRecordDataNumber: number;
          useRecordDataNumber: number;
          remainRecordDataNumber: number;
        };
      };
    } catch (error) {
      this.logger.error('Failed to get face library count', error.message, {
        deviceId: device.id,
      });
      throw error;
    }
  }
}