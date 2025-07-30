import { createContext, useContext, useState, ReactNode } from "react";
import { Company } from "@shared/schema";

type AppContextType = {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  showEmployeeModal: boolean;
  setShowEmployeeModal: (show: boolean) => void;
  showTimesheetUploadModal: boolean;
  setShowTimesheetUploadModal: (show: boolean) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showTimesheetUploadModal, setShowTimesheetUploadModal] = useState(false);

  return (
    <AppContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany,
        showEmployeeModal,
        setShowEmployeeModal,
        showTimesheetUploadModal,
        setShowTimesheetUploadModal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
