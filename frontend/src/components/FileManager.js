import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Upload,
  File,
  FileText,
  FileAudio,
  FileVideo,
  Image,
  FolderOpen,
  MoreVertical,
  Trash2,
  Edit,
  Download,
  Loader2,
  X,
  Plus,
  CloudUpload,
  Phone,
  Eye,
  Save,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// File type icons
const getFileIcon = (filename, contentType) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'flac'].includes(ext) || contentType?.startsWith('audio/')) {
    return <FileAudio className="w-8 h-8 text-purple-500" />;
  }
  if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv'].includes(ext) || contentType?.startsWith('video/')) {
    return <FileVideo className="w-8 h-8 text-blue-500" />;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || contentType?.startsWith('image/')) {
    return <Image className="w-8 h-8 text-green-500" />;
  }
  if (['pdf'].includes(ext) || contentType === 'application/pdf') {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  return <File className="w-8 h-8 text-gray-500" />;
};

// File type badge
const getFileTypeBadge = (filename, contentType) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'flac'].includes(ext) || contentType?.startsWith('audio/')) {
    return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Audio</Badge>;
  }
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext) || contentType?.startsWith('video/')) {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Video</Badge>;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || contentType?.startsWith('image/')) {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Image</Badge>;
  }
  if (['pdf'].includes(ext) || contentType === 'application/pdf') {
    return <Badge className="bg-red-100 text-red-700 border-red-200">PDF</Badge>;
  }
  return <Badge variant="outline">File</Badge>;
};

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function FileManager({ entityType, entityId, entityName }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'mel@a2gdesigns.com';
  const canPlayAudio = ['admin', 'office_manager'].includes(user?.role) || user?.email === 'mel@a2gdesigns.com';
  
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [storageFolder, setStorageFolder] = useState(null);
  
  // Audio player state
  const [playingFileKey, setPlayingFileKey] = useState(null);
  const [audioRef, setAudioRef] = useState(null);
  
  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileMetadata, setFileMetadata] = useState({
    title: '',
    description: '',
    notes: '',
    file_type: 'document' // document, call_recording, image
  });
  
  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  
  // Preview dialog state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  // Fetch files from storage folder
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/${entityType}/${entityId}/files`, { 
        headers: getHeaders() 
      });
      setFiles(res.data.files || []);
      setStorageFolder(res.data.storage_folder);
      
      // Also fetch file metadata from database
      try {
        const metaRes = await axios.get(`${API_URL}/api/${entityType}/${entityId}/file-metadata`, {
          headers: getHeaders()
        });
        // Merge metadata with files
        const metadataMap = {};
        (metaRes.data || []).forEach(meta => {
          metadataMap[meta.file_key] = meta;
        });
        setFiles(prev => prev.map(f => ({
          ...f,
          metadata: metadataMap[f.key] || null
        })));
      } catch (e) {
        // Metadata endpoint may not exist yet, that's ok
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, getHeaders]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileMetadata({
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        description: '',
        notes: '',
        file_type: getDefaultFileType(file)
      });
      setIsUploadOpen(true);
    }
  };

  // Get default file type from file
  const getDefaultFileType = (file) => {
    if (file.type.startsWith('audio/')) return 'call_recording';
    if (file.type.startsWith('video/')) return 'call_recording';
    if (file.type.startsWith('image/')) return 'image';
    return 'document';
  };

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'audio/', 'video/', 'image/',
        'application/pdf'
      ];
      // Also check by extension for files that may not have correct MIME type
      const allowedExtensions = ['ogg', 'wma', 'flac', 'mp3', 'wav', 'aac', 'm4a', 'mp4', 'mov', 'avi', 'webm', 'wmv', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isAllowed = allowedTypes.some(type => file.type.startsWith(type)) || allowedExtensions.includes(ext);
      
      if (!isAllowed) {
        toast.error('File type not allowed. Please upload audio (MP3, WAV, OGG, WMA), video, images, or PDFs.');
        return;
      }
      
      setSelectedFile(file);
      setFileMetadata({
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: '',
        notes: '',
        file_type: getDefaultFileType(file)
      });
      setIsUploadOpen(true);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', fileMetadata.title);
      formData.append('description', fileMetadata.description);
      formData.append('notes', fileMetadata.notes);
      formData.append('file_type', fileMetadata.file_type);
      
      await axios.post(
        `${API_URL}/api/${entityType}/${entityId}/files`,
        formData,
        {
          headers: {
            ...getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      );
      
      toast.success('File uploaded successfully');
      setIsUploadOpen(false);
      setSelectedFile(null);
      setFileMetadata({ title: '', description: '', notes: '', file_type: 'document' });
      fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Edit file metadata (admin only)
  const handleEditFile = (file) => {
    setEditingFile({
      ...file,
      title: file.metadata?.title || file.filename,
      description: file.metadata?.description || '',
      notes: file.metadata?.notes || ''
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFile) return;
    
    try {
      await axios.put(
        `${API_URL}/api/${entityType}/${entityId}/file-metadata/${encodeURIComponent(editingFile.key)}`,
        {
          title: editingFile.title,
          description: editingFile.description,
          notes: editingFile.notes
        },
        { headers: getHeaders() }
      );
      
      toast.success('File updated successfully');
      setIsEditOpen(false);
      setEditingFile(null);
      fetchFiles();
    } catch (error) {
      toast.error('Failed to update file');
    }
  };

  // Delete file (admin only)
  const handleDeleteFile = async (file) => {
    if (!window.confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(
        `${API_URL}/api/${entityType}/${entityId}/files/${encodeURIComponent(file.key)}`,
        { headers: getHeaders() }
      );
      
      toast.success('File deleted successfully');
      fetchFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  // Preview file
  const handlePreviewFile = (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  // Check if file is audio
  const isAudioFile = (file) => {
    const ext = file.filename?.split('.').pop()?.toLowerCase();
    return ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'flac'].includes(ext) || 
           file.content_type?.startsWith('audio/');
  };

  // Play/Pause audio
  const handlePlayAudio = (file) => {
    if (playingFileKey === file.key) {
      // Pause current audio
      if (audioRef) {
        audioRef.pause();
        setPlayingFileKey(null);
      }
    } else {
      // Stop any currently playing audio
      if (audioRef) {
        audioRef.pause();
      }
      
      // Check if URL exists
      if (!file.url) {
        toast.error('File URL not available');
        return;
      }
      
      // Create and play new audio
      const audio = new Audio(file.url);
      audio.onended = () => {
        setPlayingFileKey(null);
      };
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        toast.error('Failed to play audio file. The file may have expired or be unavailable.');
        setPlayingFileKey(null);
      };
      audio.play().catch(err => {
        console.error('Play error:', err);
        toast.error('Failed to start playback');
        setPlayingFileKey(null);
      });
      setAudioRef(audio);
      setPlayingFileKey(file.key);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef) {
        audioRef.pause();
      }
    };
  }, [audioRef]);

  return (
    <Card data-testid="file-manager">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Files & Documents
            </CardTitle>
            <CardDescription>
              {storageFolder 
                ? `Storage folder: ${storageFolder}`
                : 'Manage files for this record'}
            </CardDescription>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} data-testid="upload-file-btn">
            <Plus className="w-4 h-4 mr-2" />
            Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="audio/*,video/*,image/*,.pdf,.ogg,.wma,.flac"
          className="hidden"
        />
        
        {/* Drop zone */}
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
          `}
          data-testid="file-drop-zone"
        >
          <CloudUpload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-lg font-medium mb-1">
            {isDragging ? 'Drop your file here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click the button above to browse
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              <FileAudio className="w-3 h-3 mr-1" /> MP3, WAV, OGG, WMA
            </Badge>
            <Badge variant="outline" className="text-xs">
              <FileVideo className="w-3 h-3 mr-1" /> MP4, MOV
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Image className="w-3 h-3 mr-1" /> JPG, PNG
            </Badge>
            <Badge variant="outline" className="text-xs">
              <FileText className="w-3 h-3 mr-1" /> PDF
            </Badge>
          </div>
        </div>

        {/* Files list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm">Upload files to keep records organized</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {files.map((file, index) => (
              <div
                key={file.key || index}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`file-item-${index}`}
              >
                {/* File icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(file.filename, file.content_type)}
                </div>
                
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">
                      {file.metadata?.title || file.filename}
                    </h4>
                    {getFileTypeBadge(file.filename, file.content_type)}
                    {file.metadata?.file_type === 'call_recording' && (
                      <Badge variant="outline" className="text-xs">
                        <Phone className="w-3 h-3 mr-1" /> Call
                      </Badge>
                    )}
                  </div>
                  {file.metadata?.description && (
                    <p className="text-sm text-muted-foreground truncate mb-1">
                      {file.metadata.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    {file.last_modified && (
                      <span>{formatDate(file.last_modified)}</span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Play button for audio files - Admin/Office Manager only */}
                  {canPlayAudio && isAudioFile(file) && (
                    <Button
                      variant={playingFileKey === file.key ? "default" : "ghost"}
                      size="icon"
                      onClick={() => handlePlayAudio(file)}
                      title={playingFileKey === file.key ? "Pause" : "Play"}
                      className={playingFileKey === file.key ? "bg-green-600 hover:bg-green-700" : ""}
                      data-testid={`play-audio-${file.key}`}
                    >
                      {playingFileKey === file.key ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePreviewFile(file)}
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canPlayAudio && isAudioFile(file) && (
                        <DropdownMenuItem onClick={() => handlePlayAudio(file)}>
                          {playingFileKey === file.key ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Play Audio
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      {file.url ? (
                        <DropdownMenuItem asChild>
                          <a href={file.url} download={file.filename} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          <Download className="w-4 h-4 mr-2" />
                          Download unavailable
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <>
                          <DropdownMenuItem onClick={() => handleEditFile(file)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteFile(file)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription>
                Add details for the file you're uploading
              </DialogDescription>
            </DialogHeader>
            
            {selectedFile && (
              <div className="space-y-4">
                {/* File preview */}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {getFileIcon(selectedFile.name, selectedFile.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      setIsUploadOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="file-title">Title *</Label>
                  <Input
                    id="file-title"
                    value={fileMetadata.title}
                    onChange={(e) => setFileMetadata(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter a title for this file"
                  />
                </div>
                
                {/* File type */}
                <div className="space-y-2">
                  <Label>File Type</Label>
                  <div className="flex gap-2">
                    {[
                      { value: 'document', label: 'Document', icon: FileText },
                      { value: 'call_recording', label: 'Call Recording', icon: Phone },
                      { value: 'image', label: 'Image', icon: Image }
                    ].map(({ value, label, icon: Icon }) => (
                      <Button
                        key={value}
                        type="button"
                        variant={fileMetadata.file_type === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFileMetadata(prev => ({ ...prev, file_type: value }))}
                      >
                        <Icon className="w-4 h-4 mr-1" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="file-description">Description</Label>
                  <Input
                    id="file-description"
                    value={fileMetadata.description}
                    onChange={(e) => setFileMetadata(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the file"
                  />
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="file-notes">Notes</Label>
                  <Textarea
                    id="file-notes"
                    value={fileMetadata.notes}
                    onChange={(e) => setFileMetadata(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes or context..."
                    rows={3}
                  />
                </div>
                
                {/* Upload progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !fileMetadata.title}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (Admin Only) */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit File Details</DialogTitle>
              <DialogDescription>
                Update the title, description, and notes for this file
              </DialogDescription>
            </DialogHeader>
            
            {editingFile && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={editingFile.title}
                    onChange={(e) => setEditingFile(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingFile.description}
                    onChange={(e) => setEditingFile(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={editingFile.notes}
                    onChange={(e) => setEditingFile(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewFile?.metadata?.title || previewFile?.filename}</DialogTitle>
              {previewFile?.metadata?.description && (
                <DialogDescription>{previewFile.metadata.description}</DialogDescription>
              )}
            </DialogHeader>
            
            {previewFile && (
              <div className="space-y-4">
                {/* Preview based on file type */}
                <div className="bg-muted rounded-lg overflow-hidden">
                  {!previewFile.url ? (
                    <div className="p-8 text-center">
                      <File className="w-24 h-24 mx-auto mb-4 text-muted-foreground" />
                      <p>File URL not available</p>
                      <p className="text-sm text-muted-foreground mt-2">The file may have expired or storage is not configured.</p>
                    </div>
                  ) : previewFile.content_type?.startsWith('image/') || 
                   ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(previewFile.filename?.split('.').pop()?.toLowerCase()) ? (
                    <img
                      src={previewFile.url}
                      alt={previewFile.filename}
                      className="max-w-full max-h-[60vh] mx-auto object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : previewFile.content_type?.startsWith('video/') ||
                       ['mp4', 'mov', 'webm'].includes(previewFile.filename?.split('.').pop()?.toLowerCase()) ? (
                    <video
                      src={previewFile.url}
                      controls
                      className="max-w-full max-h-[60vh] mx-auto"
                    />
                  ) : previewFile.content_type?.startsWith('audio/') ||
                       ['mp3', 'wav', 'ogg', 'wma', 'flac', 'aac', 'm4a'].includes(previewFile.filename?.split('.').pop()?.toLowerCase()) ? (
                    <div className="p-8 flex flex-col items-center">
                      <FileAudio className="w-24 h-24 text-purple-500 mb-4" />
                      <audio src={previewFile.url} controls className="w-full max-w-md" />
                    </div>
                  ) : previewFile.content_type === 'application/pdf' ||
                       previewFile.filename?.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={previewFile.url}
                      className="w-full h-[60vh]"
                      title={previewFile.filename}
                    />
                  ) : (
                    <div className="p-8 text-center">
                      <File className="w-24 h-24 mx-auto mb-4 text-muted-foreground" />
                      <p>Preview not available for this file type</p>
                      {previewFile.url && (
                        <Button asChild className="mt-4">
                          <a href={previewFile.url} download={previewFile.filename} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />
                            Download File
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* File details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <span className="ml-2">{formatFileSize(previewFile.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uploaded:</span>
                    <span className="ml-2">{formatDate(previewFile.last_modified)}</span>
                  </div>
                </div>
                
                {/* Notes */}
                {previewFile.metadata?.notes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {previewFile.metadata.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                Close
              </Button>
              {previewFile?.url && (
                <Button asChild>
                  <a href={previewFile.url} download={previewFile.filename} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
