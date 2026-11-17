import { createContext, useContext } from "react";

export const AdminReadOnly = createContext(false);
export const useAdminReadOnly = () => useContext(AdminReadOnly);
