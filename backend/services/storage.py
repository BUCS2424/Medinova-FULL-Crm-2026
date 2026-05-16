"""
Storage Service for iDrive E2 (S3-compatible)
"""
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from pathlib import Path
import uuid
from datetime import datetime, timezone
import logging

from config import db

logger = logging.getLogger(__name__)


class StorageService:
    """
    Centralized storage service for iDrive E2 (S3-compatible).
    All file uploads in the platform should use this service.
    """
    
    _instance = None
    _client = None
    _settings = None
    
    @classmethod
    async def get_settings(cls):
        """Fetch storage settings from database"""
        settings = await db.site_settings.find_one({"type": "storage"})
        return settings
    
    @classmethod
    async def get_client(cls):
        """Get or create S3 client with current settings"""
        settings = await cls.get_settings()
        if not settings:
            return None, "Storage not configured"
        
        required = ["endpoint", "access_key", "secret_key", "bucket_name"]
        missing = [f for f in required if not settings.get(f)]
        if missing:
            return None, f"Missing storage settings: {', '.join(missing)}"
        
        try:
            client = boto3.client(
                's3',
                endpoint_url=settings['endpoint'],
                aws_access_key_id=settings['access_key'],
                aws_secret_access_key=settings['secret_key'],
                region_name='us-east-1'  # Required but ignored by E2
            )
            return client, settings
        except Exception as e:
            logger.error(f"Failed to create S3 client: {e}")
            return None, str(e)
    
    @classmethod
    async def test_connection(cls):
        """Test the storage connection"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings  # settings contains error message
        
        try:
            # Try to list objects (head bucket can fail on some S3-compatible services)
            client.list_objects_v2(Bucket=settings['bucket_name'], MaxKeys=1)
            return True, "Connection successful"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchBucket':
                return False, f"Bucket '{settings['bucket_name']}' does not exist"
            return False, f"Connection failed: {error_code}"
        except NoCredentialsError:
            return False, "Invalid credentials"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
    
    @classmethod
    async def upload_file(cls, file_content: bytes = None, file_key: str = None, 
                         content_type: str = None, file_data: bytes = None, 
                         filename: str = None, folder: str = None):
        """
        Upload a file to storage.
        
        Supports two calling conventions:
        1. file_content + file_key + content_type (new style)
        2. file_data + filename + folder (legacy style)
        """
        # Handle legacy calling convention
        if file_data is not None and filename is not None:
            file_content = file_data
        
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            # If file_key is provided, use it directly
            if file_key:
                key = file_key
            else:
                # Generate unique filename to prevent collisions
                file_ext = Path(filename).suffix if filename else ''
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                
                # Build the full key (path) in the bucket
                base_folder = settings.get('folder_path', '').strip('/')
                if folder:
                    folder = folder.strip('/')
                    if base_folder:
                        key = f"{base_folder}/{folder}/{unique_filename}"
                    else:
                        key = f"{folder}/{unique_filename}"
                else:
                    if base_folder:
                        key = f"{base_folder}/{unique_filename}"
                    else:
                        key = unique_filename
            
            # Upload with metadata
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            extra_args['Metadata'] = {
                'original-filename': filename or 'unknown',
                'uploaded-at': datetime.now(timezone.utc).isoformat()
            }
            
            client.put_object(
                Bucket=settings['bucket_name'],
                Key=key,
                Body=file_content,
                **extra_args
            )
            
            # Generate presigned URL for access (valid for 1 hour)
            try:
                url = client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': settings['bucket_name'], 'Key': key},
                    ExpiresIn=3600
                )
            except Exception:
                # Fallback to direct URL
                url = f"{settings['endpoint']}/{settings['bucket_name']}/{key}"
            
            return True, {
                'key': key,
                'url': url,
                'filename': filename or key.split('/')[-1],
                'size': len(file_content),
                'content_type': content_type
            }
        except ClientError as e:
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"Upload failed: {error_msg}")
            return False, f"Upload failed: {error_msg}"
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return False, f"Upload failed: {str(e)}"
    
    @classmethod
    async def get_file(cls, key: str):
        """Get a file from storage."""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            response = client.get_object(Bucket=settings['bucket_name'], Key=key)
            file_data = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            metadata = response.get('Metadata', {})
            
            return True, {
                'data': file_data,
                'content_type': content_type,
                'metadata': metadata
            }
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                return False, "File not found"
            return False, f"Failed to get file: {error_code}"
        except Exception as e:
            return False, f"Failed to get file: {str(e)}"
    
    @classmethod
    async def delete_file(cls, key: str):
        """Delete a file from storage"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            client.delete_object(Bucket=settings['bucket_name'], Key=key)
            return True, "File deleted"
        except Exception as e:
            return False, f"Failed to delete file: {str(e)}"
    
    @classmethod
    async def generate_presigned_url(cls, key: str, expiration: int = 3600):
        """Generate a presigned URL for temporary access to a file."""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            url = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings['bucket_name'], 'Key': key},
                ExpiresIn=expiration
            )
            return True, url
        except Exception as e:
            return False, f"Failed to generate URL: {str(e)}"
    
    @classmethod
    async def list_files(cls, prefix: str = None, max_keys: int = 100):
        """List files in storage with optional prefix filter"""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            params = {'Bucket': settings['bucket_name'], 'MaxKeys': max_keys}
            
            base_folder = settings.get('folder_path', '').strip('/')
            if prefix:
                if base_folder:
                    params['Prefix'] = f"{base_folder}/{prefix}"
                else:
                    params['Prefix'] = prefix
            elif base_folder:
                params['Prefix'] = base_folder
            
            response = client.list_objects_v2(**params)
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
            
            return True, files
        except Exception as e:
            return False, f"Failed to list files: {str(e)}"
    
    @classmethod
    async def create_folder(cls, folder_path: str):
        """Create a folder in storage by uploading a placeholder file."""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            # Build the full key (path) in the bucket
            base_folder = settings.get('folder_path', '').strip('/')
            folder_path = folder_path.strip('/')
            
            if base_folder:
                full_path = f"{base_folder}/{folder_path}/.folder"
            else:
                full_path = f"{folder_path}/.folder"
            
            # Create a placeholder file to establish the folder
            client.put_object(
                Bucket=settings['bucket_name'],
                Key=full_path,
                Body=b'',
                ContentType='application/x-directory'
            )
            
            return True, folder_path
        except Exception as e:
            logger.error(f"Failed to create folder: {e}")
            return False, f"Failed to create folder: {str(e)}"
    
    @classmethod
    async def get_folder_files(cls, folder_path: str, max_keys: int = 100):
        """List all files in a specific folder with download URLs."""
        client, settings = await cls.get_client()
        if not client:
            return False, settings
        
        try:
            base_folder = settings.get('folder_path', '').strip('/')
            folder_path = folder_path.strip('/')
            
            if base_folder:
                prefix = f"{base_folder}/{folder_path}/"
            else:
                prefix = f"{folder_path}/"
            
            response = client.list_objects_v2(
                Bucket=settings['bucket_name'],
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            files = []
            for obj in response.get('Contents', []):
                # Skip the placeholder file
                if obj['Key'].endswith('.folder'):
                    continue
                
                key = obj['Key']
                filename = key.split('/')[-1]
                
                # Generate presigned URL for download/play (valid for 1 hour)
                try:
                    url = client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': settings['bucket_name'], 'Key': key},
                        ExpiresIn=3600
                    )
                except Exception:
                    # Fallback to direct URL if presigned fails
                    url = f"{settings['endpoint']}/{settings['bucket_name']}/{key}"
                
                # Detect content type from filename
                content_type = 'application/octet-stream'
                ext = filename.split('.')[-1].lower() if '.' in filename else ''
                content_types = {
                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
                    'wma': 'audio/x-ms-wma', 'flac': 'audio/flac', 'aac': 'audio/aac',
                    'm4a': 'audio/mp4',
                    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm',
                    'wmv': 'video/x-ms-wmv', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                    'gif': 'image/gif', 'webp': 'image/webp',
                    'pdf': 'application/pdf'
                }
                content_type = content_types.get(ext, content_type)
                
                files.append({
                    'key': key,
                    'filename': filename,
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'url': url,
                    'content_type': content_type
                })
            
            return True, files
        except Exception as e:
            return False, f"Failed to list folder files: {str(e)}"
