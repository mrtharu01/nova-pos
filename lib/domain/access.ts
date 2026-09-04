export type NovaBusinessRole =
  | "owner"
  | "manager"
  | "cashier";


export type StaffRole =
  | "manager"
  | "cashier";


export type StaffStatus =
  | "active"
  | "disabled";


export type StaffInvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";


export type BusinessPermissions = {
  checkout: boolean;

  viewSales: boolean;

  manageCatalog: boolean;

  manageInventory: boolean;

  viewReports: boolean;

  manageSettings: boolean;

  manageStaff: boolean;

  manageManagers: boolean;

  refundSales: boolean;
};


export type BusinessAccess = {
  businessId: string;

  userId: string;

  isOwner: boolean;

  role: NovaBusinessRole;

  status: "active";

  permissions:
    BusinessPermissions;
};


export type BusinessStaffMember = {
  staffId:
    | string
    | null;

  userId: string;

  email: string;

  role:
    NovaBusinessRole;

  status:
    StaffStatus;

  isOwner: boolean;

  createdAt: string;
};


export type StaffInvitation = {
  id: string;

  email: string;

  role:
    StaffRole;

  status:
    StaffInvitationStatus;

  expiresAt: string;

  createdAt: string;
};


export type StaffInvitationActionResult = {
  ok: true;

  status:
    | "invited"
    | "existing_user_added";

  message: string;

  invitationId?:
    string;
};