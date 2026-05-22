export interface LicenseNote {
  id: string;
  product_id: string;
  product_name?: string;
  note: string;
  order_id?: string;
  created_by: string;
  created_at: string;
}
export interface CreateLicenseNoteDto {
  product_id: string;
  note: string;
  order_id?: string;
}
