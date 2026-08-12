import { Routes, Route, Navigate } from "react-router-dom";
import EmployeeApp from "./EmployeeApp";
import AdminApp from "./AdminApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeApp />} />
      <Route path="/admin" element={<AdminApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
