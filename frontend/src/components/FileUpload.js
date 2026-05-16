import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Upload,
  X,
  FileIcon,
  ImageIcon,
  FileTextIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Get icon based on file type
const getFileIcon = (contentType) => {
  if (contentType?.startsWith('image/')) return ImageIcon;
  if (contentType?.includes('pdf') || contentType?.includes('document')) return FileTextIcon;
  return FileIcon;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function FileUpload({
  folder = 'uploads',
  accept = '*/*',
  maxSize = 50 * 1024 * 1024, // 50MB default
  multiple = false,
  onUploadComplete,
  onFileRemove,
  existingFiles = [],
  label = 'Upload File',
  description = 'Drag and drop or click to upload',
  showPreview = true,
  className = ''
}) {
  const [files, setFiles] = useState(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleFiles = async (selectedFiles) => {
    // Validate file sizes
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Max size is ${formatFileSize(maxSize)}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // If not multiple, only take the first file
    const filesToUpload = multiple ? validFiles : [validFiles[0]];

    setUploading(true);
    setUploadProgress(0);

    const uploadedFiles = [];
    const totalFiles = filesToUpload.length;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await axios.post(
          `${API_URL}/api/storage/upload`,
          formData,
          {
            headers: {
              ...getHeaders(),
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const fileProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const overallProgress = Math.round(((i + fileProgress / 100) / totalFiles) * 100);
              setUploadProgress(overallProgress);
            }
          }
        );

        uploadedFiles.push({
          ...response.data,
          id: response.data.key
        });

      } catch (error) {
        console.error('Upload failed:', error);
        const message = error.response?.data?.detail || 'Upload failed';
        toast.error(`Failed to upload ${file.name}: ${message}`);
      }
    }

    setUploading(false);
    setUploadProgress(0);

    if (uploadedFiles.length > 0) {
      const newFiles = multiple ? [...files, ...uploadedFiles] : uploadedFiles;
      setFiles(newFiles);
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
      
      if (onUploadComplete) {
        onUploadComplete(newFiles);
      }
    }
  };

  const handleRemove = async (fileToRemove) => {
    try {
      // Delete from storage
      await axios.delete(
        `${API_URL}/api/storage/delete/${encodeURIComponent(fileToRemove.key)}`,
        { headers: getHeaders() }
      );

      const updatedFiles = files.filter(f => f.key !== fileToRemove.key);
      setFiles(updatedFiles);
      toast.success('File removed');

      if (onFileRemove) {
        onFileRemove(fileToRemove, updatedFiles);
      }
    } catch (error) {
      // If delete fails (maybe user doesn't have permission), just remove from UI
      const updatedFiles = files.filter(f => f.key !== fileToRemove.key);
      setFiles(updatedFiles);
      
      if (onFileRemove) {
        onFileRemove(fileToRemove, updatedFiles);
      }
    }
  };

  return (
    <div className={className} data-testid="file-upload">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-colors
          ${dragActive ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : 'border-gray-300 dark:border-gray-700'}
          ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-amber-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />

        {uploading ? (
          <div className="py-4">
            <Loader2 className="w-10 h-10 mx-auto text-amber-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploading... {uploadProgress}%
            </p>
            <Progress value={uploadProgress} className="mt-3 max-w-xs mx-auto" />
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
            <p className="text-xs text-gray-400 mt-2">
              Max file size: {formatFileSize(maxSize)}
            </p>
          </>
        )}
      </div>

      {/* Uploaded Files List */}
      {showPreview && files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Uploaded Files ({files.length})
          </p>
          {files.map((file) => {
            const FileIconComponent = getFileIcon(file.content_type);
            return (
              <div
                key={file.key}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
              >
                {file.content_type?.startsWith('image/') && file.url ? (
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                    <FileIconComponent className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(file);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Storage status hook for checking if storage is configured
export function useStorageStatus() {
  const [status, setStatus] = useState({ configured: false, connected: false, loading: true });

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/storage/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ ...response.data, loading: false });
    } catch (error) {
      setStatus({ configured: false, connected: false, loading: false, error: 'Failed to check storage status' });
    }
  };

  return { status, checkStatus };
}
