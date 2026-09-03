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