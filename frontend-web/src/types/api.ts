export type EventStatus = "active" | "inactive" | "completed" | "archived";

export interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminLoginResponse {
  token: string;
  expires_at: string;
  admin: AdminUser;
}

export interface EventStorage {
  provider: string;
  bucket_name: string;
  region: string | null;
  provisioning_status: "pending" | "provisioned" | "failed";
  is_verified: boolean;
  last_error: string | null;
  total_photos: number;
  total_bytes: number;
  verified_at: string | null;
}

export interface EventItem {
  id: number;
  event_uid: string;
  name: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  organizer_name: string | null;
  organizer_contact: string | null;
  status: EventStatus;
  accepting_photos: boolean;
  enforce_time_window: boolean;
  access_code: string | null;
  created_at: string;
  updated_at: string;
  storage: EventStorage | null;
}

export interface EventCreatePayload {
  name: string;
  description?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  organizer_name?: string | null;
  organizer_contact?: string | null;
  status: EventStatus;
  accepting_photos: boolean;
  enforce_time_window: boolean;
}

export interface EventProvisionResponse {
  event: EventItem;
  provisioned: boolean;
  message: string;
}

export interface DashboardStats {
  total_events: number;
  active_events: number;
  completed_events: number;
  inactive_events: number;
  archived_events: number;
  total_photos_uploaded: number;
  total_storage_bytes: number;
  recent_events: EventItem[];
}

export interface AdminPhoto {
  photo_id: string;
  event_uid: string;
  event_name: string;
  event_access_code: string;
  bucket_name: string;
  object_key: string;
  original_filename: string | null;
  stored_filename: string;
  file_size: number;
  mime_type: string;
  upload_status: string;
  is_public: boolean;
  uploaded_at: string;
  image_url: string;
  download_url: string;
  qr_target_url: string | null;
  qr_image_url: string | null;
  scan_count: number;
}

export interface AdminPhotoListResponse {
  items: AdminPhoto[];
  total: number;
  total_bytes: number;
}

export interface PublicEventInfo {
  event_name: string;
  event_date: string;
  location: string | null;
  description: string | null;
}

export interface EventAccessResponse {
  session_token: string;
  expires_at: string;
  event: PublicEventInfo;
}

export interface PublicSessionStatusResponse {
  valid: boolean;
  expires_at: string;
  photos_uploaded: number;
  event: PublicEventInfo;
}

export interface PublicPhotoUploadResponse {
  photo_id: string;
  event_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  photo_view_url: string;
  qr_target_url: string;
  qr_image_url: string;
  qr_data_url: string;
}

export interface PublicSessionPhotoItem {
  photo_id: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  photo_view_url: string;
  qr_target_url: string;
  qr_image_url: string;
}

export interface PublicPhotoViewResponse {
  photo_id: string;
  event_name: string;
  event_date: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  image_url: string;
  download_url: string;
  download_enabled: boolean;
}

