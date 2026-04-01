import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FileProvider } from "@/contexts/FileContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Editor from "./pages/Editor";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ContractorApplication from "./pages/ContractorApplication";
import StorageConfig from "./pages/StorageConfig";
import PhoneBook from "./pages/PhoneBook";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AuditProvider>
          <PermissionProvider>
            <FileProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Index />} />
                    <Route path="/edit/:fileId" element={<Editor />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/contractor" element={<ContractorApplication />} />
                    <Route path="/storage-config" element={<StorageConfig />} />
                    <Route path="/phonebook" element={<PhoneBook />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </FileProvider>
          </PermissionProvider>
        </AuditProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
